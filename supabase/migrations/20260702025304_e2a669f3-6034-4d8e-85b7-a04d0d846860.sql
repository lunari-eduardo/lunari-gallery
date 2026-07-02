
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text;

-- Constraint suave: só dígitos, 11 ou 14 caracteres (CPF ou CNPJ), quando presente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_cpf_cnpj_format_chk'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_cpf_cnpj_format_chk
      CHECK (cpf_cnpj IS NULL OR cpf_cnpj ~ '^[0-9]{11}$' OR cpf_cnpj ~ '^[0-9]{14}$');
  END IF;
END $$;

-- UF sempre em 2 letras maiúsculas quando presente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_uf_format_chk'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_uf_format_chk
      CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- Índice único parcial: evita duplicidade de CPF por fotógrafo.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_user_cpf_unique_idx
  ON public.clientes (user_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL;
