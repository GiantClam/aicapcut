import { createClient } from '@supabase/supabase-js'

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly NEXT_PUBLIC_SUPABASE_URL: string
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

const getEnv = (name: string) => {
    const val = process.env[name];
    if (!val || typeof val !== 'string' || val === 'undefined' || val === 'null' || val.trim() === '') {
        return undefined;
    }
    return val;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://placeholder.supabase.co'
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'placeholder'

console.log('[Supabase Init] URL:', supabaseUrl)

// Final safety check to satisfy TypeScript and prevent library errors
if (!supabaseUrl || typeof supabaseUrl !== 'string') {
    throw new Error('Critical: supabaseUrl is invalid even after fallback!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
