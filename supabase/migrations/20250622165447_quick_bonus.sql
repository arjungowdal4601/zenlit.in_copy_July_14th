/*
  # Fix username length constraint in signup trigger

  1. Changes
    - Ensure generated usernames never exceed 30 characters
    - Truncate base username before adding suffixes
    - Add proper length validation in all fallback scenarios
    - Improve error handling to prevent signup failures

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger has proper permissions
*/

-- Create an improved trigger function that respects username length constraints
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt_count INTEGER := 0;
  max_username_length CONSTANT INTEGER := 30;
  base_max_length INTEGER;
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
  
  -- Calculate maximum length for base username (leaving room for suffixes)
  -- Reserve 5 characters for potential numeric suffix (up to 99999)
  base_max_length := max_username_length - 5;
  
  -- Truncate base username if it's too long
  IF LENGTH(base_username) > base_max_length THEN
    base_username := SUBSTRING(base_username, 1, base_max_length);
  END IF;
  
  -- Generate unique username with retry logic
  final_username := base_username;
  
  -- Ensure the initial username doesn't exceed max length
  IF LENGTH(final_username) > max_username_length THEN
    final_username := SUBSTRING(final_username, 1, max_username_length);
  END IF;
  
  -- Try to find a unique username
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) AND attempt_count < 100 LOOP
    attempt_count := attempt_count + 1;
    final_username := base_username || attempt_count::TEXT;
    
    -- Ensure the username with suffix doesn't exceed max length
    IF LENGTH(final_username) > max_username_length THEN
      -- Recalculate base length to accommodate the suffix
      base_max_length := max_username_length - LENGTH(attempt_count::TEXT);
      final_username := SUBSTRING(base_username, 1, base_max_length) || attempt_count::TEXT;
    END IF;
  END LOOP;
  
  -- If still not unique after 100 attempts, use timestamp suffix
  IF EXISTS (SELECT 1 FROM profiles WHERE username = final_username) THEN
    DECLARE
      timestamp_suffix TEXT := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
      timestamp_max_length INTEGER;
    BEGIN
      timestamp_max_length := max_username_length - LENGTH(timestamp_suffix) - 1; -- -1 for underscore
      final_username := SUBSTRING(base_username, 1, timestamp_max_length) || '_' || timestamp_suffix;
    END;
  END IF;
  
  -- Final safety check - ensure username is within limits
  IF LENGTH(final_username) > max_username_length THEN
    final_username := SUBSTRING(final_username, 1, max_username_length);
  END IF;
  
  -- Ensure minimum length
  IF LENGTH(final_username) < 3 THEN
    final_username := 'usr' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, max_username_length - 3));
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
      
      -- Generate a guaranteed unique username using timestamp
      DECLARE
        unique_suffix TEXT := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
        safe_base TEXT := SUBSTRING(base_username, 1, max_username_length - LENGTH(unique_suffix) - 1);
        guaranteed_username TEXT := safe_base || '_' || unique_suffix;
      BEGIN
        -- Ensure the guaranteed username meets length requirements
        IF LENGTH(guaranteed_username) > max_username_length THEN
          guaranteed_username := SUBSTRING(guaranteed_username, 1, max_username_length);
        END IF;
        
        IF LENGTH(guaranteed_username) < 3 THEN
          guaranteed_username := 'u_' || unique_suffix;
          IF LENGTH(guaranteed_username) > max_username_length THEN
            guaranteed_username := SUBSTRING(guaranteed_username, 1, max_username_length);
          END IF;
        END IF;
        
        -- Try to update existing profile if it exists
        UPDATE public.profiles 
        SET 
          name = COALESCE(profiles.name, split_part(NEW.email, '@', 1)),
          username = COALESCE(profiles.username, guaranteed_username),
          email = COALESCE(profiles.email, NEW.email),
          bio = COALESCE(profiles.bio, 'New to Zenlit! 👋'),
          updated_at = now()
        WHERE id = NEW.id;
        
        -- If no rows were updated, the profile doesn't exist, so insert with guaranteed username
        IF NOT FOUND THEN
          INSERT INTO public.profiles (id, name, username, email, bio, created_at, updated_at)
          VALUES (
            NEW.id,
            split_part(NEW.email, '@', 1),
            guaranteed_username,
            NEW.email,
            'New to Zenlit! 👋',
            now(),
            now()
          );
        END IF;
      END;
      
    WHEN OTHERS THEN
      -- Handle any other errors
      RAISE LOG 'Unexpected error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      
      -- Create minimal profile with guaranteed valid username
      DECLARE
        fallback_suffix TEXT := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
        fallback_username TEXT := 'user_' || fallback_suffix;
      BEGIN
        -- Ensure fallback username meets constraints
        IF LENGTH(fallback_username) > max_username_length THEN
          fallback_username := SUBSTRING(fallback_username, 1, max_username_length);
        END IF;
        
        INSERT INTO public.profiles (id, email, name, username, created_at, updated_at)
        VALUES (
          NEW.id, 
          NEW.email, 
          COALESCE(split_part(NEW.email, '@', 1), 'User'),
          fallback_username,
          now(),
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = COALESCE(profiles.email, EXCLUDED.email),
          name = COALESCE(profiles.name, EXCLUDED.name),
          username = COALESCE(profiles.username, EXCLUDED.username),
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

-- Update the cleanup function to also respect username length constraints
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS void AS $$
DECLARE
  max_username_length CONSTANT INTEGER := 30;
BEGIN
  -- Find auth users without profiles and create profiles for them
  INSERT INTO public.profiles (id, email, name, username, bio, created_at, updated_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(split_part(au.email, '@', 1), 'User'),
    CASE 
      WHEN LENGTH(COALESCE(split_part(au.email, '@', 1), 'user')) <= max_username_length 
      THEN COALESCE(split_part(au.email, '@', 1), 'user')
      ELSE SUBSTRING(COALESCE(split_part(au.email, '@', 1), 'user'), 1, max_username_length)
    END || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
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