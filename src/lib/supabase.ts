import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl !== 'your-project-url' && 
    supabaseAnonKey !== 'your-anon-key' &&
    supabaseUrl.includes('supabase.co') &&
    supabaseUrl.startsWith('https://')
  );
};

// Enhanced validation with better error messaging
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please click "Connect to Supabase" in the top right to set up your project.');
}

if (!isSupabaseConfigured()) {
  throw new Error('Supabase environment variables are not properly configured. Please click "Connect to Supabase" in the top right to set up your project with valid credentials.');
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

// Track connection status to avoid repeated failed attempts
let connectionStatus: 'unknown' | 'connected' | 'failed' = 'unknown';
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_DELAY = 30000; // 30 seconds

// Verify connection with better error messaging and graceful fallback
export const verifySupabaseConnection = async (): Promise<boolean> => {
  // Check configuration first
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not properly configured');
    connectionStatus = 'failed';
    return false;
  }

  // Avoid hammering the server with repeated connection attempts
  const now = Date.now();
  if (connectionStatus === 'failed' && now - lastConnectionAttempt < CONNECTION_RETRY_DELAY) {
    return false;
  }

  lastConnectionAttempt = now;

  try {
    // Use a simpler query that doesn't depend on specific tables
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('Supabase auth check failed:', error.message);
      connectionStatus = 'failed';
      return false;
    }
    
    connectionStatus = 'connected';
    return true;
  } catch (err: any) {
    console.warn('Supabase connection failed:', err.message);
    connectionStatus = 'failed';
    
    // Don't throw errors, just return false to allow graceful degradation
    return false;
  }
};

// Helper function to get connection status without throwing
export const getSupabaseConnectionStatus = async () => {
  try {
    const connected = await verifySupabaseConnection();
    return { connected, error: connected ? null : 'Unable to connect to Supabase' };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
};

// Helper function to safely execute Supabase operations
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<T>,
  fallbackValue: T
): Promise<T> => {
  try {
    const isConnected = await verifySupabaseConnection();
    if (!isConnected) {
      console.warn('Supabase not available, using fallback value');
      return fallbackValue;
    }
    return await operation();
  } catch (error) {
    console.warn('Supabase operation failed, using fallback value:', error);
    return fallbackValue;
  }
};