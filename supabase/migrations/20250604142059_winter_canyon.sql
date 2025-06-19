/*
  # Schema Enhancements
  
  1. Add soft delete support
    - Add deleted_at column to relevant tables
    - Update RLS policies to handle soft deletes
    - Add restore functions
  
  2. Improve RLS policies
    - Add helper functions for access control
    - Update existing policies for better performance
  
  3. Optimize vector search
    - Add HNSW index option for better scaling
*/

-- Add deleted_at to relevant tables
ALTER TABLE prompts 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE teams 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create helper function for prompt access control
CREATE OR REPLACE FUNCTION can_user_access_prompt(p_prompt_id uuid, p_user_id uuid)
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM prompts p
    WHERE p.id = p_prompt_id 
    AND p.deleted_at IS NULL
    AND (
      p.visibility = 'public'
      OR p.creator_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM team_members tm
        JOIN projects proj ON proj.team_id = tm.team_id
        WHERE tm.user_id = p_user_id
        AND proj.id = p.id
        AND proj.deleted_at IS NULL
      )
    )
  );
$$;

-- Update prompt RLS policies
DROP POLICY IF EXISTS "Users can read public and own prompts" ON prompts;
CREATE POLICY "Users can read public and own prompts"
  ON prompts
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND can_user_access_prompt(id, auth.uid())
  );

-- Create restore functions
CREATE OR REPLACE FUNCTION restore_prompt(p_prompt_id uuid)
RETURNS prompts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  restored_prompt prompts;
BEGIN
  IF NOT can_user_access_prompt(p_prompt_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE prompts
  SET deleted_at = NULL,
      updated_at = now()
  WHERE id = p_prompt_id
  AND deleted_at IS NOT NULL
  RETURNING * INTO restored_prompt;

  RETURN restored_prompt;
END;
$$;

-- Optimize vector search with HNSW index
DROP INDEX IF EXISTS prompt_embeddings_vector_idx;
CREATE INDEX prompt_embeddings_vector_idx 
  ON prompt_embeddings 
  USING hnsw (content_embedding vector_cosine_ops)
  WITH (
    m = 16,              -- Max number of connections per layer
    ef_construction = 64 -- Size of dynamic candidate list for construction
  );

-- Update search_prompts function to handle soft deletes
CREATE OR REPLACE FUNCTION search_prompts(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int,
  filter_categories text[] DEFAULT NULL,
  filter_models text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    1 - (pe.content_embedding <=> query_embedding) as similarity
  FROM prompts p
  JOIN prompt_embeddings pe ON p.id = pe.prompt_id
  WHERE 1 - (pe.content_embedding <=> query_embedding) > similarity_threshold
    AND p.deleted_at IS NULL
    AND (filter_categories IS NULL OR p.metadata->>'category' = ANY(filter_categories))
    AND (filter_models IS NULL OR p.metadata->>'model' = ANY(filter_models))
    AND can_user_access_prompt(p.id, auth.uid())
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;