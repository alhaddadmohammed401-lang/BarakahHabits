-- ╔═══════════════════════════════════════════════════════════════════════════════╗
-- ║  Barakah Habits – habit_completions table                                  ║
-- ║  Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════════╝

-- 1. Create the table
CREATE TABLE IF NOT EXISTS habit_completions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id        integer     NOT NULL,
  completed_date  date        NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate entries for the same habit on the same day
  UNIQUE (user_id, habit_id, completed_date)
);

-- 2. Create an index for fast lookups by user + date
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date
  ON habit_completions (user_id, completed_date);

-- 3. Enable Row Level Security
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

-- 4. Policy: users can only SELECT their own rows
CREATE POLICY "Users can view own completions"
  ON habit_completions FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Policy: users can only INSERT their own rows
CREATE POLICY "Users can insert own completions"
  ON habit_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Policy: users can only DELETE their own rows (for un-checking)
CREATE POLICY "Users can delete own completions"
  ON habit_completions FOR DELETE
  USING (auth.uid() = user_id);
