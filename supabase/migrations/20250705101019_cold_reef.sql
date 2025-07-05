/*
  # Fix Analytics Schema Issues

  1. New Tables
    - Ensure `users` table exists with proper structure
    - Ensure `prompts` table exists with proper structure  
    - Ensure `user_engagement` table exists with proper foreign keys
    - Ensure `prompt_analytics` table exists for tracking views

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for authenticated users

  3. Changes
    - Fix foreign key relationships for analytics queries
    - Add missing columns and constraints
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prompts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prompt_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.prompt_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE,
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_engagement table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Drop existing foreign key constraints if they exist
ALTER TABLE user_engagement DROP CONSTRAINT IF EXISTS user_engagement_user_id_fkey;
ALTER TABLE user_engagement DROP CONSTRAINT IF EXISTS user_engagement_prompt_id_fkey;

-- Add proper foreign key constraints
ALTER TABLE user_engagement 
ADD CONSTRAINT user_engagement_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE user_engagement 
ADD CONSTRAINT user_engagement_prompt_id_fkey 
FOREIGN KEY (prompt_id) REFERENCES public.prompts(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Public prompts are viewable by everyone" ON public.prompts;
DROP POLICY IF EXISTS "Users can manage own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Analytics are viewable by everyone" ON public.prompt_analytics;
DROP POLICY IF EXISTS "Users can manage analytics for own prompts" ON public.prompt_analytics;
DROP POLICY IF EXISTS "Users can read all engagement data" ON public.user_engagement;
DROP POLICY IF EXISTS "Users can create engagement records" ON public.user_engagement;

-- Create RLS policies for users table
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create RLS policies for prompts table
CREATE POLICY "Public prompts are viewable by everyone"
  ON public.prompts
  FOR SELECT
  TO authenticated
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can manage own prompts"
  ON public.prompts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create RLS policies for prompt_analytics table
CREATE POLICY "Analytics are viewable by everyone"
  ON public.prompt_analytics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage analytics for own prompts"
  ON public.prompt_analytics
  FOR ALL
  TO authenticated
  USING (
    prompt_id IN (
      SELECT id FROM public.prompts WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for user_engagement table
CREATE POLICY "Users can read all engagement data"
  ON public.user_engagement
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create engagement records"
  ON public.user_engagement
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_public ON public.prompts(is_public);
CREATE INDEX IF NOT EXISTS idx_prompt_analytics_prompt_id ON public.prompt_analytics(prompt_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON public.user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_prompt_id ON public.user_engagement(prompt_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_created_at ON public.user_engagement(created_at);

-- Insert some sample data if tables are empty (for development)
DO $$
BEGIN
  -- Only insert if users table is empty
  IF NOT EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN
    INSERT INTO public.users (id, email, full_name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'demo@example.com', 'Demo User');
  END IF;

  -- Only insert if prompts table is empty
  IF NOT EXISTS (SELECT 1 FROM public.prompts LIMIT 1) THEN
    INSERT INTO public.prompts (id, title, content, description, user_id, is_public) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Sample Prompt', 'This is a sample prompt for testing.', 'A demo prompt', '00000000-0000-0000-0000-000000000001', true);
  END IF;

  -- Only insert if prompt_analytics table is empty
  IF NOT EXISTS (SELECT 1 FROM public.prompt_analytics LIMIT 1) THEN
    INSERT INTO public.prompt_analytics (prompt_id, views) VALUES
    ('00000000-0000-0000-0000-000000000001', 42);
  END IF;

  -- Only insert if user_engagement table is empty
  IF NOT EXISTS (SELECT 1 FROM public.user_engagement LIMIT 1) THEN
    INSERT INTO public.user_engagement (user_id, prompt_id, action_type) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'view');
  END IF;
END $$;