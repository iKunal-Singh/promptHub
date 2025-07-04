import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please click "Connect to Supabase" in the top right to set up your project.');
}

// Create Supabase client with additional options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'prompt-management-app',
    },
  },
  // Add better error handling and retries
  db: {
    schema: 'public',
  },
});

// Verify connection with better error messaging and graceful fallback
export const verifySupabaseConnection = async () => {
  try {
    // First try to check if we can reach Supabase at all
    const { data, error } = await supabase.from('prompt_analytics').select('count').limit(1);
    
    if (error) {
      // Check if it's a table not found error (which means connection works but tables don't exist)
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.warn('Supabase connected but tables not found. Database may need to be set up.');
        return false; // Connection works but tables don't exist
      }
      
      console.error('Supabase connection error:', error);
      throw new Error('Failed to connect to Supabase. Please ensure your Supabase project is properly configured.');
    }
    
    return true;
  } catch (err: any) {
    // Handle network errors more gracefully
    if (err.name === 'TypeError' && err.message.includes('NetworkError')) {
      console.error('Network error connecting to Supabase:', err);
      throw new Error('Unable to reach Supabase. Please check your internet connection and ensure your Supabase project URL is correct.');
    }
    
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.error('Fetch error connecting to Supabase:', err);
      throw new Error('Unable to connect to Supabase. Please ensure your Supabase project is accessible and your environment variables are correct.');
    }
    
    console.error('Failed to connect to Supabase:', err);
    throw err;
  }
};

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-url' && supabaseAnonKey !== 'your-anon-key');
};

// Helper function to get connection status without throwing
export const getSupabaseConnectionStatus = async () => {
  try {
    await verifySupabaseConnection();
    return { connected: true, error: null };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
};