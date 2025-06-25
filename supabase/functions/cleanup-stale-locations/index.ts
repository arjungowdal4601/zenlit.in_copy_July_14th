import { createClient } from '@supabase/supabase-js'

// Edge function to clear stale location data
export const handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({ latitude: null, longitude: null, location_last_updated_at: null })
    .lt('location_last_updated_at', cutoff)
    .not('location_last_updated_at', 'is', null)

  if (error) {
    console.error('Cleanup error:', error.message)
  } else {
    console.log('Stale locations cleared')
  }
}
