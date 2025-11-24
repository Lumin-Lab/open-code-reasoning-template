/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly NEXT_PUBLIC_DEBATE_SUPABASE_URL: string
  readonly NEXT_PUBLIC_DEBATE_SUPABASE_ANON_KEY: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
