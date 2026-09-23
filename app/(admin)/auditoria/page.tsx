"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ScrollText,
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  CheckCircle2,
} from "lucide-react";
import { useAuditoriaEventos, useAuditoriaTabelas, type FiltrosAuditoria } from "@/lib/hooks/useAuditoriaEventos";
import { useUsuarios } from "@/lib/hooks/useGestao";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import {
  agruparPorDia,
  descreverEvento,
  ehConclusao,
  formatarValor,
  quemGravou,
  rotaDoRegistro,
  rotuloCampo,
  rotuloModulo,
  rotuloTabela,
} from "@/lib/auditoria/eventos";
import type { AuditoriaAcao, AuditoriaEvento } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const ACAO_CORES: Record<AuditoriaAcao, string> = {
  criou: "bg-emerald-100 text-emerald-700",
  editou: "bg-amber-100 text-amber-700",
  excluiu: "bg-red-100 text-red-700",
};

function dataLocal(diasAtras = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AuditoriaPage() {
  // useSearchParams() exige um limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={null}>
      <AuditoriaConteudo />
    </Suspense>
  );
}

function AuditoriaConteudo() {
  const params = useSearchParams();
  // Deep link (a aba Histórico de um documento manda tabela + registro para cá).
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(() => ({
    // de/ate pela URL: a tela Presença (v219) manda para o dia da pessoa.
    de: params.get("de") ?? (params.get("registro") ? undefined : dataLocal(7)),
    ate: params.get("ate") ?? (params.get("registro") ? undefined : dataLocal(0)),
    tabela: params.get("tabela") ?? undefined,
    registroId: params.get("registro") ?? undefined,
    email: params.get("email") ?? undefined,
    modulo: params.get("modulo") ?? undefined,
    idEmpresa: params.get("empresa") ?? undefined,
  }));
  // Texto livre só entra no filtro ao confirmar (Enter/Buscar) — cada tecla
  // seria uma consulta full-text no servidor.
  const [buscaRascunho, setBuscaRascunho] = useState("");
  const [campoRascunho, setCampoRascunho] = useState("");

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, error } =
    useAuditoriaEventos(filtros);
  const { data: usuarios = [] } = useUsuarios();
  const { data: empresas = [] } = useEmpresas();
  const { data: tabelas = [] } = useAuditoriaTabelas();

  const nomes = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const nomesEmpresas = useMemo(() => new Map(empresas.map((e) => [e.id_empresa, e.nome_empresa])), [empresas]);
  const modulos = useMemo(
    () => Array.from(new Set(tabelas.map((t) => t.modulo))).sort((a, b) => rotuloModulo(a).localeCompare(rotuloModulo(b))),
    [tabelas],
  );
  const tabelasDoModulo = useMemo(
    () => (filtros.modulo ? tabelas.filter((t) => t.modulo === filtros.modulo) : tabelas),
    [tabelas, filtros.modulo],
  );

  const eventos = useMemo(() => data?.pages.flatMap((p) => p.eventos) ?? [], [data]);
  const total = data?.pages[0]?.total;
  const grupos = useMemo(() => agruparPorDia(eventos), [eventos]);

  const set = (parcial: Partial<FiltrosAuditoria>) => setFiltros((f) => ({ ...f, ...parcial }));
  const confirmarTexto = () => set({ busca: buscaRascunho || undefined, campo: campoRascunho || undefined });
  const limpar = () => {
    setBuscaRascunho("");
    setCampoRascunho("");
    setFiltros({ de: dataLocal(7), ate: dataLocal(0) });
  };
  const periodoAtivo = (dias: number | null) =>
    dias === null ? !filtros.de && !filtros.ate : filtros.de === dataLocal(dias) && filtros.ate === dataLocal(0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <ScrollText className="mt-0.5 size-5 text-gray-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500">
            Tudo que foi criado, editado ou excluído no painel, gravado pelo banco no momento
            da mudança — quem, quando, o quê e o valor anterior. Só administradores veem esta tela.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Período</span>
          {[
            { rotulo: "Hoje", dias: 0 },
            { rotulo: "7 dias", dias: 7 },
            { rotulo: "30 dias", dias: 30 },
            { rotulo: "Tudo", dias: null },
          ].map((p) => (
            <button
              key={p.rotulo}
              type="button"
              onClick={() => set(p.dias === null ? { de: undefined, ate: undefined } : { de: dataLocal(p.dias), ate: dataLocal(0) })}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                periodoAtivo(p.dias)
                  ? "border-verde-primary bg-verde-light text-verde-primary"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              {p.rotulo}
            </button>
          ))}
          <input
            type="date"
            value={filtros.de ?? ""}
            onChange={(e) => set({ de: e.target.value || undefined })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            aria-label="De"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={filtros.ate ?? ""}
            onChange={(e) => set({ ate: e.target.value || undefined })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            aria-label="Até"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Pessoa">
            <select value={filtros.email ?? ""} onChange={(e) => set({ email: e.target.value || undefined })} className={SELECT}>
              <option value="">Todas</option>
              {usuarios.map((u) => (
                <option key={u.email} value={u.email.toLowerCase()}>{u.nome}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Módulo">
            <select
              value={filtros.modulo ?? ""}
              onChange={(e) => set({ modulo: e.target.value || undefined, tabela: undefined })}
              className={SELECT}
            >
              <option value="">Todos</option>
              {modulos.map((m) => (
                <option key={m} value={m}>{rotuloModulo(m)}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Ação">
            <select value={filtros.acao ?? ""} onChange={(e) => set({ acao: (e.target.value as AuditoriaAcao) || "" })} className={SELECT}>
              <option value="">Todas</option>
              <option value="criou">Criou</option>
              <option value="editou">Editou</option>
              <option value="excluiu">Excluiu</option>
            </select>
          </Campo>
          <Campo rotulo="Empresa">
            <select value={filtros.idEmpresa ?? ""} onChange={(e) => set({ idEmpresa: e.target.value || undefined })} className={SELECT}>
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tabela">
            <select value={filtros.tabela ?? ""} onChange={(e) => set({ tabela: e.target.value || undefined })} className={SELECT}>
              <option value="">Todas</option>
              {tabelasDoModulo.map((t) => (
                <option key={t.tabela} value={t.tabela}>{rotuloTabela(t.tabela)} ({t.tabela})</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Campo alterado">
            <input
              type="text"
              value={campoRascunho}
              onChange={(e) => setCampoRascunho(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmarTexto()}
              onBlur={confirmarTexto}
              placeholder="ex.: status, telefone, cnpj"
              className={INPUT}
            />
          </Campo>
          <Campo rotulo="Busca livre" className="lg:col-span-2">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={buscaRascunho}
                  onChange={(e) => setBuscaRascunho(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarTexto()}
                  placeholder="nome, id, valor antigo ou novo…"
                  className={cn(INPUT, "pl-7")}
                />
              </div>
              <button type="button" onClick={confirmarTexto} className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-dark">
                Buscar
              </button>
            </div>
          </Campo>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-2">
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!filtros.soConclusoes}
              onChange={(e) => set({ soConclusoes: e.target.checked || undefined })}
              className="size-4 rounded border-gray-300"
            />
            Só conclusões (status foi para concluído/finalizado)
          </label>
          <span className="ml-auto text-xs text-gray-500">
            {isLoading ? "Carregando…" : total !== undefined ? `${total.toLocaleString("pt-BR")} evento${total === 1 ? "" : "s"}` : `${eventos.length} eventos`}
            {filtros.soConclusoes && !isLoading ? " (antes do filtro de conclusão)" : ""}
          </span>
          <button type="button" onClick={limpar} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
            <X className="size-3" /> Limpar
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3", isFetching && "animate-spin")} /> Atualizar
          </button>
        </div>
      </div>

      {/* Resultado */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível ler a auditoria: {error.message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : eventos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          Nenhum evento para esses filtros.
          {filtros.de || filtros.ate ? " Experimente ampliar o período." : ""}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <section key={g.dia}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {new Date(`${g.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                <span className="ml-2 font-normal normal-case text-gray-400">{g.eventos.length} evento{g.eventos.length === 1 ? "" : "s"}</span>
              </h2>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
                {g.eventos.map((ev) => (
                  <LinhaEvento key={ev.id} ev={ev} nomes={nomes} nomesEmpresas={nomesEmpresas} />
                ))}
              </ul>
            </section>
          ))}
          {hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SELECT = "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-verde-primary focus:outline-none";
const INPUT = "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-verde-primary focus:outline-none";

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{rotulo}</span>
      {children}
    </label>
  );
}

function LinhaEvento({
  ev,
  nomes,
  nomesEmpresas,
}: {
  ev: AuditoriaEvento;
  nomes: ReadonlyMap<string, string>;
  nomesEmpresas: ReadonlyMap<string, string>;
}) {
  const [aberto, setAberto] = useState(false);
  const rota = rotaDoRegistro(ev);
  const hora = new Date(ev.ocorrido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const empresa = ev.id_empresa ? nomesEmpresas.get(ev.id_empresa) : null;
  const concluiu = ehConclusao(ev);

  return (
    <li>
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={aberto ? "Recolher" : "Ver detalhes"}
        >
          {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="mt-0.5 w-11 shrink-0 font-mono text-xs text-gray-500">{hora}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">{quemGravou(ev, nomes)}</span>{" "}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", ACAO_CORES[ev.acao])}>{ev.acao}</span>{" "}
            {concluiu && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-verde-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-verde-primary">
                <CheckCircle2 className="size-3" /> concluiu
              </span>
            )}{" "}
            <span>{descreverEvento(ev).replace(/^(criou|editou|excluiu) /, "")}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{rotuloModulo(ev.modulo)}</span>
            {empresa && <span className="truncate">{empresa}</span>}
            <span className="font-mono text-gray-400">{ev.tabela} · {ev.registro_id ?? "—"}</span>
          </p>
        </div>
        {rota && (
          <Link href={rota} className="mt-0.5 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-verde-primary" title="Abrir o registro">
            <ExternalLink className="size-4" />
          </Link>
        )}
      </div>
      {aberto && <DetalheEvento ev={ev} />}
    </li>
  );
}

function DetalheEvento({ ev }: { ev: AuditoriaEvento }) {
  const [tudo, setTudo] = useState(false);
  if (ev.acao === "editou") {
    return (
      <div className="mx-3 mb-3 overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-1.5">Campo</th>
              <th className="px-2 py-1.5">Antes</th>
              <th className="px-2 py-1.5">Depois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ev.campos_alterados.map((c) => (
              <tr key={c} className="align-top">
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-gray-700">{rotuloCampo(c)}</td>
                <td className="max-w-[24rem] break-words px-2 py-1.5 text-red-700"><Valor v={ev.antes?.[c]} /></td>
                <td className="max-w-[24rem] break-words px-2 py-1.5 text-emerald-700"><Valor v={ev.depois?.[c]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Criou / excluiu: a linha inteira, sem os campos vazios.
  const linha = (ev.acao === "criou" ? ev.depois : ev.antes) ?? {};
  const entradas = Object.entries(linha).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  const visiveis = tudo ? entradas : entradas.slice(0, 12);
  return (
    <div className="mx-3 mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {visiveis.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-32 shrink-0 truncate font-medium text-gray-600" title={k}>{rotuloCampo(k)}</dt>
            <dd className="min-w-0 break-words text-gray-800"><Valor v={v} /></dd>
          </div>
        ))}
      </dl>
      {entradas.length > 12 && (
        <button type="button" onClick={() => setTudo((t) => !t)} className="mt-2 text-xs font-medium text-verde-primary hover:underline">
          {tudo ? "Mostrar menos" : `Ver todos os ${entradas.length} campos`}
        </button>
      )}
    </div>
  );
}

function Valor({ v }: { v: unknown }) {
  const texto = formatarValor(v);
  const ehObjeto = v !== null && typeof v === "object" && !Array.isArray(v);
  if (ehObjeto || texto.length > 300) {
    return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">{ehObjeto ? JSON.stringify(v, null, 1) : texto}</pre>;
  }
  return <>{texto}</>;
}
