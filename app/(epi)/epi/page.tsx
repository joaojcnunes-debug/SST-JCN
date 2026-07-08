"use client";

import {
  HardHat,
  Boxes,
  FileDown,
  FileSignature,
  ShieldCheck,
  Truck,
  History,
} from "lucide-react";

const ROADMAP = [
  {
    icon: Boxes,
    fase: "Fase 1",
    titulo: "Cadastro & Estoque",
    desc: "Catálogo de EPI por empresa (vinculado ao CA), entradas/saídas, saldo e alerta de mínimo.",
  },
  {
    icon: FileDown,
    fase: "Fase 2",
    titulo: "Importação de NF-e",
    desc: "Entrada automática no estoque a partir do XML da nota fiscal (deduplicação por chNFe).",
  },
  {
    icon: FileSignature,
    fase: "Fase 3",
    titulo: "Entrega — ficha física",
    desc: "Ficha de entrega em PDF vetorial, reaproveitando o pipeline de assinatura digital.",
  },
  {
    icon: ShieldCheck,
    fase: "Fase 4",
    titulo: "Entrega — biometria",
    desc: "Assinatura do recebedor com trilha imutável (hash + evidências) e selagem PAdES.",
  },
  {
    icon: Truck,
    fase: "Fase 5",
    titulo: "Transferência entre empresas",
    desc: "Movimentação atômica e auditável de estoque de uma empresa para outra.",
  },
  {
    icon: History,
    fase: "Fase 6",
    titulo: "Histórico & CA (MTE)",
    desc: "Trilha append-only por colaborador e validação do CA junto ao MTE.",
  },
];

export default function EpiHomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-verde-primary/10 text-verde-primary">
          <HardHat className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestão de EPI</h1>
          <p className="text-sm text-gray-600">
            Controle de Equipamentos de Proteção Individual por empresa: catálogo,
            estoque, entregas e histórico. Acesso interno (equipe) e do cliente
            (Portal), isolado por empresa.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Módulo em construção — Fase 0 (fundação).</strong> A estrutura, o
        card e a permissão do módulo já estão no ar. As funcionalidades entram por
        fases, com aprovação a cada etapa.
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Roadmap
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.fase}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-verde-primary" />
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {f.fase}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  {f.titulo}
                </h3>
                <p className="mt-1 text-xs text-gray-600">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
