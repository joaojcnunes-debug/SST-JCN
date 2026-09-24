-- v247 — junta as DUAS fichas de colaborador do Leandro Salles numa só.
--
-- O QUE ACONTECEU. `colaboradores_chabra` é o roster de quem pode receber
-- equipamento, e ele é POR BASE de propósito (a entrega exige base única). Quem
-- recebe material numa segunda base ganha uma segunda ficha — foi o que fez o
-- fluxo de retirada em 03/09/2026, quando o Leandro ficou com o Switch 0227 em
-- Guapimirim. Resultado: dois "Leandro Salles", mesmo e-mail, e todas as telas
-- mostram só o nome.
--
--   f33eb2d3… | Teresópolis (UNI-F7077429) | 31/08 | CPF 119…760 | cargo "T.I"
--   6adeacda… | Guapimirim  (UNI-A3455481) | 03/09 | sem CPF     | "Técnico em Informática"
--
-- QUAL FICA. A de Teresópolis, e não por ser a mais antiga: é ela que tem a
-- DIGITAL cadastrada (1), as assinaturas (3), a retirada (1), a devolução (1),
-- o lugar na equipe de entrega e o papel de validador da unidade. A de
-- Guapimirim tem exatamente UMA referência no banco inteiro: o Switch 0227.
--
-- ⚠️ O SWITCH CONTINUA SENDO DE GUAPIMIRIM. Só o dono passa a ser a ficha única.
-- Isso é o que de fato aconteceu: o TI atende as 7 unidades e levou um switch
-- de lá. A devolução segue possível — `useAparelhosDoColaborador` procura por
-- colaborador, não por base, e `equipamento_registrar_devolucao` não exige que
-- o colaborador seja da base da devolução (exige que o aparelho esteja COM ele,
-- que é o que continua verdadeiro).
--
-- Decisão dele em 22/09/2026: "pode juntar os dois".

begin;

do $$
declare
  v_fica  text := 'f33eb2d3-f7ad-4be2-a1bd-e2513cb09264';  -- Teresópolis
  v_sai   text := '6adeacda-556b-449b-9296-de3b3f346c16';  -- Guapimirim
  v_email_fica text;
  v_email_sai  text;
  v_n int;
begin
  -- 1) As duas fichas existem e são a MESMA pessoa. Juntar ficha de gente
  --    diferente é pior do que a duplicata: some o dono do equipamento.
  select email into v_email_fica from colaboradores_chabra where id_colaborador = v_fica;
  select email into v_email_sai  from colaboradores_chabra where id_colaborador = v_sai;
  if v_email_fica is null or v_email_sai is null then
    raise exception 'v247 abortada: uma das fichas não existe mais (fica=% sai=%)', v_email_fica, v_email_sai;
  end if;
  if lower(btrim(v_email_fica)) <> lower(btrim(v_email_sai)) then
    raise exception 'v247 abortada: e-mails diferentes (% vs %) — não são a mesma pessoa', v_email_fica, v_email_sai;
  end if;

  -- 2) A ficha que sai não pode ter nada além da posse do aparelho. Se ganhou
  --    digital, assinatura ou documento entre a medição e agora, PARA: mover
  --    isso em silêncio é perder prova.
  select (select count(*) from equipamentos_entregas         where id_colaborador = v_sai)
       + (select count(*) from equipamentos_devolucoes       where id_colaborador = v_sai)
       + (select count(*) from colaboradores_chabra_biometria where id_colaborador = v_sai)
       + (select count(*) from equip_equipe_entrega          where id_colaborador = v_sai)
       + (select count(*) from equip_validador_unidade       where id_colaborador = v_sai)
       + (select count(*) from equipamentos_entrega_assinaturas where id_colaborador = v_sai)
    into v_n;
  if v_n <> 0 then
    raise exception 'v247 abortada: a ficha de Guapimirim ganhou % vínculo(s) desde a medição', v_n;
  end if;

  -- 3) A posse muda de ficha. O aparelho NÃO muda de base.
  update equipamentos set id_colaborador = v_fica, updated_at = now()
   where id_colaborador = v_sai;
  get diagnostics v_n = row_count;
  raise notice 'v247: % aparelho(s) repontado(s) para a ficha única', v_n;

  select count(*) into v_n from equipamentos where id_colaborador = v_sai;
  if v_n <> 0 then
    raise exception 'v247 abortada: ainda restam % aparelho(s) na ficha que sai', v_n;
  end if;

  -- 4) A ficha duplicada sai.
  delete from colaboradores_chabra where id_colaborador = v_sai;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'v247 abortada: delete removeu % linha(s), esperava 1', v_n;
  end if;

  -- 5) Sobrou um Leandro só.
  select count(*) into v_n from colaboradores_chabra where lower(btrim(email)) = lower(btrim(v_email_fica));
  if v_n <> 1 then
    raise exception 'v247 abortada: ainda há % ficha(s) com esse e-mail', v_n;
  end if;
end $$;

insert into public.schema_migrations (version)
values ('v247_colaborador_leandro_duplicado')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
