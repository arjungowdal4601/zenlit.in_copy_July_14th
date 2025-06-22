/*
  # Fix remaining signup issues

  1. Improvements
    - Ensure username unique constraint allows for conflicts during generation
    - Add better error handling in trigger function
    - Verify RLS policies are correct
    - Add function to check and fix any constraint issues

  2. Security
    - Maintain existing RLS policies
    - Add policy to allow authenticated users to read their own profile
*/

-- First, let's make the username generation more robust to handle potential conflicts
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_username TEXT)
RETURNS TEXT AS $$
DECLARE
  final_username TEXT;
  counter INTEGER := 1;
BEGIN
  final_username := base_username;
  
  -- Keep trying until we find a unique username
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    final_username := base_username || counter::TEXT;
    counter := counter + 1;
    
    -- Safety valve to prevent infinite loops
    IF counter > 1000 THEN
      final_username := base_username || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger function with better error handling and unique username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for user: % with email: %', NEW.id, NEW.email;
  
  -- Generate a base username from UUID (lowercase, first 8 characters)
  base_username := 'user_' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  
  -- Get a unique username
  final_username := public.generate_unique_username(base_username);
  
  -- Insert profile with comprehensive data and better error handling
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
    final_username, -- Use the unique username
    NEW.email,
    'New to Zenlit! 👋',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Update existing profile if it exists but has missing data
    name = CASE 
      WHEN profiles.name IS NULL OR profiles.name = '' 
      THEN EXCLUDED.name 
      ELSE profiles.name 
    END,
    username = CASE 
      WHEN profiles.username IS NULL OR profiles.username = '' 
      THEN EXCLUDED.username 
      ELSE profiles.username 
    END,
    email = CASE 
      WHEN profiles.email IS NULL OR profiles.email = '' 
      THEN EXCLUDED.email 
      ELSE profiles.email 
    END,
    bio = CASE 
      WHEN profiles.bio IS NULL OR profiles.bio = '' 
      THEN EXCLUDED.bio 
      ELSE profiles.bio 
    END,
    updated_at = now();
  
  RAISE LOG 'Profile created/updated successfully for user: %', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle unique constraint violations specifically
    RAISE LOG 'Unique constraint violation for user %: %', NEW.id, SQLERRM;
    -- Try with a timestamp-based username as fallback
    INSERT INTO public.profiles (id, name, username, email, bio, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(split_part(NEW.email, '@', 1), 'New User'),
      'user_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
      NEW.email,
      'New to Zenlit! 👋',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(profiles.name, EXCLUDED.name),
      username = EXCLUDED.username,
      email = COALESCE(profiles.email, EXCLUDED.email),
      bio = COALESCE(profiles.bio, EXCLUDED.bio),
      updated_at = now();
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log any other errors but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    -- Still try to create a minimal profile to prevent auth failures
    BEGIN
      INSERT INTO public.profiles (id, email, created_at)
      VALUES (NEW.id, NEW.email, now())
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Failed to create even minimal profile for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify and fix RLS policies for profiles table
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Recreate RLS policies with better specifications
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Grant comprehensive permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create a function to diagnose profile creation issues
CREATE OR REPLACE FUNCTION public.diagnose_profile_issues()
RETURNS TABLE(issue TEXT, details TEXT) AS $$
BEGIN
  -- Check if RLS is enabled
  RETURN QUERY
  SELECT 'RLS Status'::TEXT, 
         CASE WHEN relrowsecurity THEN 'Enabled' ELSE 'Disabled' END::TEXT
  FROM pg_class 
  WHERE relname = 'profiles';
  
  -- Check constraints
  RETURN QUERY
  SELECT 'Constraints'::TEXT, conname::TEXT
  FROM pg_constraint 
  WHERE conrelid = 'public.profiles'::regclass;
  
  -- Check policies
  RETURN QUERY
  SELECT 'RLS Policies'::TEXT, policyname::TEXT
  FROM pg_policies 
  WHERE tablename = 'profiles';
  
  -- Check trigger
  RETURN QUERY
  SELECT 'Triggers'::TEXT, 
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_trigger 
           WHERE tgname = 'on_auth_user_created'
         ) THEN 'Trigger exists' ELSE 'Trigger missing' END::TEXT;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a manual profile creation function for testing
CREATE OR REPLACE FUNCTION public.create_test_profile(test_email TEXT)
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  base_username TEXT;
  final_username TEXT;
BEGIN
  -- Generate a test user ID
  new_user_id := gen_random_uuid();
  
  -- Generate username
  base_username := 'test_' || LOWER(SUBSTRING(REPLACE(new_user_id::text, '-', ''), 1, 8));
  final_username := public.generate_unique_username(base_username);
  
  -- Create profile
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
    new_user_id,
    split_part(test_email, '@', 1),
    final_username,
    test_email,
    'Test user profile',
    now(),
    now()
  );
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;