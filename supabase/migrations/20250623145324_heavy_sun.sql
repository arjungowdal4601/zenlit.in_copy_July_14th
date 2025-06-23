/*
  # Debug and fix location matching issues

  1. Improvements
    - Add debug logging to RPC function
    - Fix parameter order in RPC function
    - Add better coordinate matching logic
    - Create test functions to verify matching works

  2. Security
    - Maintain existing RLS policies
    - Ensure functions have proper permissions
*/

-- Drop and recreate the RPC function with correct parameter order and debug logging
DROP FUNCTION IF EXISTS public.get_users_in_location_bucket(DECIMAL, DECIMAL, uuid);
DROP FUNCTION IF EXISTS public.get_users_in_location_bucket(uuid, DECIMAL, DECIMAL);

-- Create the RPC function with correct parameter order and debug logging
CREATE OR REPLACE FUNCTION public.get_users_in_location_bucket(
  current_user_id uuid,
  user_lat DECIMAL(10, 8),
  user_lng DECIMAL(11, 8)
)
RETURNS TABLE(
  id uuid,
  name text,
  username text,
  email text,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  instagram_url text,
  linked_in_url text,
  twitter_url text,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_km DECIMAL(10, 2)
) AS $$
DECLARE
  lat_bucket DECIMAL(10, 2);
  lng_bucket DECIMAL(11, 2);
  user_count INTEGER;
BEGIN
  -- Round coordinates to 2 decimal places for bucketing
  lat_bucket := ROUND(user_lat::numeric, 2);
  lng_bucket := ROUND(user_lng::numeric, 2);
  
  -- Log the search parameters
  RAISE LOG 'Searching for users in bucket: lat=%, lng=%, excluding user=%', lat_bucket, lng_bucket, current_user_id;
  
  -- Count total users with location data
  SELECT COUNT(*) INTO user_count
  FROM profiles p
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL;
  
  RAISE LOG 'Total users with location data: %', user_count;
  
  -- Count users in the same bucket
  SELECT COUNT(*) INTO user_count
  FROM profiles p
  WHERE ROUND(p.latitude::numeric, 2) = lat_bucket
    AND ROUND(p.longitude::numeric, 2) = lng_bucket
    AND p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL
    AND (current_user_id IS NULL OR p.id != current_user_id);
  
  RAISE LOG 'Users in same bucket (lat=%, lng=%): %', lat_bucket, lng_bucket, user_count;
  
  -- Return the actual query results
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.username,
    p.email,
    p.bio,
    p.profile_photo_url,
    p.cover_photo_url,
    p.instagram_url,
    p.linked_in_url,
    p.twitter_url,
    p.latitude,
    p.longitude,
    0.0::DECIMAL(10, 2) as distance_km -- All users in same bucket have distance 0
  FROM profiles p
  WHERE 
    ROUND(p.latitude::numeric, 2) = lat_bucket
    AND ROUND(p.longitude::numeric, 2) = lng_bucket
    AND p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL
    AND (current_user_id IS NULL OR p.id != current_user_id)
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a test function to debug coordinate matching
CREATE OR REPLACE FUNCTION public.debug_location_matching(
  test_lat DECIMAL(10, 8),
  test_lng DECIMAL(11, 8)
)
RETURNS TABLE(
  debug_info text,
  user_id uuid,
  user_name text,
  user_lat DECIMAL(10, 8),
  user_lng DECIMAL(11, 8),
  lat_rounded DECIMAL(10, 2),
  lng_rounded DECIMAL(11, 2),
  matches_bucket boolean
) AS $$
DECLARE
  target_lat_bucket DECIMAL(10, 2);
  target_lng_bucket DECIMAL(11, 2);
BEGIN
  -- Calculate target bucket
  target_lat_bucket := ROUND(test_lat::numeric, 2);
  target_lng_bucket := ROUND(test_lng::numeric, 2);
  
  -- Return debug info for all users with location data
  RETURN QUERY
  SELECT 
    ('Target bucket: ' || target_lat_bucket || ', ' || target_lng_bucket)::text as debug_info,
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    ROUND(p.latitude::numeric, 2) as lat_rounded,
    ROUND(p.longitude::numeric, 2) as lng_rounded,
    (ROUND(p.latitude::numeric, 2) = target_lat_bucket AND ROUND(p.longitude::numeric, 2) = target_lng_bucket) as matches_bucket
  FROM profiles p
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL
  ORDER BY matches_bucket DESC, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple test function to verify coordinate rounding
CREATE OR REPLACE FUNCTION public.test_coordinate_rounding()
RETURNS TABLE(
  test_case text,
  original_lat DECIMAL(10, 8),
  original_lng DECIMAL(11, 8),
  rounded_lat DECIMAL(10, 2),
  rounded_lng DECIMAL(11, 2)
) AS $$
BEGIN
  -- Test various coordinate values
  RETURN QUERY
  SELECT 
    'Test 1'::text,
    37.7749::DECIMAL(10, 8),
    -122.4194::DECIMAL(11, 8),
    ROUND(37.7749::numeric, 2)::DECIMAL(10, 2),
    ROUND(-122.4194::numeric, 2)::DECIMAL(11, 2)
  UNION ALL
  SELECT 
    'Test 2'::text,
    37.77::DECIMAL(10, 8),
    -122.42::DECIMAL(11, 8),
    ROUND(37.77::numeric, 2)::DECIMAL(10, 2),
    ROUND(-122.42::numeric, 2)::DECIMAL(11, 2)
  UNION ALL
  SELECT 
    'Test 3'::text,
    37.774999::DECIMAL(10, 8),
    -122.419999::DECIMAL(11, 8),
    ROUND(37.774999::numeric, 2)::DECIMAL(10, 2),
    ROUND(-122.419999::numeric, 2)::DECIMAL(11, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION public.get_users_in_location_bucket TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_location_matching TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coordinate_rounding TO authenticated;

-- Create a function to show all users with their rounded coordinates
CREATE OR REPLACE FUNCTION public.show_all_user_locations()
RETURNS TABLE(
  user_id uuid,
  user_name text,
  original_lat DECIMAL(10, 8),
  original_lng DECIMAL(11, 8),
  rounded_lat DECIMAL(10, 2),
  rounded_lng DECIMAL(11, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    ROUND(p.latitude::numeric, 2)::DECIMAL(10, 2),
    ROUND(p.longitude::numeric, 2)::DECIMAL(11, 2)
  FROM profiles p
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL
  ORDER BY ROUND(p.latitude::numeric, 2), ROUND(p.longitude::numeric, 2), p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission for the show function
GRANT EXECUTE ON FUNCTION public.show_all_user_locations TO authenticated;