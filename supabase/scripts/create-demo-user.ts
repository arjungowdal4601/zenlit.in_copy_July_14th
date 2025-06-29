import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // Create the demo user in auth
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: 'demo@zenlit.in',
    password: 'zenlit123',
    email_confirm: true
  })
  if (userError || !userData.user) {
    throw new Error(`Failed to create auth user: ${userError?.message}`)
  }

  const demoId = userData.user.id

  // Insert profile with demo flag and social links
  const { error: profileError } = await supabase.from('profiles').insert({
    id: demoId,
    name: 'Zenlit Demo',
    username: 'demo',
    bio: 'Demo user account',
    instagram_url: 'https://instagram.com/zenlit',
    linked_in_url: 'https://linkedin.com/company/zenlit',
    is_demo: true,
    latitude: 12.9716,
    longitude: 77.5946
  })
  if (profileError) {
    throw new Error(`Failed to insert profile: ${profileError.message}`)
  }

  // Add a few demo posts
  const demoPosts = [
    { caption: 'Welcome to Zenlit!', media_url: 'https://source.unsplash.com/random/800x600?city' },
    { caption: 'Exploring the app', media_url: 'https://source.unsplash.com/random/800x600?nature' },
    { caption: 'Follow us on social media', media_url: 'https://source.unsplash.com/random/800x600?technology' }
  ]
  for (const [index, post] of demoPosts.entries()) {
    await supabase.from('posts').insert({
      user_id: demoId,
      title: `Demo Post ${index + 1}`,
      caption: post.caption,
      media_url: post.media_url
    })
  }

  console.log('Demo user created with id:', demoId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
