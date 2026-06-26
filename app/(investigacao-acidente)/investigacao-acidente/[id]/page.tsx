"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Plus, Trash2, Loader2, ClipboardList } from "lucide-react";
import {
  useInvestigacaoAcidente,
  useSalvarInvestigacao,
  useEnviarMedidasParaPlano,
} from "@/lib/hooks/useInvestigacaoAcidente";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useCatalogoEmpresa } from "@/lib/hooks/useCatalogoEmpresa";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import MultiChipInput from "@/components/ui/MultiChipInput";
import BodyMap from "@/components/investigacao/BodyMap";
import { ISHIKAWA_CATS } from "@/lib/investigacao/ishikawa";
import type { TestemunhaAcidente } from "@/lib/supabase/types";

interface FormState {
  data_acidente: string;
  hora_acidente: string;
  local_acidente: string;
  setores: string[];
  data_investigacao: string;
  responsavel_tecnico: string;
  numero_cat: string;
  data_cat: string;
  acidentado_nome: string;
  acidentado_funcoes: string[];
  acidentado_admissao: string;
  tipo_acidente: string;
  houve_afastamento: boolean;
  dias_afastamento: string;
  gravidade: string;
  descricao: string;
  agente_causador: string;
  partes_corpo: string[];
  natureza_lesao: string;
  cid: string;
  testemunhas: TestemunhaAcidente[];
  causas_imediatas: string;
  causas_basicas: string;
  cinco_porques: string[];
  ishikawa: Record<string, string[]>;
  medidas: string;
  conclusao: string;
  status: string;
  data_validade: string;
}

const VAZIO: FormState = {
  data_acidente: "", hora_acidente: "", local_acidente: "", setores: [],
  data_investigacao: "", responsavel_tecnico: "", numero_cat: "", data_cat: "",
  acidentado_nome: "", acidentado_funcoes: [], acidentado_admissao: "",
  tipo_acidente: "", houve_afastamento: false, dias_afastamento: "", gravidade: "",
  descricao: "", agente_causador: "", partes_corpo: [], natureza_lesao: "", cid: "",
  testemunhas: [], causas_imediatas: "", causas_basicas: "", cinco_porques: [],
  ishikawa: {}, medidas: "", conclusao: "", status: "RASCUNHO", data_validade: "",
};

export default function EditorInvestigacaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useInvestigacaoAcidente(id);
  const salvar = useSalvarInvestigacao();
  const enviarPlano = useEnviarMedidasParaPlano();
  const { data: catalogo } = useCatalogoEmpresa(data?.id_empresa);
  const canEdit = useCanEdit();
  const ro = !canEdit;

  const [form, setForm] = useState<FormState>(VAZIO);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      data_acidente: data.data_acidente ?? "",
      hora_acidente: data.hora_acidente ?? "",
      local_acidente: data.local_acidente ?? "",
      setores: data.setores ?? [],
      data_investigacao: data.data_investigacao ?? "",
      responsavel_tecnico: data.responsavel_tecnico ?? "",
      numero_cat: data.numero_cat ?? "",
      data_cat: data.data_cat ?? "",
      acidentado_nome: data.acidentado_nome ?? "",
      acidentado_funcoes: data.acidentado_funcoes ?? [],
      acidentado_admissao: data.acidentado_admissao ?? "",
      tipo_acidente: data.tipo_acidente ?? "",
      houve_afastamento: data.houve_afastamento ?? false,
      dias_afastamento: data.dias_afastamento != null ? String(data.dias_afastamento) : "",
      gravidade: data.gravidade ?? "",
      descricao: data.descricao ?? "",
      agente_causador: data.agente_causador ?? "",
      partes_corpo: data.partes_corpo ?? [],
      natureza_lesao: data.natureza_lesao ?? "",
      cid: data.cid ?? "",
      testemunhas: data.testemunhas ?? [],
      causas_imediatas: data.causas_imediatas ?? "",
      causas_basicas: data.causas_basicas ?? "",
      cinco_porques: data.cinco_porques ?? [],
      ishikawa: data.ishikawa ?? {},
      medidas: data.medidas ?? "",
      conclusao: data.conclusao ?? "",
      status: data.status ?? "RASCUNHO",
      data_validade: data.data_validade ?? "",
    });
    setDirty(false);
  }, [data]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  async function handleSalvar() {
    await salvar.mutateAsync({
      id_investigacao: id,
      data_acidente: form.data_acidente || null,
      hora_acidente: form.hora_acidente || null,
      local_acidente: form.local_acidente || null,
      setores: form.setores,
      data_investigacao: form.data_investigacao || null,
      responsavel_tecnico: form.responsavel_tecnico || null,
      numero_cat: form.numero_cat || null,
      data_cat: form.data_cat || null,
      acidentado_nome: form.acidentado_nome || null,
      acidentado_funcoes: form.acidentado_funcoes,
      acidentado_admissao: form.acidentado_admissao || null,
      tipo_acidente: (form.tipo_acidente || null) as never,
      houve_afastamento: form.houve_afastamento,
      dias_afastamento: form.dias_afastamento ? parseInt(form.dias_afastamento, 10) : null,
      gravidade: (form.gravidade || null) as never,
      descricao: form.descricao || null,
      agente_causador: form.agente_causador || null,
      partes_corpo: form.partes_corpo,
      natureza_lesao: form.natureza_lesao || null,
      cid: form.cid || null,
      testemunhas: form.testemunhas.filter((t) => t.nome.trim() || t.depoimento.trim()),
      causas_imediatas: form.causas_imediatas || null,
      causas_basicas: form.causas_basicas || null,
      cinco_porques: form.cinco_porques.filter((p) => p.trim()),
      ishikawa: form.ishikawa,
      medidas: form.medidas || null,
      conclusao: form.conclusao || null,
      status: form.status as never,
      data_validade: form.data_validade || null,
    });
    setDirty(false);
    toast.success("Investigação salva");
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-gray-400">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (isError || !data) {
    return <div className="py-20 text-center text-sm text-gray-500">Investigação não encontrada.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/investigacao-acidente")} className="rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="size-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Investigação de acidente</h1>
            <p className="text-xs text-gray-500">{id}</p>
          </div>
        </div>
        {!ro && (
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvar.isPending || !dirty}
            className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {dirty ? "Salvar" : "Salvo"}
          </button>
        )}
      </div>

      {/* 1. Dados gerais */}
      <Secao titulo="Dados gerais">
        <Grid>
          <Campo label="Data do acidente" type="date" value={form.data_acidente} onChange={(v) => set("data_acidente", v)} ro={ro} />
          <Campo label="Hora" type="time" value={form.hora_acidente} onChange={(v) => set("hora_acidente", v)} ro={ro} />
          <Campo label="Local" value={form.local_acidente} onChange={(v) => set("local_acidente", v)} ro={ro} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Setores</label>
            <MultiChipInput value={form.setores} onChange={(v) => set("setores", v)} sugestoes={catalogo?.setores ?? []} placeholder="Adicionar setor…" ro={ro} />
          </div>
          <Campo label="Data da investigação" type="date" value={form.data_investigacao} onChange={(v) => set("data_investigacao", v)} ro={ro} />
          <Campo label="Responsável técnico" value={form.responsavel_tecnico} onChange={(v) => set("responsavel_tecnico", v)} ro={ro} />
          <Campo label="Nº da CAT" value={form.numero_cat} onChange={(v) => set("numero_cat", v)} ro={ro} />
          <Campo label="Data da CAT" type="date" value={form.data_cat} onChange={(v) => set("data_cat", v)} ro={ro} />
        </Grid>
      </Secao>

      {/* 2. Acidentado */}
      <Secao titulo="Acidentado">
        <Grid>
          <Campo label="Nome" value={form.acidentado_nome} onChange={(v) => set("acidentado_nome", v)} ro={ro} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cargo / função</label>
            <MultiChipInput value={form.acidentado_funcoes} onChange={(v) => set("acidentado_funcoes", v)} sugestoes={catalogo?.cargos ?? []} placeholder="Adicionar cargo/função…" ro={ro} />
          </div>
          <Campo label="Admissão" type="date" value={form.acidentado_admissao} onChange={(v) => set("acidentado_admissao", v)} ro={ro} />
          <Sel label="Tipo de acidente" value={form.tipo_acidente} onChange={(v) => set("tipo_acidente", v)} ro={ro}
            opcoes={[["", "—"], ["TIPICO", "Típico"], ["TRAJETO", "Trajeto"], ["DOENCA", "Doença ocupacional"]]} />
          <Sel label="Gravidade" value={form.gravidade} onChange={(v) => set("gravidade", v)} ro={ro}
            opcoes={[["", "—"], ["LEVE", "Leve"], ["GRAVE", "Grave"], ["FATAL", "Fatal"]]} />
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" disabled={ro} checked={form.houve_afastamento} onChange={(e) => set("houve_afastamento", e.target.checked)} className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary" />
              Houve afastamento
            </label>
            {form.houve_afastamento && (
              <Campo label="Dias" type="number" value={form.dias_afastamento} onChange={(v) => set("dias_afastamento", v)} ro={ro} className="w-24" />
            )}
          </div>
        </Grid>
      </Secao>

      {/* 3. Descrição */}
      <Secao titulo="Descrição do acidente">
        <Area label="Relato do ocorrido" value={form.descricao} onChange={(v) => set("descricao", v)} ro={ro} rows={4} />
        <Grid>
          <Campo label="Agente causador" value={form.agente_causador} onChange={(v) => set("agente_causador", v)} ro={ro} />
          <Campo label="Natureza da lesão" value={form.natureza_lesao} onChange={(v) => set("natureza_lesao", v)} ro={ro} />
          <Campo label="CID" value={form.cid} onChange={(v) => set("cid", v)} ro={ro} />
        </Grid>
        <div className="mt-2">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Parte(s) do corpo atingida(s)</label>
          <BodyMap value={form.partes_corpo} onChange={(v) => set("partes_corpo", v)} ro={ro} />
        </div>
      </Secao>

      {/* 4. Testemunhas */}
      <Secao titulo="Testemunhas">
        <div className="space-y-3">
          {form.testemunhas.map((t, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <input
                  disabled={ro}
                  value={t.nome}
                  onChange={(e) => {
                    const arr = [...form.testemunhas];
                    arr[i] = { ...arr[i], nome: e.target.value };
                    set("testemunhas", arr);
                  }}
                  placeholder="Nome da testemunha"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                />
                {!ro && (
                  <button type="button" onClick={() => set("testemunhas", form.testemunhas.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <textarea
                disabled={ro}
                value={t.depoimento}
                onChange={(e) => {
                  const arr = [...form.testemunhas];
                  arr[i] = { ...arr[i], depoimento: e.target.value };
                  set("testemunhas", arr);
                }}
                placeholder="Depoimento"
                rows={2}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              />
            </div>
          ))}
          {!ro && (
            <button type="button" onClick={() => set("testemunhas", [...form.testemunhas, { nome: "", depoimento: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Plus className="size-4" /> Adicionar testemunha
            </button>
          )}
        </div>
      </Secao>

      {/* 5. Análise de causas */}
      <Secao titulo="Análise de causas">
        <Area label="Causas imediatas (atos e condições inseguras)" value={form.causas_imediatas} onChange={(v) => set("causas_imediatas", v)} ro={ro} rows={3} />
        <Area label="Causas básicas (fatores pessoais e do trabalho)" value={form.causas_basicas} onChange={(v) => set("causas_basicas", v)} ro={ro} rows={3} />
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">5 Porquês</p>
          <div className="space-y-2">
            {form.cinco_porques.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-gray-400">{i + 1}º Por quê?</span>
                <input
                  disabled={ro}
                  value={p}
                  onChange={(e) => {
                    const arr = [...form.cinco_porques];
                    arr[i] = e.target.value;
                    set("cinco_porques", arr);
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                />
                {!ro && (
                  <button type="button" onClick={() => set("cinco_porques", form.cinco_porques.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {!ro && form.cinco_porques.length < 5 && (
              <button type="button" onClick={() => set("cinco_porques", [...form.cinco_porques, ""])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Plus className="size-4" /> Adicionar “Por quê?”
              </button>
            )}
          </div>
        </div>
      </Secao>

      {/* Diagrama de Ishikawa */}
      <Secao titulo="Diagrama de Ishikawa (6M)">
        <p className="-mt-1 mb-1 text-xs text-gray-500">
          Causas do acidente por categoria. Aparece como espinha de peixe no laudo.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ISHIKAWA_CATS.map((cat) => (
            <div key={cat} className="rounded-lg border border-gray-200 p-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-verde-primary">{cat}</p>
              <MultiChipInput
                value={form.ishikawa[cat] ?? []}
                onChange={(v) => set("ishikawa", { ...form.ishikawa, [cat]: v })}
                placeholder="Adicionar causa…"
                ro={ro}
              />
            </div>
          ))}
        </div>
      </Secao>

      {/* 6. Medidas + 7. Conclusão */}
      <Secao titulo="Medidas e conclusão">
        <Area label="Medidas corretivas e preventivas" value={form.medidas} onChange={(v) => set("medidas", v)} ro={ro} rows={3} />
        <Area label="Conclusão / parecer técnico" value={form.conclusao} onChange={(v) => set("conclusao", v)} ro={ro} rows={3} />
      </Secao>

      {/* Controle */}
      <Secao titulo="Controle do documento">
        <Grid>
          <Sel label="Situação" value={form.status} onChange={(v) => set("status", v)} ro={ro}
            opcoes={[["RASCUNHO", "Rascunho"], ["CONCLUIDA", "Concluída"]]} />
          <Campo label="Validade do documento" type="date" value={form.data_validade} onChange={(v) => set("data_validade", v)} ro={ro} />
        </Grid>
      </Secao>

      {/* Plano de Ação */}
      {!ro && (
        <Secao titulo="Plano de Ação">
          {!form.medidas.trim() ? (
            <p className="text-sm text-gray-400">
              Preencha as “Medidas corretivas e preventivas” para enviar ao Plano de Ação.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={enviarPlano.isPending || dirty}
                onClick={() => data && enviarPlano.mutate(data)}
                className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary/40 bg-white px-3 py-1.5 text-sm font-semibold text-verde-primary transition hover:bg-verde-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviarPlano.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
                Enviar medidas ao Plano de Ação
              </button>
              {dirty && <span className="text-xs text-amber-600">Salve antes de enviar.</span>}
              <span className="text-xs text-gray-400">Cria uma ação 5W2H em /acoes (refine por lá).</span>
            </div>
          )}
        </Secao>
      )}

      {/* Laudo */}
      <Secao titulo="Laudo (PDF)">
        {dirty ? (
          <p className="text-sm text-amber-600">Salve as alterações para gerar o laudo atualizado.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <BotaoGerarPdf
              label="Gerar laudo"
              apiPdfUrl={`/api/pdf/investigacao-acidente/${id}`}
              tabelaNome="investigacoes_acidente"
              docId={id}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-verde-accent"
            />
            <BotaoAssinarPdf
              apiPdfUrl={`/api/pdf/investigacao-acidente/${id}`}
              tabelaNome="investigacoes_acidente"
              docId={id}
              defaultSignatoryName={form.responsavel_tecnico || undefined}
            />
          </div>
        )}
      </Secao>
    </div>
  );
}

/* ── Componentes auxiliares ─────────────────────────────────────────────── */

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="reveal-up space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-verde-primary">{titulo}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Campo({
  label, value, onChange, type = "text", ro, className, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; ro?: boolean; className?: string; placeholder?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        disabled={ro}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50"
      />
    </div>
  );
}

function Area({
  label, value, onChange, ro, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void; ro?: boolean; rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <textarea
        disabled={ro}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50"
      />
    </div>
  );
}

function Sel({
  label, value, onChange, opcoes, ro,
}: {
  label: string; value: string; onChange: (v: string) => void; opcoes: [string, string][]; ro?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <select
        disabled={ro}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50"
      >
        {opcoes.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
