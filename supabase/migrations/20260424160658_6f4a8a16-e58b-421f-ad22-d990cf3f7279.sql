-- Corrige 5 galerias afetadas pelo bug de R$ 250,05 (valor correto é R$ 25,00)
-- Origem: pacote "Mães 26 5 fotos" criado no Lunari_gestão com valor escalado

-- 1. Corrigir o valor_foto_extra das 3 galerias com valor errado (as outras 2 já estão corretas)
UPDATE galerias
SET valor_foto_extra = 25.00,
    updated_at = now()
WHERE id IN (
  '4e4f061d-c0da-494b-beb7-f47b1ce58391',
  '622a5169-e4fe-486a-8fcf-e76dd353e551',
  '4336dc90-0af8-40c0-9962-39a1f51a8a2d'
);

-- 2. Sanear o valorFotoExtra dentro do JSONB regras_congeladas das 5 galerias
UPDATE galerias
SET regras_congeladas = jsonb_set(
      regras_congeladas,
      '{pacote,valorFotoExtra}',
      '25'::jsonb,
      false
    ),
    updated_at = now()
WHERE id IN (
  '4e4f061d-c0da-494b-beb7-f47b1ce58391',
  '622a5169-e4fe-486a-8fcf-e76dd353e551',
  '4336dc90-0af8-40c0-9962-39a1f51a8a2d',
  '6a4df771-27fc-4ab1-a433-13de03966e24',
  'b99f2efc-80c9-47c5-9036-414555e3e3d4'
);

-- 3. Corrigir cobrança pendente da galeria 6a4df771 (R$ 500,10 → R$ 50,00 = 2 fotos × R$ 25)
UPDATE cobrancas
SET valor = 50.00,
    updated_at = now()
WHERE id = '978b43ae-6bb2-4fbc-a108-425b3e8be9fb'
  AND status = 'pendente'
  AND valor = 500.10;