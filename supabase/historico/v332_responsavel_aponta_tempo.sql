-- v332 — Documento: o responsável também aponta tempo (10/11/2026, 0.3.252).
--
-- "Minhas inspeções" lista o documento para quem é associado OU responsável, mas
-- documento_sessao_iniciar (v311) só aceitava o associado. Quem era responsável sem linha em
-- inspecao_associados via o Iniciar/Retomar e recebia "so quem esta associado ao documento aponta
-- tempo nele". Mesma correção do Painel SST (v0.3.883).
--
-- Não cria as linhas de associado que faltam: Documentos por Associado recorta o mês pela data
-- dessa linha, e criar agora jogaria documentos antigos no mês atual.
-- Só muda a checagem de quem pode iniciar; nenhum dado muda. Rodar ANTES do deploy.
--
-- Rollback: scripts/sql/v332_responsavel_aponta_tempo_rollback.sql (volta a função da v311)
begin;

create or replace function public.documento_sessao_iniciar(p_id_inspecao text)
returns text language plpgsql security definer set search_path = public as $$
declare u public.usuarios; v_status text; v_aberta text; v_id text;
begin
  u := public.documento_sessao_quem(p_id_inspecao);
  -- Associado OU responsável, a mesma regra da fila "Minhas inspeções".
  if not exists (
       select 1 from public.inspecao_associados a
        where a.id_inspecao = p_id_inspecao
          and (a.id_usuario = u.id_usuario
               or (nullif(btrim(a.nome), '') is not null
                   and lower(public.sem_acento(btrim(a.nome))) = lower(public.sem_acento(btrim(u.nome))))))
     and not exists (
       select 1 from public.inspecoes i
        where i.id_inspecao = p_id_inspecao
          and nullif(btrim(i.elaboracao_responsavel), '') is not null
          and lower(public.sem_acento(btrim(i.elaboracao_responsavel))) = lower(public.sem_acento(btrim(u.nome)))) then
    raise exception 'so quem esta associado ao documento aponta tempo nele';
  end if;
  select coalesce(elaboracao_status, 'PENDENTE') into v_status from public.inspecoes where id_inspecao = p_id_inspecao;
  if v_status = 'CONCLUIDO' then raise exception 'documento ja entregue'; end if;

  perform public.documento_sessoes_fechar_inativas();
  select id_sessao, id_inspecao into v_aberta, v_id from public.documento_sessoes
   where id_usuario = u.id_usuario and fim is null;
  if v_aberta is not null and v_id = p_id_inspecao then
    update public.documento_sessoes set ultima_atividade = now() where id_sessao = v_aberta;
    return v_aberta;
  end if;
  if v_aberta is not null then
    update public.documento_sessoes set fim = now(), motivo_fim = 'TROCA' where id_sessao = v_aberta;
  end if;

  if v_status = 'PENDENTE' then
    update public.inspecoes
       set elaboracao_status = 'EM_ELABORACAO',
           elaboracao_responsavel = coalesce(nullif(btrim(elaboracao_responsavel), ''), u.nome),
           updated_at = now()
     where id_inspecao = p_id_inspecao;
  end if;

  insert into public.documento_sessoes (id_inspecao, id_usuario, nome, email)
  values (p_id_inspecao, u.id_usuario, u.nome, lower(u.email))
  returning id_sessao into v_aberta;
  return v_aberta;
end $$;

notify pgrst, 'reload schema';

commit;
