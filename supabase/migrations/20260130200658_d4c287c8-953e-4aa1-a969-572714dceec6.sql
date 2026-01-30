-- Migration: Simplify theme system from multiple themes to single custom theme
-- Also migrate data from background_color to background_mode

-- Step 1: Add background_mode column to store light/dark choice
ALTER TABLE gallery_themes 
ADD COLUMN IF NOT EXISTS background_mode text DEFAULT 'light' 
CHECK (background_mode IN ('light', 'dark'));

-- Step 2: Migrate existing background_color to background_mode based on luminance
-- Light backgrounds (luminance > 50%) become 'light', dark become 'dark'
UPDATE gallery_themes 
SET background_mode = CASE 
  WHEN background_color IS NULL THEN 'light'
  WHEN (
    -- Calculate approximate luminance from hex color
    -- R * 0.299 + G * 0.587 + B * 0.114 > 127 means light
    (('x' || lpad(substring(background_color, 2, 2), 8, '0'))::bit(32)::int) * 0.299 +
    (('x' || lpad(substring(background_color, 4, 2), 8, '0'))::bit(32)::int) * 0.587 +
    (('x' || lpad(substring(background_color, 6, 2), 8, '0'))::bit(32)::int) * 0.114
  ) > 127 THEN 'light'
  ELSE 'dark'
END
WHERE background_mode IS NULL OR background_mode = 'light';

-- Step 3: Rename text_color to emphasis_color for semantic clarity
ALTER TABLE gallery_themes 
RENAME COLUMN text_color TO emphasis_color;

-- Step 4: Add theme_type column to gallery_settings to track system vs custom
ALTER TABLE gallery_settings 
ADD COLUMN IF NOT EXISTS theme_type text DEFAULT 'system' 
CHECK (theme_type IN ('system', 'custom'));

-- Step 5: Migrate existing active_theme_id to theme_type = 'custom'
UPDATE gallery_settings 
SET theme_type = 'custom' 
WHERE active_theme_id IS NOT NULL;

-- Step 6: Keep only the most recent theme per user (prepare for unique constraint)
-- Delete older themes, keeping only the newest one per user
DELETE FROM gallery_themes 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM gallery_themes 
  ORDER BY user_id, COALESCE(updated_at, created_at) DESC
);

-- Step 7: Remove is_default column (no longer needed with single theme)
ALTER TABLE gallery_themes 
DROP COLUMN IF EXISTS is_default;

-- Step 8: Drop background_color column (replaced by background_mode)
ALTER TABLE gallery_themes 
DROP COLUMN IF EXISTS background_color;

-- Step 9: Add unique constraint - only one theme per user
ALTER TABLE gallery_themes 
DROP CONSTRAINT IF EXISTS one_theme_per_user;

ALTER TABLE gallery_themes 
ADD CONSTRAINT one_theme_per_user UNIQUE (user_id);