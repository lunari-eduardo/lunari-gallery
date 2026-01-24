-- Create atomic counter function for gallery photo count
-- This prevents race conditions when multiple uploads happen simultaneously

CREATE OR REPLACE FUNCTION increment_gallery_photo_count(gallery_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE galerias 
  SET total_fotos = COALESCE(total_fotos, 0) + 1 
  WHERE id = gallery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_gallery_photo_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_gallery_photo_count(UUID) TO service_role;