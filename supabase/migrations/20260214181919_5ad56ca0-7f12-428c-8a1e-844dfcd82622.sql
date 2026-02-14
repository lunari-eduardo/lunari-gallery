ALTER TABLE gallery_settings 
ADD COLUMN default_welcome_message text,
ADD COLUMN welcome_message_enabled boolean DEFAULT true;