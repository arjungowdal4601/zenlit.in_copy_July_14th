/*
  # Diagnose and fix database signup issues

  1. Check Extensions
    - Verify pgcrypto and uuid-ossp extensions are enabled
    - Enable them if missing

  2. Check Functions
    - Verify gen_random_uuid() and other required functions exist
    - Test function calls

  3. Create Bulletproof Trigger
    - Remove all complex logic that could fail
    - Use only basic PostgreSQL functions
    - Ensure trigger never fails user creation

  4. Test Setup
    - Provide diagnostic functions to test the setup
*/

-- Enable required extensions (with proper error handling)
DO $$
BEGIN
  -- Enable pgcrypto extension
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    RAISE LOG 'pgcrypto extension enabled successfully';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Failed to enable pgcrypto: %', SQLERRM;
  END;

  -- Enable uuid-ossp extension
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    RAISE LOG 'uuid-ossp extension enabled successfully';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Failed to enable uuid-ossp: %', SQLERRM;
  END;
END $$;

-- Test if required functions are available
CREATE OR REPLACE FUNCTION public.test_required_functions()
RETURNS TABLE(function_name TEXT, status TEXT, error_message TEXT) AS $$
BEGIN
  -- Test gen_random_uuid()
  BEGIN
    PERFORM gen_random_uuid();
    RETURN QUERY SELECT 'gen_random_uuid()'::TEXT, 'SUCCESS'::TEXT, ''::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'gen_random_uuid()'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

  -- Test uuid_generate_v4() as alternative
  BEGIN
    PERFORM uuid_generate_v4();
    RETURN QUERY SELECT 'uuid_generate_v4()'::TEXT, 'SUCCESS'::TEXT, ''::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'uuid_generate_v4()'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

  -- Test now()
  BEGIN
    PERFORM now();
    RETURN QUERY SELECT 'now()'::TEXT, 'SUCCESS'::TEXT, ''::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'now()'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

  -- Test split_part()
  BEGIN
    PERFORM split_part('test@example.com', '@', 1);
    RETURN QUERY SELECT 'split_part()'::TEXT, 'SUCCESS'::TEXT, ''::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'split_part()'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the most basic trigger function possible (no UUID generation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Use the user ID that's already provided by Supabase Auth
  -- Don't generate any UUIDs ourselves
  
  RAISE LOG 'Trigger called for user: % with email: %', NEW.id, NEW.email;
  
  -- Try to insert basic profile
  BEGIN
    INSERT INTO public.profiles (
      id,           -- Use the ID provided by auth.users
      email,
      name,
      bio,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,       -- Don't generate, use provided ID
      NEW.email,
      COALESCE(split_part(NEW.email, '@', 1), 'User'),
      'New to Zenlit! 👋',
      CURRENT_TIMESTAMP,  -- Use CURRENT_TIMESTAMP instead of now()
      CURRENT_TIMESTAMP
    );
    
    RAISE LOG 'Profile created for user: %', NEW.id;
    
  EXCEPTION
    WHEN unique_violation THEN
      -- Profile already exists, update it
      RAISE LOG 'Profile exists, updating for user: %', NEW.id;
      UPDATE public.profiles 
      SET 
        email = NEW.email,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
      
    WHEN OTHERS THEN
      -- Log error but don't fail
      RAISE LOG 'Profile creation failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      
      -- Try absolute minimal insert
      BEGIN
        INSERT INTO public.profiles (id, email, created_at)
        VALUES (NEW.id, NEW.email, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Even minimal profile creation failed for user %: %', NEW.id, SQLERRM;
      END;
  END;
  
  -- Always return NEW to allow user creation to proceed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant all necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create a comprehensive diagnostic function
CREATE OR REPLACE FUNCTION public.diagnose_signup_issue()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Check if profiles table exists
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
      RETURN QUERY SELECT 'Profiles Table'::TEXT, 'EXISTS'::TEXT, 'Table found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Profiles Table'::TEXT, 'MISSING'::TEXT, 'Table not found'::TEXT;
    END IF;
  END;

  -- Check if trigger exists
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
      RETURN QUERY SELECT 'Trigger'::TEXT, 'EXISTS'::TEXT, 'Trigger found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Trigger'::TEXT, 'MISSING'::TEXT, 'Trigger not found'::TEXT;
    END IF;
  END;

  -- Check if trigger function exists
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
      RETURN QUERY SELECT 'Trigger Function'::TEXT, 'EXISTS'::TEXT, 'Function found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Trigger Function'::TEXT, 'MISSING'::TEXT, 'Function not found'::TEXT;
    END IF;
  END;

  -- Check extensions
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
      RETURN QUERY SELECT 'pgcrypto Extension'::TEXT, 'ENABLED'::TEXT, 'Extension found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'pgcrypto Extension'::TEXT, 'MISSING'::TEXT, 'Extension not found'::TEXT;
    END IF;
  END;

  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
      RETURN QUERY SELECT 'uuid-ossp Extension'::TEXT, 'ENABLED'::TEXT, 'Extension found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'uuid-ossp Extension'::TEXT, 'MISSING'::TEXT, 'Extension not found'::TEXT;
    END IF;
  END;

  -- Check RLS policies
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles') THEN
      RETURN QUERY SELECT 'RLS Policies'::TEXT, 'EXISTS'::TEXT, 'Policies found'::TEXT;
    ELSE
      RETURN QUERY SELECT 'RLS Policies'::TEXT, 'MISSING'::TEXT, 'No policies found'::TEXT;
    END IF;
  END;

  -- Test basic profile insertion
  BEGIN
    DECLARE
      test_id uuid := '00000000-0000-0000-0000-000000000001';
    BEGIN
      INSERT INTO public.profiles (id, email, name, created_at, updated_at)
      VALUES (test_id, 'test@example.com', 'Test User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      
      DELETE FROM public.profiles WHERE id = test_id;
      
      RETURN QUERY SELECT 'Profile Insert Test'::TEXT, 'SUCCESS'::TEXT, 'Can insert profiles'::TEXT;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN QUERY SELECT 'Profile Insert Test'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
    END;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the diagnostic
SELECT * FROM public.diagnose_signup_issue();

-- Run the function test
SELECT * FROM public.test_required_functions();

-- Create a manual test function for signup simulation
CREATE OR REPLACE FUNCTION public.simulate_user_signup(test_email TEXT)
RETURNS TABLE(step TEXT, status TEXT, message TEXT) AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Generate a test user ID (simulating what Supabase Auth would do)
  BEGIN
    new_user_id := '12345678-1234-1234-1234-123456789012'::uuid;
    RETURN QUERY SELECT 'Generate ID'::TEXT, 'SUCCESS'::TEXT, ('Generated ID: ' || new_user_id::TEXT)::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'Generate ID'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
      RETURN;
  END;

  -- Test profile creation (simulating what the trigger would do)
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
      new_user_id,
      test_email,
      split_part(test_email, '@', 1),
      'New to Zenlit! 👋',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RETURN QUERY SELECT 'Create Profile'::TEXT, 'SUCCESS'::TEXT, 'Profile created successfully'::TEXT;
    
    -- Clean up test data
    DELETE FROM public.profiles WHERE id = new_user_id;
    
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'Create Profile'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the signup simulation
SELECT * FROM public.simulate_user_signup('test@example.com');