import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://mswmridpidhqqlxnxhlt.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zd21yaWRwaWRocXFseG54aGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc2MjUsImV4cCI6MjA5Mzg2MzYyNX0.njAP240jTC1NEQ21NL1u6ubTWvczooWi-AVGiKmiKtA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
