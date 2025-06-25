import { supabase } from '../lib/supabase'

export const testSupabaseConnection = async () => {
  console.log('🧪 Testing Supabase Connection...')
  
  try {
    // Test 1: Basic connection
    console.log('📡 Testing basic connection...')
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    
    if (error) {
      console.error('❌ Basic connection failed:', error.message)
      return {
        success: false,
        error: `Connection failed: ${error.message}`,
        details: error
      }
    }
    
    console.log('✅ Basic connection successful')
    
    // Test 2: Auth service
    console.log('🔐 Testing auth service...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.log('ℹ️ No authenticated user (this is normal if not logged in)')
    } else {
      console.log('✅ Auth service working, user:', user?.id || 'No user')
    }
    
    // Test 3: Database access
    console.log('🗄️ Testing database access...')
    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('id, name')
      .limit(5)
    
    if (dbError) {
      console.error('❌ Database access failed:', dbError.message)
      return {
        success: false,
        error: `Database access failed: ${dbError.message}`,
        details: dbError
      }
    }
    
    console.log('✅ Database access successful, found', profiles?.length || 0, 'profiles')
    
    return {
      success: true,
      message: 'All Supabase services are working correctly',
      profileCount: profiles?.length || 0
    }
    
  } catch (error) {
    console.error('❌ Connection test failed with exception:', error)
    return {
      success: false,
      error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    }
  }
}

// Helper function to check environment variables
export const checkEnvironmentVariables = () => {
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
  }
  
  console.log('🔧 Environment Variables Check:', checks)
  return checks
}