"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, FileClock, Loader2 } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useLaudosValidade,
  useSalvarValidade,
  type LaudoValidadeItem,
  type TipoLaudo,
} from "@/lib/hooks/useLaudosValidade";
import { cn } from "@/lib/utils";

const TIPOS: TipoLaudo[] = [
  "Inspeção", "Conformidade", "Não Conformidade", "AET", "AEP", "DRPS", "Análise de Químicos", "Apreciação", "Investigação",
];

type FiltroStatus = "todos" | "sem" | "a_vencer" | "vencido" | "em_dia";

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}

function classifica(validade: string): Exclude<FiltroStatus, "todos" | "sem"> {
  const d = diasAte(validade);
  if (d < 0) return "vencido";
  if (d <= 60) return "a_vencer";
  return "em_dia";
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function ValidadesPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const canEdit = useCanEdit();
  const { data: laudos = [], isLoading } = useLaudosValidade();
  const salvar = useSalvarValidade();

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoLaudo | "">("");
  const [status, setStatus] = useState<FiltroStatus>("todos");

  useEffect(() => {
    if (user?.perfil === "Cliente") router.replace("/portal-cliente/inicio");
  }, [user?.perfil, router]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return laudos.filter((l) => {
      if (tipo && l.tipo !== tipo) return false;
      if (q && !(l.empresaNome ?? "").toLowerCase().includes(q)) return false;
      if (status !== "todos") {
        const s = l.data_validade ? classifica(l.data_validade) : "sem";
        if (status !== s) return false;
      }
      return true;
    });
  }, [laudos, busca, tipo, status]);

  const semValidade = laudos.filter((l) => !l.data_validade).length;

  return (
    <div className="min-h-screen bg-[#f6f5f2]">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <Link href="/visao-geral" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="size-4" /> Visão geral
        </Link>

        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
            <FileClock className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Validades de Documentos</h1>
            <p className="text-sm text-gray-500">
              Informe a validade de cada laudo num lugar só — {laudos.length} laudos
              {semValidade > 0 && <span className="text-amber-600"> · {semValidade} sem validade</span>}.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none"
            />
          </div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoLaudo | "")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-verde-primary focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FiltroStatus)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-verde-primary focus:outline-none"
          >
            <option value="todos">Todos os status</option>
            <option value="sem">Sem validade</option>
            <option value="vencido">Vencidos</option>
            <option value="a_vencer">A vencer (60d)</option>
            <option value="em_dia">Em dia</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-gray-400">
              <Loader2 className="size-4 animate-spin" /> Carregando laudos…
            </div>
          ) : filtrados.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">Nenhum laudo com esses filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-2.5">Empresa</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Data do doc.</th>
                    <th className="px-4 py-2.5">Validade</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map((l) => (
                    <LinhaValidade
                      key={`${l.tabela}-${l.id}`}
                      item={l}
                      canEdit={canEdit}
                      salvando={salvar.isPending}
                      onSalvar={(valor) =>
                        salvar.mutate({ tabela: l.tabela, idCol: l.idCol, id: l.id, data_validade: valor })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinhaValidade({
  item,
  canEdit,
  salvando,
  onSalvar,
}: {
  item: LaudoValidadeItem;
  canEdit: boolean;
  salvando: boolean;
  onSalvar: (valor: string | null) => void;
}) {
  const [val, setVal] = useState(item.data_validade ?? "");
  useEffect(() => setVal(item.data_validade ?? ""), [item.data_validade]);

  const st = val ? classifica(val) : "sem";
  const badge: Record<string, { txt: string; cls: string }> = {
    sem: { txt: "Sem validade", cls: "bg-gray-100 text-gray-500" },
    vencido: { txt: `vencido há ${val ? Math.abs(diasAte(val)) : 0}d`, cls: "bg-red-100 text-red-700" },
    a_vencer: { txt: `faltam ${val ? diasAte(val) : 0}d`, cls: "bg-amber-100 text-amber-700" },
    em_dia: { txt: "em dia", cls: "bg-green-100 text-green-700" },
  };
  const b = badge[st];

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="max-w-[260px] truncate px-4 py-2">
        <Link href={item.href} className="font-medium text-gray-800 hover:text-verde-primary" title={item.empresaNome ?? ""}>
          {item.empresaNome ?? "Sem empresa"}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{item.tipo}</td>
      <td className="whitespace-nowrap px-4 py-2 text-gray-500">{fmt(item.dataDoc)}</td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={val}
          disabled={!canEdit || salvando}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            if ((item.data_validade ?? "") !== val) onSalvar(val || null);
          }}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-100"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", b.cls)}>{b.txt}</span>
      </td>
    </tr>
  );
}
