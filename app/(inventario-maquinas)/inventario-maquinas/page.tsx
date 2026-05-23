"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Plus,
  ArrowLeft,
  Loader2,
  Wrench,
  CircleSlash,
  Search,
  ImageOff,
} from "lucide-react";
import { useInventarioMaquinas } from "@/lib/hooks/useInventarioMaquinas";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import {
  STATUS_MAQUINA_LABELS,
  type StatusMaquina,
} from "@/lib/supabase/types";

const STATUS_CORES: Record<StatusMaquina, string> = {
  OPERANTE: "bg-emerald-100 text-emerald-700",
  MANUTENCAO: "bg-amber-100 text-amber-700",
  INATIVA: "bg-gray-200 text-gray-700",
  BAIXADA: "bg-red-100 text-red-700",
  RESERVA: "bg-blue-100 text-blue-700",
};

export default function InventarioMaquinasPage() {
  const canCreate = useCanCreate();
  const { data: maquinas = [], isLoading } = useInventarioMaquinas();
  const { data: empresas = [] } = useEmpresas();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusMaquina | "TODAS">(
    "TODAS"
  );

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  const totais = useMemo(() => {
    const acc: Record<StatusMaquina, number> = {
      OPERANTE: 0,
      MANUTENCAO: 0,
      INATIVA: 0,
      BAIXADA: 0,
      RESERVA: 0,
    };
    maquinas.forEach((m) => {
      acc[m.status] += 1;
    });
    return acc;
  }, [maquinas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return maquinas.filter((m) => {
      if (filtroStatus !== "TODAS" && m.status !== filtroStatus) return false;
      if (!q) return true;
      return [
        m.nome,
        m.marca,
        m.modelo,
        m.numero_serie,
        m.numero_patrimonio,
        m.localizacao,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [maquinas, busca, filtroStatus]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao início
        </Link>
        {canCreate && (
          <Link
            href="/inventario-maquinas/nova"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="size-4" /> Nova máquina
          </Link>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Boxes className="size-5 text-blue-600" />
          Inventário de Máquinas e Equipamentos
        </h1>
        <p className="text-sm text-gray-600">
          Cadastro de máquinas e equipamentos. Patrimônio interno da Chabra
          (sem empresa vinculada) ou de empresas clientes. Suporta foto,
          localização e status operacional.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumoCard
          label="Total"
          valor={isLoading ? "…" : maquinas.length}
          icon={<Boxes className="size-4" />}
          cor="bg-blue-50 text-blue-700 border-blue-200"
        />
        <ResumoCard
          label="Operantes"
          valor={isLoading ? "…" : totais.OPERANTE}
          icon={<Boxes className="size-4" />}
          cor="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <ResumoCard
          label="Em manutenção"
          valor={isLoading ? "…" : totais.MANUTENCAO}
          icon={<Wrench className="size-4" />}
          cor="bg-amber-50 text-amber-700 border-amber-200"
        />
        <ResumoCard
          label="Inativas / baixadas"
          valor={isLoading ? "…" : totais.INATIVA + totais.BAIXADA}
          icon={<CircleSlash className="size-4" />}
          cor="bg-gray-50 text-gray-700 border-gray-200"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, marca, modelo, série..."
            className="w-full rounded-md border border-gray-300 bg-white px-9 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) =>
            setFiltroStatus(e.target.value as StatusMaquina | "TODAS")
          }
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="TODAS">Todos os status</option>
          <option value="OPERANTE">Operantes</option>
          <option value="MANUTENCAO">Em manutenção</option>
          <option value="INATIVA">Inativas</option>
          <option value="BAIXADA">Baixadas</option>
        </select>
      </div>

      {/* Lista */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            {maquinas.length === 0 ? (
              <>
                Nenhuma máquina cadastrada ainda.{" "}
                {canCreate && (
                  <>
                    Clique em <strong>Nova máquina</strong> para começar.
                  </>
                )}
              </>
            ) : (
              "Nenhum resultado para os filtros atuais."
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((m) => (
              <li key={m.id_maquina}>
                <Link
                  href={`/inventario-maquinas/${m.id_maquina}`}
                  className="flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                    {m.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.foto_url}
                        alt={m.nome}
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageOff className="size-6 text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {m.nome}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          STATUS_CORES[m.status]
                        }`}
                      >
                        {STATUS_MAQUINA_LABELS[m.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {[m.marca, m.modelo].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {m.id_empresa
                        ? empresaMap.get(m.id_empresa) ?? "Empresa removida"
                        : "Patrimônio Chabra"}
                      {m.localizacao ? ` · ${m.localizacao}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResumoCard({
  label,
  valor,
  icon,
  cor,
}: {
  label: string;
  valor: string | number;
  icon: React.ReactNode;
  cor: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm`}>
      <div className={`flex size-9 items-center justify-center rounded-md ${cor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <p className="text-xl font-bold leading-tight text-gray-900">{valor}</p>
      </div>
    </div>
  );
}
