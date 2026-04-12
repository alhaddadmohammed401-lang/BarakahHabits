import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ylguudccnyhhlhwuhsub.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZ3V1ZGNjbnloaGxod3Voc3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjY3MzQsImV4cCI6MjA5MTMwMjczNH0.FKLxFkqwNTXjZ8LnUUU6tCjnaI9I5q2V6ZcSN6Y4uRg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});