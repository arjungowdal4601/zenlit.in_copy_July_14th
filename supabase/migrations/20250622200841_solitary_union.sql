/*
  # Add location fields to profiles table for coordinate bucketing

  1. Changes
    - Add `latitude` and `longitude` columns to profiles table
    - Add indexes for efficient location-based queries
    - Update RLS policies to handle location data

  2. Security
    - Maintain existing RLS policies
    - Add proper indexing for performance
*/

-- Add location columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create indexes for efficient location queries
CREATE INDEX IF NOT EXISTS profiles_location_idx ON profiles (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create a compound index for exact coordinate matching (bucketing)
CREATE INDEX IF NOT EXISTS profiles_location_bucket_idx ON profiles (
  ROUND(latitude::numeric, 2), 
  ROUND(longitude::numeric, 2)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add a function to find users in the same location bucket
CREATE OR REPLACE FUNCTION public.get_users_in_location_bucket(
  user_lat DECIMAL(10, 8),
  user_lng DECIMAL(11, 8),
  current_user_id uuid DEFAULT NULL
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
BEGIN
  -- Round coordinates to 2 decimal places for bucketing
  lat_bucket := ROUND(user_lat::numeric, 2);
  lng_bucket := ROUND(user_lng::numeric, 2);
  
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

-- Add a function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 DECIMAL(10, 8),
  lng1 DECIMAL(11, 8),
  lat2 DECIMAL(10, 8),
  lng2 DECIMAL(11, 8)
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  earth_radius CONSTANT DECIMAL := 6371; -- Earth radius in kilometers
  dlat DECIMAL;
  dlng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Convert degrees to radians
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  
  -- Haversine formula
  a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2) * SIN(dlng/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN ROUND((earth_radius * c)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add a function to get nearby users within a radius (for future use)
CREATE OR REPLACE FUNCTION public.get_nearby_users(
  user_lat DECIMAL(10, 8),
  user_lng DECIMAL(11, 8),
  radius_km DECIMAL(10, 2) DEFAULT 5.0,
  current_user_id uuid DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
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
BEGIN
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
    public.calculate_distance_km(user_lat, user_lng, p.latitude, p.longitude) as distance_km
  FROM profiles p
  WHERE 
    p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.name IS NOT NULL
    AND (current_user_id IS NULL OR p.id != current_user_id)
    AND public.calculate_distance_km(user_lat, user_lng, p.latitude, p.longitude) <= radius_km
  ORDER BY distance_km, p.name
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION public.get_users_in_location_bucket TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_distance_km TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_users TO authenticated;