-- Permitir user_id null em galeria_acoes para ações anônimas de clientes
ALTER TABLE galeria_acoes ALTER COLUMN user_id DROP NOT NULL;