-- ==============================================================================
-- THE CRAFT PRO — SUPABASE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Complete User Authentication & 100% Isolated Private Drawing System
-- ==============================================================================

-- 1. PROFILES TABLE (Stores user info linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. DRAWINGS / PROJECTS TABLE
-- Strictly isolated per user. No user can ever read, update, or delete another user's artwork!
CREATE TABLE IF NOT EXISTS public.drawings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Untitled Artwork',
  thumbnail TEXT, -- PNG/JPEG data URL or storage URL preview
  data JSONB NOT NULL, -- Complete serialized document layers, brushes, settings
  is_animation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_drawings_user_id ON public.drawings(user_id);
CREATE INDEX IF NOT EXISTS idx_drawings_updated_at ON public.drawings(updated_at DESC);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES — 100% PRIVATE ISOLATION
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

-- Rule 1: A user can ONLY view their own drawings
CREATE POLICY "Users can select only their own drawings"
  ON public.drawings FOR SELECT
  USING (auth.uid() = user_id);

-- Rule 2: A user can ONLY insert drawings for themselves
CREATE POLICY "Users can insert only their own drawings"
  ON public.drawings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Rule 3: A user can ONLY update their own drawings
CREATE POLICY "Users can update only their own drawings"
  ON public.drawings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Rule 4: A user can ONLY delete their own drawings
CREATE POLICY "Users can delete only their own drawings"
  ON public.drawings FOR DELETE
  USING (auth.uid() = user_id);

-- 4. AUTOMATIC USER PROFILE TRIGGER
-- When a user signs in via Google / Gmail or Email, automatically sync their profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. AUTOMATIC UPDATED_AT TRIGGER FOR DRAWINGS
CREATE OR REPLACE FUNCTION public.update_drawing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_drawings_updated_at ON public.drawings;
CREATE TRIGGER tr_drawings_updated_at
  BEFORE UPDATE ON public.drawings
  FOR EACH ROW EXECUTE FUNCTION public.update_drawing_timestamp();
