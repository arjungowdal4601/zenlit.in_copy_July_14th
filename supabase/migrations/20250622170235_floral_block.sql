/*
  # Simplify user creation trigger to fix signup errors

  1. Changes
    - Replace complex trigger function with minimal version
    - Remove all username generation logic from trigger
    - Only create basic profile with essential fields
    - Let application handle username setup later

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger has minimal failure points
*/

-- Create a completely simplified trigger function that only handles essential profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating basic profile for user: % with email: %', NEW.id, NEW.email;
  
  -- Insert only essential profile data to minimize failure points
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email, 
      name,
      bio,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        'New User'
      ),
      'New to Zenlit! 👋',
      now(),
      now()
    );
    
    RAISE LOG 'Basic profile created successfully for user: %', NEW.id;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail user creation
      RAISE LOG 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      
      -- Try absolute minimal profile creation as fallback
      BEGIN
        INSERT INTO public.profiles (id, email, created_at, updated_at)
        VALUES (NEW.id, NEW.email, now(), now())
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Failed to create even minimal profile for user %: %', NEW.id, SQLERRM;
          -- Don't fail user creation even if profile creation completely fails
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

-- Create a simple cleanup function for any orphaned users
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS void AS $$
BEGIN
  -- Find auth users without profiles and create minimal profiles for them
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
  
  RAISE LOG 'Cleaned up orphaned users with minimal profiles';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run cleanup for any existing orphaned users
SELECT public.cleanup_orphaned_users();