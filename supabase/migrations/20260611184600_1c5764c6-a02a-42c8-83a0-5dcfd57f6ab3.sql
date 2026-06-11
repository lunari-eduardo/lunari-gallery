-- Fix missing foreign keys to allow PostgREST joins and ensure data integrity

-- 1. galerias
ALTER TABLE public.galerias 
ADD CONSTRAINT fk_galerias_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. gallery_settings
ALTER TABLE public.gallery_settings 
ADD CONSTRAINT fk_gallery_settings_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. profiles (good practice)
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;