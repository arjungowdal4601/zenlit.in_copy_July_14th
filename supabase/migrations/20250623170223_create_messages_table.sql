/*
  # Create messages table for user chats

  1. New Tables
    - `messages`
      - `id` uuid primary key default gen_random_uuid()
      - `sender_id` uuid references profiles(id)
      - `receiver_id` uuid references profiles(id)
      - `content` text
      - `created_at` timestamptz default now()
      - `read` boolean default false

  2. Security
    - Enable RLS on messages
    - Allow select/insert/update for sender or receiver
*/

-- Create the messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read boolean DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: allow participants to view conversation
CREATE POLICY "Participants can view messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Policy: allow participants to insert messages
CREATE POLICY "Participants can insert messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Policy: allow sender or receiver to update read status
CREATE POLICY "Participants can update messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );
