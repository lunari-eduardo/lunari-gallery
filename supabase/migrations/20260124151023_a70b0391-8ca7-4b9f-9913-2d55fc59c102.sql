-- Fix search_path security warning for increment_gallery_photo_count function
CREATE OR REPLACE FUNCTION increment_gallery_photo_count(gallery_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE galerias 
  SET total_fotos = COALESCE(total_fotos, 0) + 1 
  WHERE id = gallery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;