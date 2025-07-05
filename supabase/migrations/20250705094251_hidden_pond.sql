/*
  # Fix user_engagement foreign key reference

  1. Changes
    - Update user_engagement.user_id to reference public.users instead of auth.users
    - This allows proper joins in analytics queries

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing foreign key constraint
ALTER TABLE user_engagement DROP CONSTRAINT IF EXISTS user_engagement_user_id_fkey;

-- Add new foreign key constraint referencing public.users
ALTER TABLE user_engagement 
ADD CONSTRAINT user_engagement_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;