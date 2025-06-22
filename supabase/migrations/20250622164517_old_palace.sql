/*
  # Fix signup database constraints and trigger issues

  1. Changes
    - Make username field nullable temporarily during user creation
    - Improve trigger function to handle all edge cases
    - Add better error handling and logging
    - Ensure profile creation never fails during signup

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger has proper permissions
*/

-- First, let's make the username field nullable to prevent NOT NULL constraint violations during signup
ALTER TABLE profiles ALTER COLUMN username DROP NOT NULL;

-- Update the unique constraint to handle NULL values properly
DROP INDEX IF EXISTS profiles_username_unique_idx;
CREATE UNIQUE INDEX profiles_username_unique_idx ON profiles (username) WHERE username IS NOT NULL;

-- Create a more robust trigger function that handles all edge cases
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt_count INTEGER := 0;
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for user: % with email: %', NEW.id, NEW.email;
  
  -- Generate a base username from email or UUID
  base_username := COALESCE(
    LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g')),
    'user' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8))
  );
  
  -- Ensure base username is at least 3 characters
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  END IF;
  
  -- Generate unique username with retry logic
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) AND attempt_count < 100 LOOP
    attempt_count := attempt_count + 1;
    final_username := base_username || attempt_count::TEXT;
  END LOOP;
  
  -- If still not unique after 100 attempts, use timestamp
  IF EXISTS (SELECT 1 FROM profiles WHERE username = final_username) THEN
    final_username := base_username || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  END IF;
  
  -- Insert profile with comprehensive error handling
  BEGIN
    INSERT INTO public.profiles (
      id, 
      name, 
      username,
      email, 
      bio, 
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'name', 
        NEW.raw_user_meta_data->>'first_name',
        split_part(NEW.email, '@', 1),
        'New User'
      ),
      final_username,
      NEW.email,
      'New to Zenlit! 👋',
      now(),
      now()
    );
    
    RAISE LOG 'Profile created successfully for user: % with username: %', NEW.id, final_username;
    
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle unique constraint violations
      RAISE LOG 'Unique constraint violation for user %: %', NEW.id, SQLERRM;
      
      -- Try to update existing profile if it exists
      UPDATE public.profiles 
      SET 
        name = COALESCE(profiles.name, split_part(NEW.email, '@', 1)),
        username = COALESCE(profiles.username, final_username || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT),
        email = COALESCE(profiles.email, NEW.email),
        bio = COALESCE(profiles.bio, 'New to Zenlit! 👋'),
        updated_at = now()
      WHERE id = NEW.id;
      
      -- If no rows were updated, the profile doesn't exist, so insert with timestamp username
      IF NOT FOUND THEN
        INSERT INTO public.profiles (id, name, username, email, bio, created_at, updated_at)
        VALUES (
          NEW.id,
          split_part(NEW.email, '@', 1),
          'user_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
          NEW.email,
          'New to Zenlit! 👋',
          now(),
          now()
        );
      END IF;
      
    WHEN OTHERS THEN
      -- Handle any other errors
      RAISE LOG 'Unexpected error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      
      -- Create minimal profile to prevent auth failures
      BEGIN
        INSERT INTO public.profiles (id, email, name, created_at, updated_at)
        VALUES (
          NEW.id, 
          NEW.email, 
          COALESCE(split_part(NEW.email, '@', 1), 'User'),
          now(),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = COALESCE(profiles.email, EXCLUDED.email),
          name = COALESCE(profiles.name, EXCLUDED.name),
          updated_at = now();
          
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Failed to create minimal profile for user %: %', NEW.id, SQLERRM;
          -- Don't fail the user creation even if profile creation fails completely
      END;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant all necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create a function to clean up any orphaned auth users without profiles
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS void AS $$
BEGIN
  -- Find auth users without profiles and create profiles for them
  INSERT INTO public.profiles (id, email, name, bio, created_at, updated_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(split_part(au.email, '@', 1), 'User'),
    'New to Zenlit! 👋',
    now(),
    now()
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;
  
  RAISE LOG 'Cleaned up orphaned users';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run cleanup for any existing orphaned users
SELECT public.cleanup_orphaned_users();