"use client";

import { useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { TOPICOS } from "@/lib/drps/topicos";
import {
  classificarGravidade,
  pontuacaoCorrigida,
} from "@/lib/drps/calculos";
import type { DrpsRespondente } from "@/lib/drps/types";

const ROTULO_RESPOSTA = ["Nunca", "Raramente", "Ocasionalmente", "Frequentemente", "Sempre"];

interface Props {
  respondente: DrpsRespondente | null;
  onClose: () => void;
}

export default function RespostasModal({ respondente, onClose }: Props) {
  const blocos = useMemo(() => {
    if (!respondente) return [];
    return TOPICOS.map((t, ti) => ({
      idx: ti,
      nome: t.nome,
      perguntas: t.perguntas.map((p, pi) => {
        const resp = respondente.respostas[t.colunaInicio + pi] ?? 0;
        const corrigida = pontuacaoCorrigida(resp, p.logica);
        const grav = classificarGravidade(corrigida);
        return {
          texto: p.texto,
          logica: p.logica,
          resposta: resp,
          rotuloResposta: ROTULO_RESPOSTA[resp] ?? "?",
          corrigida,
          gravidade: grav,
        };
      }),
    }));
  }, [respondente]);

  if (!respondente) return null;

  return (
    <Modal
      open={!!respondente}
      onClose={onClose}
      title={`Respondente — ${respondente.setor}${respondente.cargo ? ` · ${respondente.cargo}` : ""}`}
      size="xl"
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <strong>Setor:</strong> {respondente.setor} ·{" "}
          <strong>Cargo:</strong> {respondente.cargo ?? "—"} ·{" "}
          <strong>Carimbo:</strong>{" "}
          {respondente.data_carimbo
            ? new Date(respondente.data_carimbo).toLocaleString("pt-BR")
            : "—"}
        </div>

        {blocos.map((b) => (
          <div
            key={b.idx}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Tópico {b.idx + 1} — {b.nome}
            </div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Pergunta</th>
                  <th className="px-3 py-1.5 text-center font-medium w-20">
                    Lógica
                  </th>
                  <th className="px-3 py-1.5 text-center font-medium w-32">
                    Resposta
                  </th>
                  <th className="px-3 py-1.5 text-center font-medium w-20">
                    Corrigida
                  </th>
                  <th className="px-3 py-1.5 text-center font-medium w-20">
                    Gravidade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {b.perguntas.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-800">{p.texto}</td>
                    <td className="px-3 py-1.5 text-center text-[10px] uppercase text-gray-500">
                      {p.logica}
                    </td>
                    <td className="px-3 py-1.5 text-center text-gray-700">
                      <span className="font-mono font-bold">{p.resposta}</span>{" "}
                      <span className="text-[10px] text-gray-500">
                        {p.rotuloResposta}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono text-gray-700">
                      {p.corrigida.toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: p.gravidade.cor }}
                      >
                        {p.gravidade.texto}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Modal>
  );
}
