import { useQuery } from '@tanstack/react-query';
import { supabase, getSupabaseConnectionStatus } from '../lib/supabase';
import { useErrorReporting } from './useErrorReporting';

interface AnalyticsData {
  totalPrompts: number;
  totalViews: number;
  totalForks: number;
  totalUsers: number;
  recentActivity: Array<{
    id: string;
    action: string;
    prompt_title: string;
    user_email: string;
    created_at: string;
  }>;
  topPrompts: Array<{
    id: string;
    title: string;
    views: number;
    forks: number;
  }>;
  userGrowth: Array<{
    date: string;
    count: number;
  }>;
}

export const useAnalytics = () => {
  const { reportError } = useErrorReporting();

  return useQuery({
    queryKey: ['analytics'],
    queryFn: async (): Promise<AnalyticsData> => {
      try {
        // Check connection status first
        const { connected, error } = await getSupabaseConnectionStatus();
        
        if (!connected) {
          console.warn('Supabase not connected:', error);
          // Return mock data when not connected
          return {
            totalPrompts: 0,
            totalViews: 0,
            totalForks: 0,
            totalUsers: 0,
            recentActivity: [],
            topPrompts: [],
            userGrowth: []
          };
        }

        // Fetch analytics data in parallel
        const [
          promptsResult,
          analyticsResult,
          usersResult,
          activityResult,
          topPromptsResult,
          userGrowthResult
        ] = await Promise.allSettled([
          supabase.from('prompts').select('id', { count: 'exact', head: true }),
          supabase.from('prompt_analytics').select('views, forks'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase
            .from('prompt_analytics')
            .select(`
              id,
              action,
              prompts!inner(title),
              profiles!inner(email),
              created_at
            `)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('prompts')
            .select(`
              id,
              title,
              prompt_analytics!inner(views, forks)
            `)
            .order('prompt_analytics.views', { ascending: false })
            .limit(5),
          supabase.rpc('get_user_growth_data')
        ]);

        // Process results with fallbacks
        const totalPrompts = promptsResult.status === 'fulfilled' ? (promptsResult.value.count || 0) : 0;
        
        let totalViews = 0;
        let totalForks = 0;
        if (analyticsResult.status === 'fulfilled' && analyticsResult.value.data) {
          totalViews = analyticsResult.value.data.reduce((sum: number, item: any) => sum + (item.views || 0), 0);
          totalForks = analyticsResult.value.data.reduce((sum: number, item: any) => sum + (item.forks || 0), 0);
        }

        const totalUsers = usersResult.status === 'fulfilled' ? (usersResult.value.count || 0) : 0;

        const recentActivity = activityResult.status === 'fulfilled' && activityResult.value.data
          ? activityResult.value.data.map((item: any) => ({
              id: item.id,
              action: item.action,
              prompt_title: item.prompts?.title || 'Unknown',
              user_email: item.profiles?.email || 'Unknown',
              created_at: item.created_at
            }))
          : [];

        const topPrompts = topPromptsResult.status === 'fulfilled' && topPromptsResult.value.data
          ? topPromptsResult.value.data.map((item: any) => ({
              id: item.id,
              title: item.title,
              views: item.prompt_analytics?.views || 0,
              forks: item.prompt_analytics?.forks || 0
            }))
          : [];

        const userGrowth = userGrowthResult.status === 'fulfilled' && userGrowthResult.value.data
          ? userGrowthResult.value.data
          : [];

        return {
          totalPrompts,
          totalViews,
          totalForks,
          totalUsers,
          recentActivity,
          topPrompts,
          userGrowth
        };

      } catch (error: any) {
        console.error('Analytics hook error:', error);
        reportError(error, 'useAnalytics');
        
        // Return empty data instead of throwing
        return {
          totalPrompts: 0,
          totalViews: 0,
          totalForks: 0,
          totalUsers: 0,
          recentActivity: [],
          topPrompts: [],
          userGrowth: []
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on connection errors
      if (error?.message?.includes('NetworkError') || error?.message?.includes('fetch')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
  });
};