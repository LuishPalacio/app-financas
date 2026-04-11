import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// SUBSTITUA AQUI COM OS SEUS DADOS COPIADOS
const supabaseUrl = "https://qxnfpnabyytdbzdkklet.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bmZwbmFieXl0ZGJ6ZGtrbGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDk2OTksImV4cCI6MjA4ODYyNTY5OX0.nfhBEAjwO_KU8AE9ZlO63QlyoSFmxGYedzHvAbVtaxo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
