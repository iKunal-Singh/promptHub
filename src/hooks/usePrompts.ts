import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';
import { diff_match_patch } from 'diff-match-patch';

export interface Prompt {
  id: string;
  title: string;
  body: string;
  tags: Array<{ id: string; name: string }>; // Updated tags type
  metadata: Record<string, any>;
  creator_id: string;
  status: 'draft' | 'active' | 'deprecated';
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
  forked_from?: string;
  fork_version?: number;
  creator?: {
    email: string;
  };
}

interface SearchFilters {
  visibility?: 'public' | 'private';
  search?: string;
  category?: string;
  model?: string;
  sort?: {
    field: 'usage' | 'rating' | 'created_at';
    direction: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
}

export function usePrompts(filters?: SearchFilters) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: prompts,
    isLoading,
    error
  } = useQuery({
    queryKey: ['prompts', filters, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('prompts')
        .select(`
          id, title, body, metadata, creator_id, status, visibility, created_at, updated_at, forked_from, fork_version,
          creator:creator_id(email),
          prompt_tags!left(tags!inner(id, name))
        `);

      if (filters?.visibility) {
        query = query.eq('visibility', filters.visibility);
      }

      if (filters?.search) {
        query = query.textSearch('title', filters.search);
      }

      if (filters?.sort) {
        query = query.order(filters.sort.field, {
          ascending: filters.sort.direction === 'asc'
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Transform tags data
      return data.map(p => ({
        ...p,
        tags: p.prompt_tags ? p.prompt_tags.map((pt: any) => pt.tags).filter(Boolean) : [],
      }));
    },
    enabled: !!user
  });

  const createPrompt = useMutation({
    mutationFn: async (newPrompt: Partial<Omit<Prompt, 'tags'> & { tags?: Array<{ name: string }> }>) => {
      if (!user) throw new Error('User must be authenticated');

      const { tags: newTags, ...promptFields } = newPrompt;

      const promptData = {
        ...promptFields,
        creator_id: user.id,
        status: newPrompt.status || 'draft',
        visibility: newPrompt.visibility || 'private',
      };

      // 1. Create the prompt entry
      const { data: createdPrompt, error: promptError } = await supabase
        .from('prompts')
        .insert(promptData)
        .select()
        .single();

      if (promptError) throw promptError;
      if (!createdPrompt) throw new Error('Prompt creation failed');

      // 2. Handle tags
      const createdTagObjects: Array<{ id: string; name: string }> = [];
      if (newTags && newTags.length > 0) {
        for (const tagInput of newTags) {
          const { data: tagData, error: tagUpsertError } = await supabase
            .from('tags')
            .upsert({ name: tagInput.name }, { onConflict: 'name' })
            .select('id, name')
            .single();

          if (tagUpsertError) {
            console.error('Error upserting tag:', tagUpsertError);
            // Decide if this should throw or collect errors
            continue;
          }
          if (tagData) {
            createdTagObjects.push(tagData);
            const { error: promptTagError } = await supabase
              .from('prompt_tags')
              .insert({ prompt_id: createdPrompt.id, tag_id: tagData.id });
            if (promptTagError) {
              console.error('Error creating prompt_tag link:', promptTagError);
              // Decide if this should throw or collect errors
            }
          }
        }
      }

      // 3. Create initial version (assuming body is part of promptFields if provided)
      // Ensure createdPrompt.body is available for versioning.
      // If 'body' is not guaranteed in promptFields, this needs adjustment.
      const bodyForVersion = (promptFields.body as string | undefined) || '';
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: createdPrompt.id,
          content: bodyForVersion, // Use the extracted body
          version_number: 1,
          is_latest: true,
          change_log: 'Initial version.',
          metadata: {},
        });

      if (versionError) {
        console.error('Failed to create initial prompt version:', versionError);
        toast.error('Prompt created, but failed to create initial version.');
      }
      
      // Return the prompt with the processed tags
      return { ...createdPrompt, tags: createdTagObjects };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['prompt', data.id] });
        queryClient.invalidateQueries({ queryKey: ['versions', data.id] });
      }
    },
  });

  const updatePrompt = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<Prompt, 'tags'>> & { id: string; tags?: Array<{ name: string }> }) => {
      if (!user) throw new Error('User must be authenticated');

      const { tags: newTags, ...promptFieldsToUpdate } = updates;

      // 1. Update scalar fields in the prompts table
      // Ensure promptFieldsToUpdate is not empty if only tags are being updated.
      // If promptFieldsToUpdate might be empty, Supabase might error.
      // However, usually an update implies some field changed, or it's just a tag update.
      let updatedPromptData = null;
      if (Object.keys(promptFieldsToUpdate).length > 0) {
        const { data, error: promptUpdateError } = await supabase
          .from('prompts')
          .update(promptFieldsToUpdate)
          .eq('id', id)
          .select() // Select the updated prompt data
          .single();
        if (promptUpdateError) throw promptUpdateError;
        updatedPromptData = data;
      } else {
        // If only tags are updated, fetch the prompt data to return later
        const { data, error: fetchError } = await supabase.from('prompts').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;
        updatedPromptData = data;
      }
      
      if (!updatedPromptData) throw new Error("Failed to retrieve prompt data during update.");

      // 2. Handle tags if 'newTags' is provided in the updates
      let processedTags: Array<{ id: string; name: string }> | undefined = undefined;
      if (newTags !== undefined) {
        processedTags = [];
        // Delete existing tag associations
        const { error: deleteError } = await supabase
          .from('prompt_tags')
          .delete()
          .eq('prompt_id', id);

        if (deleteError) {
          console.error('Error deleting old prompt_tags:', deleteError);
          // Decide if this should throw
          toast.error('Error clearing old tags. Tag update may be incomplete.');
        }

        if (newTags.length > 0) {
          for (const tagInput of newTags) {
            const { data: tagData, error: tagUpsertError } = await supabase
              .from('tags')
              .upsert({ name: tagInput.name }, { onConflict: 'name' })
              .select('id, name')
              .single();

            if (tagUpsertError) {
              console.error('Error upserting tag:', tagUpsertError);
              continue;
            }
            if (tagData) {
              processedTags.push(tagData);
              const { error: promptTagError } = await supabase
                .from('prompt_tags')
                .insert({ prompt_id: id, tag_id: tagData.id });
              if (promptTagError) {
                console.error('Error creating prompt_tag link:', promptTagError);
              }
            }
          }
        }
      }

      // 3. Versioning logic (if body changed)
      // This part relies on promptFieldsToUpdate.body and updatedPromptData.body
      const bodyForComparison = (await supabase.from('prompts').select('body').eq('id', id).single()).data?.body;
      const newBody = promptFieldsToUpdate.body as string | undefined;

      if (newBody && bodyForComparison && newBody !== bodyForComparison) {
        const dmp = new diff_match_patch();
        const diffs = dmp.diff_main(bodyForComparison, newBody);
        dmp.diff_cleanupSemantic(diffs);
        const additions = diffs.filter(d => d[0] === 1).length;
        const deletions = diffs.filter(d => d[0] === -1).length;
        const change_log = `Updated body. ${additions} additions, ${deletions} deletions.`;

        const { data: latestVersion, error: latestVersionError } = await supabase
          .from('prompt_versions')
          .select('id, version_number')
          .eq('prompt_id', id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        if (latestVersionError && latestVersionError.code !== 'PGRST116') {
          console.error('Error fetching latest version:', latestVersionError);
        }

        const newVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

        const { error: createVersionError } = await supabase
          .from('prompt_versions')
          .insert({
            prompt_id: id,
            content: newBody, // Use newBody for version content
            version_number: newVersionNumber,
            is_latest: true,
            change_log: change_log,
            parent_version_id: latestVersion?.id,
            metadata: {},
          });

        if (createVersionError) {
          console.error('Failed to create new prompt version:', createVersionError);
          toast.error('Prompt updated, but failed to create new version.');
        } else {
          if (latestVersion) {
            await supabase.from('prompt_versions').update({ is_latest: false }).eq('id', latestVersion.id);
          }
          queryClient.invalidateQueries({ queryKey: ['versions', id] });
        }
      }

      // Return the updated prompt data, potentially with newly processed tags
      // If tags were not part of the update, they are not included here unless we re-fetch.
      // For consistency, it's often better to let invalidation handle complete refetch.
      return {
        ...updatedPromptData,
        tags: processedTags !== undefined ? processedTags : (updatedPromptData as Prompt).tags /* keep old tags if not updated */
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['prompt', data.id] });
      }
    }
  });

  const forkPrompt = useMutation({
    mutationFn: async ({ promptId, title }: { promptId: string; title?: string }) => {
      if (!user) throw new Error('User must be authenticated');

      const { data: originalPromptData, error: fetchError } = await supabase
        .from('prompts')
        .select(`*, prompt_tags!left(tags!inner(id, name))`) // Fetch original prompt with its tags
        .eq('id', promptId)
        .single();

      if (fetchError) throw fetchError;
      if (!originalPromptData) throw new Error('Original prompt not found for forking.');

      const originalPrompt = { // Transform tags for the original prompt
        ...originalPromptData,
        tags: originalPromptData.prompt_tags ? originalPromptData.prompt_tags.map((pt: any) => pt.tags).filter(Boolean) : [],
      };

      // 1. Create the new prompt entry (main data)
      const { data: forkedPrompt, error: forkError } = await supabase
        .from('prompts')
        .insert({
          title: title || `${originalPrompt.title} (Fork)`,
          body: originalPrompt.body,
          // Do not include 'tags' here directly; it will be handled by prompt_tags
          metadata: originalPrompt.metadata,
          creator_id: user.id,
          status: 'draft',
          visibility: 'private',
          forked_from: promptId,
          // fork_version: originalPrompt.fork_version ? originalPrompt.fork_version + 1 : 1, // Or handle versioning differently
        })
        .select()
        .single();

      if (forkError) throw forkError;
      if (!forkedPrompt) throw new Error('Failed to create forked prompt entry.');

      // 2. Handle tags for the forked prompt
      const forkedTagObjects: Array<{ id: string; name: string }> = [];
      if (originalPrompt.tags && originalPrompt.tags.length > 0) {
        for (const tag of originalPrompt.tags) {
          // Tags from original prompt already exist, so we use their IDs
          const { error: promptTagError } = await supabase
            .from('prompt_tags')
            .insert({ prompt_id: forkedPrompt.id, tag_id: tag.id });
          if (promptTagError) {
            console.error('Error linking tag to forked prompt:', promptTagError);
          } else {
            forkedTagObjects.push(tag); // Keep track of successfully linked tags
          }
        }
      }

      // 3. Create initial version for the forked prompt
      const { error: versionError } = await supabase.from('prompt_versions').insert({
        prompt_id: forkedPrompt.id,
        content: forkedPrompt.body,
        version_number: 1,
        is_latest: true,
        change_log: 'Initial version (forked).',
        metadata: {},
      });
      if (versionError) {
        console.error('Failed to create initial version for forked prompt:', versionError);
        toast.error('Fork created, but failed to create initial version.');
      }

      return { ...forkedPrompt, tags: forkedTagObjects };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast.success('Prompt forked successfully');
    }
  });

  return {
    prompts,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    forkPrompt
  };
}