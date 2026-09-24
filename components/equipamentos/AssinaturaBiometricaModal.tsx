"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BiometriaCaptura from "./BiometriaCaptura";

type Papel = "envia" | "recebe" | "valida";

const PAPEIS: { papel: Papel; titulo: string; ajuda: string }[] = [
  { papel: "envia", titulo: "Quem entrega", ajuda: "Equipe de TI — qualquer base" },
  { papel: "recebe", titulo: "Quem recebe", ajuda: "A pessoa que fica com o equipamento" },
  { papel: "valida", titulo: "Quem valida", ajuda: "Equipe de TI — pode ser a mesma pessoa que entregou" },
];

interface Assinada {
  papel: Papel;
  id_colaborador: string | null;
  assinante_nome: string | null;
  match_score: number | null;
  metodo: string;
}

interface MembroEquipe {
  id_colaborador: string;
  nome: string;
  tem_digital: boolean;
}

type Rpc = {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

/**
 * Assinatura biométrica da retirada, nos três papéis.
 *
 * O que a tela NÃO faz, de propósito: ela não decide se a digital bateu, e não decide
 * quem pode assinar. Manda a amostra para `/api/equipamentos/biometria/verificar`, e é o
 * servidor que compara no matcher e grava — com uma função que `authenticated` não pode
 * executar. Se a tela pudesse afirmar "verificado", a assinatura não valeria nada.
 *
 * Quem entrega e quem valida saem da EQUIPE DE ENTREGA (a TI), que atende todas as bases
 * e pode ser a mesma pessoa nos dois papéis. Quem recebe é sempre o colaborador da
 * própria retirada e não aparece nas listas — essa é a separação que sobrou, e o banco a
 * impõe de novo do lado que grava.
 */
export default function AssinaturaBiometricaModal({
  open,
  onClose,
  idEntrega,
  nomeRecebedor,
  onConcluido,
}: {
  open: boolean;
  onClose: () => void;
  idEntrega: string;
  /** A unidade saiu daqui: ela categoriza o DOCUMENTO (e é gravada na assinatura a
   *  partir da retirada), mas não restringe mais quem assina — a equipe é cross-base. */
  nomeRecebedor: string;
  onConcluido?: () => void;
}) {
  const [assinadas, setAssinadas] = useState<Assinada[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [escolha, setEscolha] = useState<{ envia: string; valida: string }>({ envia: "", valida: "" });
  const [ocupado, setOcupado] = useState<Papel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [conteudoHash, setConteudoHash] = useState<string | null>(null);
  const [idRecebedor, setIdRecebedor] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const sb = createSupabaseBrowserClient();
    const [{ data: assin }, { data: ent }, { data: time }] = await Promise.all([
      sb
        .from("equipamentos_entrega_assinaturas")
        .select("papel, id_colaborador, assinante_nome, match_score, metodo")
        .eq("id_entrega", idEntrega),
      sb.from("equipamentos_entregas").select("id_colaborador").eq("id_entrega", idEntrega).maybeSingle(),
      // Por RPC, e não por `colaboradores_chabra`: a tabela é recortada por unidade, e a
      // equipe é justamente cross-base — um Técnico de uma base não enxergaria o colega
      // de TI de outra, e a lista viria furada sem nenhum erro visível.
      (sb as unknown as Rpc).rpc("equip_equipe_entrega_listar"),
    ]);
    setAssinadas((assin ?? []) as Assinada[]);
    setIdRecebedor((ent as { id_colaborador: string | null } | null)?.id_colaborador ?? null);
    setEquipe(Array.isArray(time) ? (time as MembroEquipe[]) : []);
    setCarregando(false);
  }, [idEntrega]);

  /**
   * O hash do que está sendo assinado — do CONTEÚDO da retirada, calculado no banco.
   * O que a tela manda é só o que ela achava estar assinando; a função de gravação
   * recalcula e recusa se divergir, o que pega alguém editando a retirada com este
   * modal aberto.
   */
  const calcularHash = useCallback(async () => {
    try {
      const sb = createSupabaseBrowserClient() as unknown as Rpc;
      const { data } = await sb.rpc("equip_hash_conteudo_entrega", { p_id_entrega: idEntrega });
      setConteudoHash(typeof data === "string" && data.length > 0 ? data : null);
    } catch {
      setConteudoHash(null);
    }
  }, [idEntrega]);

  useEffect(() => {
    if (open) {
      void recarregar();
      void calcularHash();
    }
  }, [open, recarregar, calcularHash]);

  const jaAssinado = (p: Papel) => assinadas.find((a) => a.papel === p);

  /** Quem pode aparecer no seletor de `envia`/`valida`: a equipe, menos quem recebe.
   *  A mesma pessoa PODE ser escolhida nos dois papéis — é o pedido do operador, e a
   *  realidade de uma equipe de quatro que entrega e valida. */
  const elegiveis = equipe.filter((m) => m.id_colaborador !== idRecebedor);

  async function enviar(papel: Papel, imagem: string) {
    setOcupado(papel);
    try {
      const r = await fetch("/api/equipamentos/biometria/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_entrega: idEntrega,
          papel,
          id_colaborador: papel === "recebe" ? undefined : escolha[papel],
          sonda: imagem,
          conteudo_hash: conteudoHash,
        }),
      });
      const j = (await r.json()) as {
        ok: boolean;
        match?: boolean;
        score?: number | null;
        threshold?: number | null;
        erro?: string;
        fallback?: boolean;
        semBiometria?: boolean;
      };

      if (!j.ok) {
        // Bloquear é a decisão do operador: retirada não sai sem biometria.
        toast.error(j.erro ?? "Não foi possível verificar.");
        return;
      }
      if (!j.match) {
        toast.error(
          `A digital não confere${j.score != null ? ` (score ${j.score.toFixed(1)}` + (j.threshold != null ? ` — mínimo ${j.threshold}` : "") + ")" : ""}.`,
        );
        return;
      }
      toast.success(`Assinado${j.score != null ? ` — score ${j.score.toFixed(1)}` : ""}.`);
      await recarregar();
      onConcluido?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na verificação.");
    } finally {
      setOcupado(null);
    }
  }

  const faltam = PAPEIS.filter((p) => !jaAssinado(p.papel)).length;

  return (
    <Modal open={open} onClose={onClose} title="Assinatura biométrica da retirada" size="lg">
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Três assinaturas: quem entrega, quem recebe e quem valida. Cada uma é comparada no
          servidor contra a digital cadastrada da pessoa.
        </p>

        {conteudoHash ? (
          <p className="text-xs text-slate-500">
            Assinando a versão atual da retirada · <code>{conteudoHash.slice(0, 16)}…</code>
          </p>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Ainda identificando o que será assinado. Sem isso a assinatura não fica presa a
            nenhuma versão da retirada.
          </p>
        )}

        {!carregando && elegiveis.length === 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Não há ninguém na equipe de entrega com digital cadastrada. Defina a equipe em
            Colaboradores antes de assinar.
          </p>
        ) : null}

        {carregando ? (
          <p className="py-6 text-center text-sm text-slate-500">Carregando…</p>
        ) : (
          PAPEIS.map(({ papel, titulo, ajuda }) => {
            const feita = jaAssinado(papel);
            const escolhido = papel === "recebe" ? null : escolha[papel];
            const alvo =
              papel === "recebe"
                ? nomeRecebedor
                : (equipe.find((m) => m.id_colaborador === escolhido)?.nome ?? null);

            return (
              <div key={papel} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
                    <p className="text-xs text-slate-500">{ajuda}</p>
                  </div>
                  {feita ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {feita.assinante_nome ?? "assinado"}
                      {feita.match_score != null ? ` · ${feita.match_score.toFixed(1)}` : ""}
                    </span>
                  ) : null}
                </div>

                {feita ? null : (
                  <>
                    {papel === "recebe" ? null : (
                      <select
                        className="mb-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={escolha[papel]}
                        onChange={(e) => setEscolha((s) => ({ ...s, [papel]: e.target.value }))}
                      >
                        <option value="">
                          {papel === "envia" ? "Quem está entregando…" : "Quem está validando…"}
                        </option>
                        {elegiveis.map((m) => (
                          <option key={m.id_colaborador} value={m.id_colaborador} disabled={!m.tem_digital}>
                            {m.nome}
                            {m.tem_digital ? "" : " — sem digital cadastrada"}
                          </option>
                        ))}
                      </select>
                    )}
                    <BiometriaCaptura
                      rotulo={alvo ? `Digital de ${alvo}` : "Escolha a pessoa acima"}
                      ocupado={ocupado !== null || !conteudoHash || (papel !== "recebe" && !escolha[papel])}
                      onCapturado={(img) => enviar(papel, img)}
                    />
                    {/* Consequência do antirreplay, dita antes de a pessoa esbarrar nela:
                        a mesma leitura não assina dois papéis. */}
                    {papel === "valida" && escolha.valida && escolha.valida === escolha.envia ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Mesma pessoa que entregou — precisa encostar o dedo de novo, a leitura
                        anterior não vale para o segundo papel.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-500">
            {faltam === 0 ? "As três assinaturas estão registradas." : `Faltam ${faltam} assinatura(s).`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
