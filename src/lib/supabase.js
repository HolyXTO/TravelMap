import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://yxwflztibppjcyxdulho.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d2ZsenRpYnBwamN5eGR1bGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDYxOTIsImV4cCI6MjA5Nzg4MjE5Mn0.ORs5mJEB5JUNJt6jjHVObSRnoCJtLtXyYabUP5yK9ew";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

