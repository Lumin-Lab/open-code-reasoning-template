
import { createClient } from '@supabase/supabase-js';

// Helper to read environment variables from import.meta.env (Vite) or process.env.
const readEnv = (name: string) => {
	const meta = (import.meta.env as any)[name];
	if (meta) return String(meta);
	if (typeof process !== 'undefined' && (process.env as any)[name]) return String((process.env as any)[name]);
	return undefined;
};

const isProduction = (import.meta.env.MODE === 'production') || (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');
// Support both VITE_ prefixed vars (development) and debate_agent_ prefixed vars (production).
const urlCandidates = isProduction
	? ['NEXT_PUBLIC_SUPABASE_URL', 'supabase_url']
	: ['VITE_SUPABASE_URL', 'vite_supabase_url'];




const keyCandidates = isProduction
	? ['NEXT_PUBLIC_debate_agent_SUPABASE_ANON_KEY', 'supabase_anon_key']
	: ['VITE_SUPABASE_ANON_KEY', 'vite_supabase_anon_key'];

const findFirst = (candidates: string[]) => {
	for (const n of candidates) {
		const v = readEnv(n);
		if (v) return v;
	}
	return '';
};

const supabaseUrl = findFirst(urlCandidates);
const supabaseKey = findFirst(keyCandidates);
console.log('Supabase env mode', { isProduction });
console.log('Supabase url', { supabaseUrl });
console.log('Supabase key', { supabaseKey }, 'public anon', readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));


if (!supabaseUrl || !supabaseKey) {
	// Warn but still create client (may fail at runtime). This helps local dev and CI to notice missing vars.
	console.warn('Supabase environment variables not found. Checked:', { isProduction, urlCandidates, keyCandidates });
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export default supabase;
        