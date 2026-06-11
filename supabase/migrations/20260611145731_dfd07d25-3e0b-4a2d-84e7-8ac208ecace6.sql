ALTER TABLE public.gallery_email_templates 
DROP CONSTRAINT IF EXISTS gallery_email_templates_type_check;

ALTER TABLE public.gallery_email_templates 
ADD CONSTRAINT gallery_email_templates_type_check 
CHECK (type IN ('gallery_sent', 'selection_reminder', 'selection_confirmed', 'gallery_reactivated'));