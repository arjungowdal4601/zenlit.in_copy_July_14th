/*
  # Add demo account flag to profiles

  1. Add `is_demo` boolean column to profiles table
  2. Default value is false
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
