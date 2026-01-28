-- Fix email template duplication: clean duplicates and add constraint

-- 1. Create temp table with unique records (keep oldest by created_at)
CREATE TEMP TABLE unique_templates AS
SELECT DISTINCT ON (user_id, type) *
FROM public.gallery_email_templates
ORDER BY user_id, type, created_at;

-- 2. Delete all records from original table
DELETE FROM public.gallery_email_templates;

-- 3. Re-insert unique records
INSERT INTO public.gallery_email_templates 
SELECT * FROM unique_templates;

-- 4. Add unique constraint to prevent future duplicates
ALTER TABLE public.gallery_email_templates 
ADD CONSTRAINT unique_user_template_type UNIQUE (user_id, type);

-- 5. Clean up temp table
DROP TABLE unique_templates;