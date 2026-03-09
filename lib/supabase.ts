import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// SUBSTITUA AQUI COM OS SEUS DADOS COPIADOS
const supabaseUrl = "https://qxnfpnabyytdbzdkklet.supabase.co";
const supabaseAnonKey = "sb_publishable_Fjs0fF6L6epIelSNkbijJA_jDsRfoDp";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
