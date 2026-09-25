"use client";

// Certificados de treinamento (v258) — controle de QUEM está emitindo.
//
// Cada linha é um certificado entregue a um trabalhador de uma empresa
// atendida. O ponto da tela é o emissor: o quadro "Por emissor" mostra quanto
// cada um emitiu e serve de filtro para a tabela.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Award,
  CalendarClock,
  CalendarX,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { useUserStore } from "@/lib/store";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCPF } from "@/lib/utils";

// A tabela é nova (v258) e ainda não está no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function certDb() { return createSupabaseBrowserClient() as any; }

interface Certificado {
  id_certificado: string;
  id_empresa: string;
  trabalhador_nome: string;
  trabalhador_cpf: string | null;
  setor: string | null;
  cargo: string | null;
  nr: string | null;
  treinamento: string;
  carga_horaria: number | null;
  data_realizacao: string | null;
  data_emissao: string;
  validade: string | null;
  numero: string | null;
  instrutor: string | null;
  emitido_por_id: string | null;
  emitido_por_nome: string;
  observacoes: string | null;
  empresas: { nome_empresa: string | null } | null;
}

interface Emissor {
  id_usuario: string;
  nome: string;
}

type Situacao = "valido" | "vence" | "vencido" | "sem";

const SITUACAO: Record<Situacao, { rotulo: string; cls: string }> = {
  valido: { rotulo: "Válido", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  vence: { rotulo: "Vence em 30 dias", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  vencido: { rotulo: "Vencido", cls: "bg-red-50 text-red-700 ring-red-200" },
  sem: { rotulo: "Sem validade", cls: "bg-gray-50 text-gray-600 ring-gray-200" },
};

const NRS = ["NR-05", "NR-06", "NR-10", "NR-11", "NR-12", "NR-17", "NR-18", "NR-20", "NR-23", "NR-33", "NR-35"];

/** Data de hoje em yyyy-mm-dd no fuso do navegador — compara direto com `date` do banco. */
function hojeIso(deslocDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function situacaoDe(validade: string | null): Situacao {
  if (!validade) return "sem";
  if (validade < hojeIso()) return "vencido";
  if (validade <= hojeIso(30)) return "vence";
  return "valido";
}

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

interface Form {
  id_empresa: string | null;
  trabalhador_nome: string;
  trabalhador_cpf: string;
  setor: string;
  cargo: string;
  nr: string;
  treinamento: string;
  carga_horaria: string;
  data_realizacao: string;
  data_emissao: string;
  validade: string;
  numero: string;
  instrutor: string;
  emitido_por_id: string;
  observacoes: string;
}

function formVazio(emissorId: string): Form {
  return {
    id_empresa: null,
    trabalhador_nome: "",
    trabalhador_cpf: "",
    setor: "",
    cargo: "",
    nr: "",
    treinamento: "",
    carga_horaria: "",
    data_realizacao: "",
    data_emissao: hojeIso(),
    validade: "",
    numero: "",
    instrutor: "",
    emitido_por_id: emissorId,
    observacoes: "",
  };
}

function formDe(c: Certificado): Form {
  return {
    id_empresa: c.id_empresa,
    trabalhador_nome: c.trabalhador_nome,
    trabalhador_cpf: c.trabalhador_cpf ?? "",
    setor: c.setor ?? "",
    cargo: c.cargo ?? "",
    nr: c.nr ?? "",
    treinamento: c.treinamento,
    carga_horaria: c.carga_horaria != null ? String(c.carga_horaria) : "",
    data_realizacao: c.data_realizacao ?? "",
    data_emissao: c.data_emissao,
    validade: c.validade ?? "",
    numero: c.numero ?? "",
    instrutor: c.instrutor ?? "",
    emitido_por_id: c.emitido_por_id ?? "",
    observacoes: c.observacoes ?? "",
  };
}

export default function CertificadosPage() {
  const user = useUserStore((s) => s.user);
  const canEdit = useCanEdit();
  const qc = useQueryClient();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ["certificados-treinamento"],
    queryFn: () =>
      fetchAllRows<Certificado>((de, ate) =>
        certDb()
          .from("certificados_treinamento")
          .select("*, empresas(nome_empresa)")
          .order("data_emissao", { ascending: false })
          .range(de, ate)
      ),
  });

  const { data: emissores = [] } = useQuery({
    queryKey: ["certificados-emissores"],
    queryFn: async (): Promise<Emissor[]> => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("usuarios")
        .select("id_usuario, nome")
        .in("perfil", ["Admin", "Tecnico"])
        .eq("ativo_sistema", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Emissor[];
    },
  });

  const [busca, setBusca] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState<string | null>(null);
  const [emissorFiltro, setEmissorFiltro] = useState<string | null>(null);
  const [situacaoFiltro, setSituacaoFiltro] = useState<Situacao | "">("");
  const [editando, setEditando] = useState<Certificado | "novo" | null>(null);

  // Ranking de quem emite — a pergunta principal da tela.
  const porEmissor = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of certificados) m.set(c.emitido_por_nome, (m.get(c.emitido_por_nome) ?? 0) + 1);
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [certificados]);

  const totais = useMemo(() => {
    const mes = hojeIso().slice(0, 7);
    let noMes = 0, vence = 0, vencido = 0;
    for (const c of certificados) {
      if (c.data_emissao.startsWith(mes)) noMes++;
      const s = situacaoDe(c.validade);
      if (s === "vence") vence++;
      if (s === "vencido") vencido++;
    }
    return { total: certificados.length, noMes, vence, vencido };
  }, [certificados]);

  const filtrados = useMemo(() => {
    let lista = certificados;
    if (empresaFiltro) lista = lista.filter((c) => c.id_empresa === empresaFiltro);
    if (emissorFiltro) lista = lista.filter((c) => c.emitido_por_nome === emissorFiltro);
    if (situacaoFiltro) lista = lista.filter((c) => situacaoDe(c.validade) === situacaoFiltro);
    if (busca.trim()) {
      lista = buscar(lista, busca, (c) => [
        c.trabalhador_nome,
        c.trabalhador_cpf ?? "",
        c.treinamento,
        c.nr ?? "",
        c.empresas?.nome_empresa ?? "",
        c.numero ?? "",
      ]).itens;
    }
    return lista;
  }, [certificados, empresaFiltro, emissorFiltro, situacaoFiltro, busca]);

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await certDb().from("certificados_treinamento").delete().eq("id_certificado", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado excluído");
      qc.invalidateQueries({ queryKey: ["certificados-treinamento"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
  });

  const temFiltro = !!(busca || empresaFiltro || emissorFiltro || situacaoFiltro);

  // O menu já esconde de Cliente; isto cobre quem digitar a URL.
  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  return (
    <div className="space-y-5">
      <ConfirmHost />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Award className="size-5 text-verde-primary" />
            Certificados
          </h1>
          <p className="text-sm text-gray-500">
            Certificados de treinamento emitidos aos trabalhadores e quem emitiu cada um.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditando("novo")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Plus className="size-4" /> Novo certificado
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Total emitidos" valor={totais.total} icone={Award} cor="text-sky-600" />
        <Cartao rotulo="Emitidos este mês" valor={totais.noMes} icone={UserCheck} cor="text-emerald-600" />
        <Cartao
          rotulo="Vencem em 30 dias"
          valor={totais.vence}
          icone={CalendarClock}
          cor="text-amber-600"
          onClick={() => setSituacaoFiltro((s) => (s === "vence" ? "" : "vence"))}
          ativo={situacaoFiltro === "vence"}
        />
        <Cartao
          rotulo="Vencidos"
          valor={totais.vencido}
          icone={CalendarX}
          cor="text-red-600"
          onClick={() => setSituacaoFiltro((s) => (s === "vencido" ? "" : "vencido"))}
          ativo={situacaoFiltro === "vencido"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Por emissor */}
        <div className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <UserCheck className="size-4 text-verde-primary" /> Por emissor
          </h2>
          <p className="mb-3 text-xs text-gray-400">Clique para filtrar a lista</p>
          {isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : porEmissor.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">Nenhum certificado ainda.</p>
          ) : (
            <ul className="space-y-1">
              {porEmissor.map((e) => (
                <li key={e.nome}>
                  <button
                    type="button"
                    onClick={() => setEmissorFiltro((f) => (f === e.nome ? null : e.nome))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50",
                      emissorFiltro === e.nome && "bg-sky-50 ring-1 ring-sky-200"
                    )}
                  >
                    <span className="truncate text-gray-700">{e.nome}</span>
                    <span className="font-bold text-gray-900">{e.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lista */}
        <div className="min-w-0 space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[1fr_260px_180px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar trabalhador, CPF, treinamento, NR..."
                className={cn(inputCls, "pl-8")}
              />
            </div>
            <EmpresaSelect value={empresaFiltro} onChange={setEmpresaFiltro} placeholder="Todas as empresas" allowAll />
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value as Situacao | "")}
              className={inputCls}
            >
              <option value="">Todas as situações</option>
              {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
                <option key={s} value={s}>{SITUACAO[s].rotulo}</option>
              ))}
            </select>
          </div>
          {temFiltro && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {filtrados.length} de {certificados.length} certificados
              {emissorFiltro && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Emissor: {emissorFiltro}</span>}
              <button
                type="button"
                onClick={() => { setBusca(""); setEmpresaFiltro(null); setEmissorFiltro(null); setSituacaoFiltro(""); }}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
              >
                <X className="size-3" /> Limpar filtros
              </button>
            </div>
          )}

          {isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {certificados.length === 0
                ? "Nenhum certificado cadastrado. Use \"Novo certificado\" para registrar o primeiro."
                : "Nenhum certificado com esses filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-medium">Trabalhador</th>
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Treinamento</th>
                    <th className="py-2 pr-3 font-medium">Emissão</th>
                    <th className="py-2 pr-3 font-medium">Validade</th>
                    <th className="py-2 pr-3 font-medium">Emitido por</th>
                    {canEdit && <th className="py-2 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => {
                    const s = situacaoDe(c.validade);
                    return (
                      <tr key={c.id_certificado} className="border-b border-gray-50 align-top hover:bg-gray-50/60">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-gray-900">{c.trabalhador_nome}</div>
                          <div className="text-xs text-gray-500">
                            {[c.trabalhador_cpf ? formatCPF(c.trabalhador_cpf) : null, c.setor, c.cargo].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{c.empresas?.nome_empresa ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          <div className="text-gray-900">{c.treinamento}</div>
                          <div className="text-xs text-gray-500">
                            {[c.nr, c.carga_horaria ? `${c.carga_horaria}h` : null, c.numero ? `nº ${c.numero}` : null].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-gray-700">{fmtData(c.data_emissao)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="whitespace-nowrap text-gray-700">{fmtData(c.validade)}</div>
                          <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", SITUACAO[s].cls)}>
                            {SITUACAO[s].rotulo}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{c.emitido_por_nome}</td>
                        {canEdit && (
                          <td className="whitespace-nowrap py-2.5 text-right">
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => setEditando(c)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Excluir"
                              onClick={async () => {
                                const ok = await confirmar({
                                  title: "Excluir certificado?",
                                  description: `${c.treinamento} — ${c.trabalhador_nome}. Esta ação não pode ser desfeita.`,
                                  confirmLabel: "Excluir",
                                  variant: "danger",
                                });
                                if (ok) excluir.mutate(c.id_certificado);
                              }}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editando && (
        <CertificadoModal
          certificado={editando === "novo" ? null : editando}
          emissores={emissores}
          emissorPadrao={user?.id_usuario ?? ""}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  icone: Icone,
  cor,
  onClick,
  ativo,
}: {
  rotulo: string;
  valor: number;
  icone: typeof Award;
  cor: string;
  onClick?: () => void;
  ativo?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm",
        onClick && "hover:border-gray-200",
        ativo && "ring-2 ring-sky-300"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{rotulo}</span>
        <Icone className={cn("size-4", cor)} />
      </div>
      <div className={cn("mt-1 text-2xl font-bold", cor)}>{valor}</div>
    </Tag>
  );
}

function CertificadoModal({
  certificado,
  emissores,
  emissorPadrao,
  onClose,
}: {
  certificado: Certificado | null;
  emissores: Emissor[];
  emissorPadrao: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() =>
    certificado ? formDe(certificado) : formVazio(emissorPadrao)
  );
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.id_empresa) throw new Error("Selecione a empresa");
      if (!form.trabalhador_nome.trim()) throw new Error("Informe o nome do trabalhador");
      if (!form.treinamento.trim()) throw new Error("Informe o treinamento");
      if (!form.data_emissao) throw new Error("Informe a data de emissão");
      if (form.validade && form.validade < form.data_emissao) {
        throw new Error("A validade não pode ser anterior à emissão");
      }
      const emissor = emissores.find((e) => e.id_usuario === form.emitido_por_id);
      // Mantém o nome gravado se o emissor original já não está na lista (inativo).
      const emissorNome = emissor?.nome ?? certificado?.emitido_por_nome;
      if (!emissorNome) throw new Error("Selecione quem emitiu o certificado");

      const n = (s: string) => (s.trim() ? s.trim() : null);
      const linha = {
        id_empresa: form.id_empresa,
        trabalhador_nome: form.trabalhador_nome.trim(),
        trabalhador_cpf: n(form.trabalhador_cpf.replace(/\D/g, "")),
        setor: n(form.setor),
        cargo: n(form.cargo),
        nr: n(form.nr),
        treinamento: form.treinamento.trim(),
        carga_horaria: form.carga_horaria ? Number(form.carga_horaria.replace(",", ".")) : null,
        data_realizacao: form.data_realizacao || null,
        data_emissao: form.data_emissao,
        validade: form.validade || null,
        numero: n(form.numero),
        instrutor: n(form.instrutor),
        emitido_por_id: emissor?.id_usuario ?? certificado?.emitido_por_id ?? null,
        emitido_por_nome: emissorNome,
        observacoes: n(form.observacoes),
      };
      const tabela = certDb().from("certificados_treinamento");
      const { error } = certificado
        ? await tabela.update(linha).eq("id_certificado", certificado.id_certificado)
        : await tabela.insert(linha);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(certificado ? "Certificado atualizado" : "Certificado registrado");
      qc.invalidateQueries({ queryKey: ["certificados-treinamento"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={certificado ? "Editar certificado" : "Novo certificado"}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
            className="rounded-lg bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Empresa *" className="sm:col-span-2">
          <EmpresaSelect value={form.id_empresa} onChange={(v) => set("id_empresa", v)} allowAll />
        </Campo>
        <Campo rotulo="Trabalhador *">
          <input className={inputCls} value={form.trabalhador_nome} onChange={(e) => set("trabalhador_nome", e.target.value)} />
        </Campo>
        <Campo rotulo="CPF">
          <input className={inputCls} value={form.trabalhador_cpf} onChange={(e) => set("trabalhador_cpf", e.target.value)} placeholder="000.000.000-00" />
        </Campo>
        <Campo rotulo="Setor">
          <input className={inputCls} value={form.setor} onChange={(e) => set("setor", e.target.value)} />
        </Campo>
        <Campo rotulo="Cargo / função">
          <input className={inputCls} value={form.cargo} onChange={(e) => set("cargo", e.target.value)} />
        </Campo>
        <Campo rotulo="NR">
          <input className={inputCls} list="certificados-nrs" value={form.nr} onChange={(e) => set("nr", e.target.value)} placeholder="Ex.: NR-35" />
          <datalist id="certificados-nrs">
            {NRS.map((nr) => <option key={nr} value={nr} />)}
          </datalist>
        </Campo>
        <Campo rotulo="Treinamento *">
          <input className={inputCls} value={form.treinamento} onChange={(e) => set("treinamento", e.target.value)} placeholder="Ex.: Trabalho em Altura" />
        </Campo>
        <Campo rotulo="Carga horária (h)">
          <input className={inputCls} inputMode="decimal" value={form.carga_horaria} onChange={(e) => set("carga_horaria", e.target.value)} />
        </Campo>
        <Campo rotulo="Data de realização">
          <input type="date" className={inputCls} value={form.data_realizacao} onChange={(e) => set("data_realizacao", e.target.value)} />
        </Campo>
        <Campo rotulo="Data de emissão *">
          <input type="date" className={inputCls} value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
        </Campo>
        <Campo rotulo="Validade">
          <input type="date" className={inputCls} value={form.validade} onChange={(e) => set("validade", e.target.value)} />
        </Campo>
        <Campo rotulo="Nº do certificado">
          <input className={inputCls} value={form.numero} onChange={(e) => set("numero", e.target.value)} />
        </Campo>
        <Campo rotulo="Instrutor">
          <input className={inputCls} value={form.instrutor} onChange={(e) => set("instrutor", e.target.value)} />
        </Campo>
        <Campo rotulo="Emitido por *" className="sm:col-span-2">
          <select className={inputCls} value={form.emitido_por_id} onChange={(e) => set("emitido_por_id", e.target.value)}>
            <option value="">Selecione...</option>
            {certificado?.emitido_por_id &&
              !emissores.some((e) => e.id_usuario === certificado.emitido_por_id) && (
                <option value={certificado.emitido_por_id}>{certificado.emitido_por_nome} (inativo)</option>
              )}
            {emissores.map((e) => (
              <option key={e.id_usuario} value={e.id_usuario}>{e.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Observações" className="sm:col-span-2">
          <textarea rows={2} className={inputCls} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-sm font-medium text-gray-700">{rotulo}</span>
      {children}
    </label>
  );
}
