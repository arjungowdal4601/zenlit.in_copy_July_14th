import type { User } from '@supabase/supabase-js'

export const isDemoUser = (user: User | null) => {
  return user?.email === 'demo@zenlit.in'
}
