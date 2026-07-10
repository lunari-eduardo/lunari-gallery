
CREATE OR REPLACE FUNCTION public.upsert_visitor_contact(
  p_token text,
  p_visitor_id uuid,
  p_email text,
  p_phone text,
  p_nome text,
  p_cpf_cnpj text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gallery_id uuid;
  v_cliente_id uuid;
  v_user_id uuid;
  v_current record;
  v_email text;
  v_phone_digits text;
  v_nome text;
  v_cpf_digits text;
  v_existing_cpf_cliente_id uuid;
  v_cpf_conflict boolean := false;
  v_enriched_cliente jsonb := '{}'::jsonb;
  v_enriched_visitor boolean := false;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_TOKEN');
  END IF;

  v_email := lower(nullif(trim(coalesce(p_email, '')), ''));
  IF v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    v_email := NULL;
  END IF;

  v_phone_digits := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  IF v_phone_digits IS NOT NULL AND (length(v_phone_digits) < 10 OR length(v_phone_digits) > 13) THEN
    v_phone_digits := NULL;
  END IF;

  v_nome := nullif(trim(coalesce(p_nome, '')), '');

  v_cpf_digits := nullif(regexp_replace(coalesce(p_cpf_cnpj, ''), '\D', '', 'g'), '');
  IF v_cpf_digits IS NOT NULL AND length(v_cpf_digits) NOT IN (11, 14) THEN
    v_cpf_digits := NULL;
  END IF;

  SELECT id, cliente_id, user_id INTO v_gallery_id, v_cliente_id, v_user_id
  FROM public.galerias WHERE public_token = p_token LIMIT 1;

  IF v_gallery_id IS NULL THEN
    SELECT g.id, g.cliente_id, g.user_id INTO v_gallery_id, v_cliente_id, v_user_id
    FROM public.gallery_token_aliases a
    JOIN public.galerias g ON g.id = a.galeria_id
    WHERE a.alias_token = p_token LIMIT 1;
  END IF;

  IF v_gallery_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'GALLERY_NOT_FOUND');
  END IF;

  -- Enriquecimento do VISITANTE — sempre roda, independente de colisões em clientes.
  -- galeria_visitantes não tem constraint de unicidade em cpf_cnpj.
  IF p_visitor_id IS NOT NULL THEN
    UPDATE public.galeria_visitantes v
       SET nome = COALESCE(NULLIF(trim(v.nome), ''), v_nome, v.nome),
           contato = CASE
             WHEN v.contato IS NULL OR trim(v.contato) = ''
               THEN COALESCE(v_email, v_phone_digits, v.contato)
             ELSE v.contato
           END,
           contato_tipo = CASE
             WHEN v.contato IS NULL OR trim(v.contato) = ''
               THEN CASE WHEN v_email IS NOT NULL THEN 'email'
                         WHEN v_phone_digits IS NOT NULL THEN 'whatsapp'
                         ELSE v.contato_tipo END
             ELSE v.contato_tipo
           END,
           cpf_cnpj = COALESCE(NULLIF(trim(v.cpf_cnpj), ''), v_cpf_digits, v.cpf_cnpj),
           updated_at = now()
     WHERE v.id = p_visitor_id AND v.galeria_id = v_gallery_id;
    IF FOUND THEN v_enriched_visitor := true; END IF;
  END IF;

  -- Enriquecimento do CLIENTE vinculado à galeria.
  IF v_cliente_id IS NOT NULL THEN
    SELECT email, telefone, whatsapp, nome, cpf_cnpj INTO v_current
      FROM public.clientes WHERE id = v_cliente_id;

    IF FOUND THEN
      -- Email: só grava se vazio.
      IF v_email IS NOT NULL AND (v_current.email IS NULL OR trim(v_current.email) = '') THEN
        UPDATE public.clientes SET email = v_email WHERE id = v_cliente_id;
        v_enriched_cliente := v_enriched_cliente || jsonb_build_object('email', true);
      END IF;

      -- Telefone: só grava se telefone E whatsapp estiverem vazios.
      IF v_phone_digits IS NOT NULL
         AND (v_current.telefone IS NULL OR trim(v_current.telefone) = '')
         AND (v_current.whatsapp IS NULL OR trim(v_current.whatsapp) = '') THEN
        UPDATE public.clientes SET telefone = v_phone_digits WHERE id = v_cliente_id;
        v_enriched_cliente := v_enriched_cliente || jsonb_build_object('telefone', true);
      END IF;

      -- WhatsApp: espelha para whatsapp quando estiver vazio, independente do telefone.
      -- É a fonte confiável de contato de cobrança neste fluxo.
      IF v_phone_digits IS NOT NULL
         AND (v_current.whatsapp IS NULL OR trim(v_current.whatsapp) = '') THEN
        UPDATE public.clientes SET whatsapp = v_phone_digits WHERE id = v_cliente_id;
        v_enriched_cliente := v_enriched_cliente || jsonb_build_object('whatsapp', true);
      END IF;

      -- Nome: só grava se vazio.
      IF v_nome IS NOT NULL AND (v_current.nome IS NULL OR trim(v_current.nome) = '') THEN
        UPDATE public.clientes SET nome = v_nome WHERE id = v_cliente_id;
        v_enriched_cliente := v_enriched_cliente || jsonb_build_object('nome', true);
      END IF;

      -- CPF/CNPJ: só grava se vazio E se não colidir com outro cliente do mesmo fotógrafo.
      IF v_cpf_digits IS NOT NULL AND (v_current.cpf_cnpj IS NULL OR trim(v_current.cpf_cnpj) = '') THEN
        SELECT id INTO v_existing_cpf_cliente_id
          FROM public.clientes
         WHERE user_id = v_user_id
           AND cpf_cnpj = v_cpf_digits
           AND id <> v_cliente_id
         LIMIT 1;

        IF v_existing_cpf_cliente_id IS NOT NULL THEN
          -- Já existe outro cadastro do mesmo fotógrafo com esse CPF.
          -- Não duplicamos e não travamos o pagamento — apenas sinalizamos.
          v_cpf_conflict := true;
        ELSE
          UPDATE public.clientes SET cpf_cnpj = v_cpf_digits WHERE id = v_cliente_id;
          v_enriched_cliente := v_enriched_cliente || jsonb_build_object('cpf_cnpj', true);
        END IF;
      ELSIF v_cpf_digits IS NOT NULL
        AND v_current.cpf_cnpj IS NOT NULL
        AND trim(v_current.cpf_cnpj) <> ''
        AND v_current.cpf_cnpj <> v_cpf_digits THEN
        -- Cliente já tem outro CPF cadastrado — nunca sobrescrevemos.
        v_cpf_conflict := true;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enriched_visitor', v_enriched_visitor,
    'enriched_cliente', v_enriched_cliente,
    'cpf_conflict', v_cpf_conflict,
    'cliente_linked', v_cliente_id IS NOT NULL
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_visitor_contact(text, uuid, text, text, text, text) TO anon, authenticated, service_role;
