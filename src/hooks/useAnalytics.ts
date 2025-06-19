import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, verifySupabaseConnection } from '../lib/supabase';
import { startOfDay, subDays, format } from 'date-fns';

export interface AnalyticsData {
  totalUsage: number;
  tokensUsed: number;
  estimatedCost: number;
  avgResponseTime: number;
  historicalData: {
    date: string;
    usage: number;
    tokens: number;
  }[];
  modelPerformance: {
    model: string;
    usage: number;
    tokens: number;
    avgTime: number;
    cost: number;
  }[];
  engagement: {
    views: number;
    likes: number;
    shares: number;
    comments: number;
    uniqueUsers: number;
  };
  topPrompts: {
    id: string;
    title: string;
    usage: number;
    engagement: number;
  }[];
  categoryDistribution: {
    category: string;
    count: number;
  }[];
  userActivity: {
    hour: number;
    count: number;
  }[];
}

export function useAnalytics(days: number = 30) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['analytics', days],
    queryFn: async (): Promise<AnalyticsData> => {
      try {
        await verifySupabaseConnection();
        
        const startDate = startOfDay(subDays(new Date(), days));
        
        const [
          analyticsResult,
          tokenResult,
          executionResult,
          engagementResult,
          promptsResult,
          categoryResult
        ] = await Promise.all([
          supabase.from('prompt_analytics').select('*').gte('date', startDate.toISOString()),
          supabase.from('token_usage_logs').select('*').gte('created_at', startDate.toISOString()),
          supabase.from('prompt_executions').select('*').gte('created_at', startDate.toISOString()),
          supabase.from('user_engagement').select('*').gte('created_at', startDate.toISOString()),
          supabase.from('prompts').select('id, title'),
          supabase.from('prompt_search_index').select('category').not('category', 'is', null)
        ]);

        if (analyticsResult.error) throw analyticsResult.error;
        if (tokenResult.error) throw tokenResult.error;
        if (executionResult.error) throw executionResult.error;
        if (engagementResult.error) throw engagementResult.error;
        if (promptsResult.error) throw promptsResult.error;
        if (categoryResult.error) throw categoryResult.error;

        const analyticsData = analyticsResult.data;
        const tokenData = tokenResult.data;
        const executionData = executionResult.data;
        const engagementData = engagementResult.data;
        const promptsData = promptsResult.data;
        const categoryData = categoryResult.data;

        // Calculate total usage metrics
        const totalUsage = analyticsData?.reduce((sum, day) => sum + (day.views || 0), 0) || 0;
        const tokensUsed = tokenData?.reduce((sum, log) => sum + log.token_count, 0) || 0;
        const avgResponseTime = executionData?.reduce((sum, exec) => sum + (exec.runtime_stats?.duration_ms || 0), 0) / (executionData?.length || 1);

        // Calculate cost (example rate: $0.002 per 1000 tokens)
        const estimatedCost = (tokensUsed / 1000) * 0.002;

        // Process historical data
        const historicalData = Array.from({ length: days }, (_, i) => {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
          const dayAnalytics = analyticsData?.find(d => format(new Date(d.date), 'yyyy-MM-dd') === date);
          const dayTokens = tokenData?.filter(t => 
            format(new Date(t.created_at), 'yyyy-MM-dd') === date
          ).reduce((sum, t) => sum + t.token_count, 0);

          return {
            date,
            usage: dayAnalytics?.views || 0,
            tokens: dayTokens || 0
          };
        }).reverse();

        // Calculate model performance
        const modelPerformance = Object.entries(
          executionData?.reduce((acc, exec) => {
            const model = exec.model;
            if (!acc[model]) {
              acc[model] = {
                usage: 0,
                tokens: 0,
                totalTime: 0,
                count: 0
              };
            }
            acc[model].usage++;
            acc[model].tokens += exec.runtime_stats?.token_count || 0;
            acc[model].totalTime += exec.runtime_stats?.duration_ms || 0;
            acc[model].count++;
            return acc;
          }, {} as Record<string, any>) || {}
        ).map(([model, stats]) => ({
          model,
          usage: stats.usage,
          tokens: stats.tokens,
          avgTime: stats.totalTime / stats.count,
          cost: (stats.tokens / 1000) * 0.002
        }));

        // Calculate engagement metrics
        const engagement = {
          views: engagementData?.filter(e => e.action_type === 'view').length || 0,
          likes: engagementData?.filter(e => e.action_type === 'like').length || 0,
          shares: engagementData?.filter(e => e.action_type === 'share').length || 0,
          comments: engagementData?.filter(e => e.action_type === 'comment').length || 0,
          uniqueUsers: new Set(engagementData?.map(e => e.user_id)).size || 0
        };

        // Calculate usage and engagement for each prompt
        const promptStats = promptsData?.map(prompt => {
          const promptEngagement = engagementData?.filter(e => e.prompt_id === prompt.id) || [];
          const usage = promptEngagement.length;
          const engagement = promptEngagement.filter(e => 
            ['like', 'share', 'comment'].includes(e.action_type)
          ).length;

          return {
            ...prompt,
            usage,
            engagement
          };
        }) || [];

        // Sort by usage and get top 5
        const topPrompts = promptStats
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 5);

        // Calculate user activity by hour
        const userActivity = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: engagementData?.filter(e => 
            new Date(e.created_at).getHours() === hour
          ).length || 0
        }));

        // Calculate category distribution
        const categoryDistribution = Object.entries(
          categoryData?.reduce((acc, { category }) => {
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {}
        ).map(([category, count]) => ({
          category,
          count
        }));

        return {
          totalUsage,
          tokensUsed,
          estimatedCost,
          avgResponseTime,
          historicalData,
          modelPerformance,
          engagement,
          topPrompts,
          categoryDistribution,
          userActivity
        };
      } catch (error) {
        console.error('Analytics hook error:', error);
        throw error;
      }
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const recordEngagement = useMutation({
    mutationFn: async ({ promptId, actionType }: { promptId: string; actionType: string }) => {
      const { error } = await supabase
        .rpc('record_engagement', {
          p_prompt_id: promptId,
          p_action_type: actionType
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    recordEngagement
  };
}