import { createClient } from '@supabase/supabase-js'

// Ensure environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Add debugging information
console.log('🔧 Supabase Configuration Debug:')
console.log('URL:', supabaseUrl ? 'Set' : 'Missing')
console.log('Anon Key:', supabaseAnonKey ? 'Set' : 'Missing')

// Validate environment variables and provide helpful error messages
if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.')
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.')
}

if (!supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.')
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.')
}

// Log the actual URLs for debugging (safe to log URL, not keys)
console.log('🌐 Connecting to Supabase at:', supabaseUrl)

// Create client with enhanced session management
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce' // Use PKCE flow for better security
  },
  global: {
    headers: {
      'X-Client-Info': 'zenlit-web'
    }
  }
})

// Enhanced session management
export const ensureSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Session check error:', error)
      return { success: false, error: error.message }
    }

    if (!session) {
      return { success: false, error: 'No active session' }
    }

    // Check if session is expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      console.log('Session expired, attempting refresh...')
      
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !refreshData.session) {
        console.error('Session refresh failed:', refreshError)
        await supabase.auth.signOut()
        return { success: false, error: 'Session expired and refresh failed' }
      }

      console.log('Session refreshed successfully')
      return { success: true, session: refreshData.session }
    }

    return { success: true, session }
  } catch (error) {
    console.error('Session ensure error:', error)
    return { success: false, error: 'Failed to check session' }
  }
}

// Listen for auth state changes
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session?.user?.id)
    callback(event, session)
  })
}

export type { User } from '@supabase/supabase-js'