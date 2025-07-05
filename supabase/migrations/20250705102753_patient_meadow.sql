/*
  # Add Foreign Key Constraint to user_engagement Table
  
  This migration adds the missing foreign key constraint between the user_engagement
  table and the auth.users table, which is required for Supabase to properly
  join these tables in queries.
  
  Changes:
  - Add foreign key constraint from user_engagement.user_id to auth.users.id
  - Include CASCADE delete to maintain data integrity
*/

-- Add the foreign key constraint to link user_engagement to auth.users
ALTER TABLE "public"."user_engagement"
ADD CONSTRAINT "user_engagement_user_id_fkey"
FOREIGN KEY (user_id) REFERENCES "auth"."users" (id)
ON DELETE CASCADE;