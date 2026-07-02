
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'clientes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes';
  END IF;
END$$;

UPDATE public.clientes c
SET gallery_password = NULL
FROM public.profiles p
WHERE c.user_id = p.id
  AND c.gallery_password IS NOT NULL
  AND p.email IS NOT NULL
  AND LOWER(c.gallery_password) = LOWER(p.email);
