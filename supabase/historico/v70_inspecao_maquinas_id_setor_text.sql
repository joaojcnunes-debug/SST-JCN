-- v70: inspecao_maquinas.id_setor era uuid, mas setores.id_setor é text
-- (IDs no formato SET-XXXXXXXX) → todo cadastro de máquina com setor
-- falhava com "invalid input syntax for type uuid". Nenhuma linha tinha
-- id_setor preenchido, então a conversão é segura.
alter table public.inspecao_maquinas
  alter column id_setor type text using id_setor::text;
