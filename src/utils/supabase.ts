import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Real-time features (presence, signaling, chat) will be disabled.');
    // Create a no-op stub so the app still renders without crashing
    supabase = {
        channel: () => ({
            on: () => ({ on: () => ({ on: () => ({ subscribe: () => { } }) }) }),
            subscribe: () => { },
            send: () => { },
            track: () => { },
            unsubscribe: () => { },
            presenceState: () => ({}),
        }),
    } as unknown as SupabaseClient;
} else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
