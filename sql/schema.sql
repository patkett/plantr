-- Verdant Garden Planner — Supabase schema setup script.
-- Run this in your Supabase project's SQL Editor to create the
-- required tables (plants and garden_beds) with public access policies.

-- 1. Create Garden Beds Table
CREATE TABLE IF NOT EXISTS public.garden_beds (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  sunlight TEXT NOT NULL,
  x INT DEFAULT 50,
  y INT DEFAULT 50,
  width INT DEFAULT 300,
  height INT DEFAULT 200,
  color TEXT
);

-- 2. Create Plants Table
CREATE TABLE IF NOT EXISTS public.plants (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  botanical_name TEXT,
  sunlight TEXT NOT NULL,
  water TEXT DEFAULT 'Moderate',
  soil TEXT DEFAULT 'Well-Drained',
  category TEXT,
  status TEXT DEFAULT 'garden',
  notes TEXT,
  emoji TEXT DEFAULT '🪴',
  bed_id TEXT REFERENCES public.garden_beds(id) ON DELETE SET NULL,
  x_pos INT,
  y_pos INT,
  died_in_bed TEXT,
  died_bed_sunlight TEXT,
  died_at TIMESTAMPTZ,
  placements JSONB DEFAULT '[]'::jsonb,
  deaths JSONB DEFAULT '[]'::jsonb
);

-- 2b. Migration for existing databases: add columns used to record
--     where/under which conditions a plant died (status = 'deceased').
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS died_in_bed TEXT;
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS died_bed_sunlight TEXT;
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS died_at TIMESTAMPTZ;

-- 2c. Migration: a plant can be placed several times on the map
--     (placements = [{id, bed_id, x, y}]) and keeps a history of
--     specimens that died (deaths = [{bed, sunlight, died_at}]).
--     Legacy x_pos/y_pos/bed_id are kept and mirror the first placement.
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS placements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS deaths JSONB DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';

-- 3. Enable RLS and create public read/write policies
ALTER TABLE public.garden_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write on garden_beds" ON public.garden_beds;
DROP POLICY IF EXISTS "Allow public read/write on plants" ON public.plants;
CREATE POLICY "Allow public read/write on garden_beds" ON public.garden_beds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on plants" ON public.plants FOR ALL USING (true) WITH CHECK (true);
