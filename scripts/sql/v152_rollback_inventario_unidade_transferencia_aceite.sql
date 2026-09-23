-- ROLLBACK da v152 (JCN) — unidade como ID + transferencia com aceite assinado.
--
-- NAO E MIGRATION. Vive em scripts/sql/ de proposito e e rodado a mao.
--
-- O QUE ELE DESFAZ: as RPCs de transferencia, a funcao de permissao, as
-- policies da tabela transferencias e as colunas de estado/assinatura que a
-- v152 acrescentou.
--
-- O QUE ELE NAO ENCOSTA: a tabela transferencias em si e o historico ja
-- gravado (isso e a v151), nem as colunas de drift regularizadas (tipo,
-- categoria, codigo_interno, tag, unidade, setor...), que existiam antes.
--
-- ⚠️ O que se perde: o ESTADO das transferencias (pendente/aceita/recusada/
-- cancelada), o destinatario e a assinatura eletronica do aceite. As linhas
-- continuam la, mas viram log sem desfecho, como eram na v151.
--
-- ⚠️ ORDEM: codigo primeiro, banco depois (ou os dois na mesma janela). O front
-- da transferencia chama as RPCs abaixo; sem elas as telas dao erro.
--
-- Conferencia previa (rode sozinho primeiro):
--   SELECT status, count(*) FROM public.transferencias GROUP BY 1;
--   SELECT count(*) FROM public.transferencias WHERE assinatura_png IS NOT NULL;

BEGIN;

-- Trava: assinatura eletronica de aceite e prova de recebimento (Lei
-- 14.063/2020). Apagar isso em silencio nao pode acontecer por descuido.
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.transferencias WHERE assinatura_png IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'v152 rollback abortado: % aceite(s) assinado(s) seriam perdidos', n;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.transferencia_cancelar(text, text);
DROP FUNCTION IF EXISTS public.transferencia_recusar(text, text);
DROP FUNCTION IF EXISTS public.transferencia_aceitar(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.transferencia_abrir(text);

DROP POLICY IF EXISTS transferencias_sel ON public.transferencias;
DROP POLICY IF EXISTS transferencias_rw  ON public.transferencias;

-- Devolve as policies abertas da v151.
CREATE POLICY "auth read transferencias"
  ON public.transferencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write transferencias"
  ON public.transferencias FOR ALL TO authenticated
  USING (public.caller_pode_editar())
  WITH CHECK (public.caller_pode_editar());

DROP FUNCTION IF EXISTS public.caller_pode_transferir();

-- Tira o modulo concedido no dia-zero.
UPDATE public.usuarios
   SET modulos_permitidos = array_remove(modulos_permitidos, 'transferencias')
 WHERE 'transferencias' = ANY(modulos_permitidos);

DROP INDEX IF EXISTS public.uniq_transf_pendente_maquina;
DROP INDEX IF EXISTS public.idx_transf_status_destino;
DROP INDEX IF EXISTS public.idx_inv_maquinas_unidade;

ALTER TABLE public.transferencias
  DROP CONSTRAINT IF EXISTS transferencias_status_chk,
  DROP CONSTRAINT IF EXISTS transferencias_pendente_completa_chk;

ALTER TABLE public.transferencias
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS de_id_unidade,
  DROP COLUMN IF EXISTS para_id_unidade,
  DROP COLUMN IF EXISTS para_usuario_email,
  DROP COLUMN IF EXISTS para_usuario_nome,
  DROP COLUMN IF EXISTS transportado_por,
  DROP COLUMN IF EXISTS aceita_por_email,
  DROP COLUMN IF EXISTS aceita_em,
  DROP COLUMN IF EXISTS recusada_por_email,
  DROP COLUMN IF EXISTS recusada_em,
  DROP COLUMN IF EXISTS recusada_motivo,
  DROP COLUMN IF EXISTS cancelada_por_email,
  DROP COLUMN IF EXISTS cancelada_em,
  DROP COLUMN IF EXISTS cancelada_motivo,
  DROP COLUMN IF EXISTS assinante_nome,
  DROP COLUMN IF EXISTS assinatura_png,
  DROP COLUMN IF EXISTS pdf_sha256,
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS assinatura_ip,
  DROP COLUMN IF EXISTS consentimento_em,
  DROP COLUMN IF EXISTS assinado_em,
  DROP COLUMN IF EXISTS em_atendimento_por,
  DROP COLUMN IF EXISTS em_atendimento_em;

-- id_unidade do inventario: o espelho em texto (`unidade`) continua la, entao
-- nada de localizacao se perde.
ALTER TABLE public.inventario_maquinas
  DROP COLUMN IF EXISTS id_unidade;

COMMIT;
