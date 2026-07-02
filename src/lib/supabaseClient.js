import { createClient } from '@supabase/supabase-js'

// .env で管理しているSupabaseのProject URLとPublishable keyを読み込む
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabaseの環境変数が設定されていません。.envファイルを確認してください。',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
