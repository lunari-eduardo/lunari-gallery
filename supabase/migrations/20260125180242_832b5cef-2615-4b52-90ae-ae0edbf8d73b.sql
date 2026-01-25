-- Delete duplicate themes keeping only the oldest one per user
DELETE FROM gallery_themes 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM gallery_themes 
  ORDER BY user_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_themes_unique_name_per_user 
ON gallery_themes (user_id, name);