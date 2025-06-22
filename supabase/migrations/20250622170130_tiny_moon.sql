/*
  # Simplified user profile creation trigger

  1. Changes
    - Remove complex username generation logic from trigger
    - Allow username to be NULL initially (handled by ProfileSetupScreen)
    - Simplify profile creation to prevent database errors during signup
    - Focus on essential profile fields only

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger has proper permissions
*/

-- Create a simplified trigger function that doesn't handle username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for user: % with email: %', NEW.id, NEW.email;
  
  -- Insert profile with minimal required fields
  -- Username will be set later by the user in ProfileSetupScreen
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
      NULL, -- Username will be set later by user
      NEW.email,
      'New to Zenlit! 👋',
      now(),
      now()
    );
    
    RAISE LOG 'Profile created successfully for user: %', NEW.id;
    
  EXCEPTION
    WHEN unique_violation THEN
      -- Handle unique constraint violations by updating existing profile
      RAISE LOG 'Profile already exists for user %: %', NEW.id, SQLERRM;
      
      UPDATE public.profiles 
      SET 
        name = COALESCE(profiles.name, split_part(NEW.email, '@', 1)),
        email = COALESCE(profiles.email, NEW.email),
        bio = COALESCE(profiles.bio, 'New to Zenlit! 👋'),
        updated_at = now()
      WHERE id = NEW.id;
      
    WHEN OTHERS THEN
      -- Handle any other errors
      RAISE LOG 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      
      -- Try to create minimal profile
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

-- Update the cleanup function to also avoid username generation
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS void AS $$
BEGIN
  -- Find auth users without profiles and create profiles for them
  INSERT INTO public.profiles (id, email, name, username, bio, created_at, updated_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(split_part(au.email, '@', 1), 'User'),
    NULL, -- Username will be set later by user
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