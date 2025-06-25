-- Add location_last_updated_at column and optional indexes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_last_updated_at timestamptz;

-- Update trigger to maintain location_last_updated_at if location updated
-- (No direct triggers defined here; frontend should update column)
