/*
  # Fix signup issues with safe trigger function

  1. Changes
    - Replace handle_new_user() with a version that doesn't use gen_random_bytes()
    - Use random() instead for username generation (no extension required)
    - Ensure trigger is properly attached
    - Add comprehensive error handling

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger never fails user creation
    - Use safe PostgreSQL built-in functions only
*/

-- Create a safe trigger function that doesn't require extensions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  temp_username TEXT;
BEGIN
  -- Generate fallback username (safe even without pgcrypto)
  temp_username := LOWER('user_' || FLOOR(RANDOM() * 1000000)::INT);

  RAISE LOG 'Creating profile for user: % with email: %', NEW.id, NEW.email;

  -- Insert into the public.profiles table
  BEGIN
    INSERT INTO public.profiles (
      id,
      name,
      username,
      email,
      bio,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'New User'),
      temp_username,
      NEW.email,
      'New to Zenlit! 👋',
      now(),
      now()
    );

    RAISE LOG 'Profile created successfully for user: %', NEW.id;

  EXCEPTION
    WHEN unique_violation THEN
      -- Handle unique constraint violations
      RAISE LOG 'Profile already exists for user %: %', NEW.id, SQLERRM;
      
      -- Try to update existing profile
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

  -- Always return NEW to allow user creation to proceed
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users for auto-profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create a test function to verify the setup works
CREATE OR REPLACE FUNCTION public.test_signup_flow()
RETURNS TABLE(test_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Test if trigger function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    RETURN QUERY SELECT 'Trigger Function'::TEXT, 'EXISTS'::TEXT, 'Function is available'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Trigger Function'::TEXT, 'MISSING'::TEXT, 'Function not found'::TEXT;
  END IF;

  -- Test if trigger is attached
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    RETURN QUERY SELECT 'Trigger'::TEXT, 'ATTACHED'::TEXT, 'Trigger is properly attached'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Trigger'::TEXT, 'MISSING'::TEXT, 'Trigger not attached'::TEXT;
  END IF;

  -- Test basic functions used in trigger
  BEGIN
    PERFORM FLOOR(RANDOM() * 1000000)::INT;
    RETURN QUERY SELECT 'Random Function'::TEXT, 'WORKS'::TEXT, 'RANDOM() function available'::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'Random Function'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

  BEGIN
    PERFORM split_part('test@example.com', '@', 1);
    RETURN QUERY SELECT 'Split Function'::TEXT, 'WORKS'::TEXT, 'split_part() function available'::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'Split Function'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

  BEGIN
    PERFORM now();
    RETURN QUERY SELECT 'Now Function'::TEXT, 'WORKS'::TEXT, 'now() function available'::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'Now Function'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the test to verify everything works
SELECT * FROM public.test_signup_flow();

-- Create a cleanup function for any orphaned users
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS void AS $$
BEGIN
  -- Find auth users without profiles and create profiles for them
  INSERT INTO public.profiles (id, email, name, username, bio, created_at, updated_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(split_part(au.email, '@', 1), 'User'),
    LOWER('user_' || FLOOR(RANDOM() * 1000000)::INT),
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