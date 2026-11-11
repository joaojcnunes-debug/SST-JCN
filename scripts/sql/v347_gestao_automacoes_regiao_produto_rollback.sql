-- Desfaz a v347 (automações por região e produto no JCN). Cartões já criados pelas automações NÃO são apagados.
-- As listas Treinamento e CIPA/DESIGNADO e as colunas novas só saem se estiverem vazias (senão o script para).
begin;

do $$ begin
  if exists (select 1 from public.gestao_tarefas where id_quadro in ('QDR-TREINAME', 'QDR-CIPADESI')) then
    raise exception 'rollback v347: as listas Treinamento/CIPA têm cartões — mova ou apague antes';
  end if;
  if exists (select 1 from public.gestao_tarefas where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1')
              and status in ('EMPRESAS_NOVAS', 'AVAL_QUANTITATIVOS')) then
    raise exception 'rollback v347: há cartões nas colunas Empresas Novas/Avaliações — mova antes';
  end if;
end $$;

delete from public.gestao_automacoes where id_quadro = 'QDR-70A13B38' and nome like '[Roteamento]%';
delete from public.gestao_automacoes where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1')
   and (nome like '[SST] Checklist %' or nome = '[SST] Entrada de empresa nova');
delete from public.gestao_subtarefa_modelos where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1')
   and slug in ('pgr', 'pcmso', 'ltcat', 'li', 'lp', 'empresa_nova');

delete from public.gestao_status where id_quadro in ('QDR-TREINAME', 'QDR-CIPADESI');
delete from public.gestao_quadros where id_quadro in ('QDR-TREINAME', 'QDR-CIPADESI');

delete from public.gestao_status where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1')
   and slug in ('EMPRESAS_NOVAS', 'AVAL_QUANTITATIVOS');
update public.gestao_status set ordem = ordem - 2
 where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1') and ordem >= 2;
update public.gestao_quadros set id_unidade = null where id_quadro in ('QDR-A8221591','QDR-E28E4C68','QDR-8F094DA1');

update public.gestao_campos
   set opcoes = array(select o from unnest(opcoes) o where o not in ('Treinamento', 'CIPA/Designado', 'Avaliação de Calor'))
 where id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';

notify pgrst, 'reload schema';
commit;
