"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BiometriaCaptura from "./BiometriaCaptura";

const DEDOS = [
  "Indicador — mão direita",
  "Polegar — mão direita",
  "Médio — mão direita",
  "Indicador — mão esquerda",
  "Polegar — mão esquerda",
];

/** Três amostras do MESMO dedo. Uma só reprova gente legítima por ângulo e pressão;
 *  o matcher compara a sonda contra todas e fica com a melhor. */
const AMOSTRAS_ALVO = 3;

export default function BiometriaCadastroModal({
  open,
  onClose,
  idColaborador,
  nome,
  jaCadastrouEm,
  onCadastrado,
}: {
  open: boolean;
  onClose: () => void;
  idColaborador: string;
  nome: string;
  jaCadastrouEm?: string | null;
  onCadastrado?: () => void;
}) {
  const [amostras, setAmostras] = useState<string[]>([]);
  const [dedo, setDedo] = useState(DEDOS[0]);
  const [consentimento, setConsentimento] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const fechar = () => {
    setAmostras([]);
    setConsentimento(false);
    onClose();
  };

  async function salvar() {
    if (amostras.length < AMOSTRAS_ALVO) {
      toast.error(`Faltam ${AMOSTRAS_ALVO - amostras.length} leitura(s).`);
      return;
    }
    if (!consentimento) {
      toast.error("O consentimento é obrigatório.");
      return;
    }
    setSalvando(true);
    try {
      const sb = createSupabaseBrowserClient() as unknown as {
        rpc(fn: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
      };
      const { error } = await sb.rpc("equip_cadastrar_biometria", {
        p_id_colaborador: idColaborador,
        p_template: JSON.stringify(amostras),
        // O que vale é o que a pessoa marcou, não um literal: a checkbox abaixo só
        // habilitava o botão no cliente, e o servidor recebia `true` sempre.
        p_consentimento: consentimento,
        p_dedo: dedo,
      });
      if (error) throw new Error(error.message);
      toast.success("Digital cadastrada.");
      onCadastrado?.();
      fechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={fechar} title={`Cadastrar digital — ${nome}`} size="md">
      <div className="space-y-4">
        {jaCadastrouEm ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Esta pessoa já tem digital cadastrada. Substituir exige perfil <strong>Admin</strong>.
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Qual dedo
          </label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={dedo}
            onChange={(e) => setDedo(e.target.value)}
            disabled={amostras.length > 0}
          >
            {DEDOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {amostras.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Travado depois da primeira leitura — as três amostras precisam ser do mesmo dedo.
            </p>
          ) : null}
        </div>

        <BiometriaCaptura
          rotulo={`Leitura ${Math.min(amostras.length + 1, AMOSTRAS_ALVO)} de ${AMOSTRAS_ALVO}`}
          descricao={dedo}
          ocupado={amostras.length >= AMOSTRAS_ALVO || salvando}
          onCapturado={(img) => setAmostras((a) => (a.length >= AMOSTRAS_ALVO ? a : [...a, img]))}
        />

        <div className="flex items-center gap-2">
          {Array.from({ length: AMOSTRAS_ALVO }).map((_, i) => (
            <span
              key={i}
              className={
                "h-2 flex-1 rounded-full " +
                (i < amostras.length ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")
              }
            />
          ))}
          {amostras.length > 0 ? (
            <button
              type="button"
              onClick={() => setAmostras([])}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> recomeçar
            </button>
          ) : null}
        </div>

        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
          />
          <span>
            <strong>{nome}</strong> autoriza o registro da digital para assinar retiradas e
            transferências de equipamento. O dado é <strong>pessoal sensível</strong>: fica cifrado,
            só o servidor decifra para comparar, e o registro pode ser revogado a pedido.
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={fechar}
            className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || amostras.length < AMOSTRAS_ALVO || !consentimento}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar digital"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
