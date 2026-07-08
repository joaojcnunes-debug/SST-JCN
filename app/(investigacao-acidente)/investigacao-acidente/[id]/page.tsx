"use client";

import { EditorSkeleton } from "@/components/ui/PageSkeletons";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useInvestigacaoAcidente,
  useSalvarInvestigacao,
} from "@/lib/hooks/useInvestigacaoAcidente";
import PlanoAcaoTable from "@/components/investigacao-acidente/PlanoAcaoTable";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useCatalogoEmpresa } from "@/lib/hooks/useCatalogoEmpresa";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import MultiChipInput from "@/components/ui/MultiChipInput";
import BodyMap from "@/components/investigacao/BodyMap";
import FotoSlots, { uploadFotoSlots, type FotoSlot } from "@/components/ui/FotoSlots";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { ISHIKAWA_CATS } from "@/lib/investigacao/ishikawa";
import type {
  TestemunhaAcidente, PessoaEnvolvida, RelatoEnvolvido, OrganizacaoTrabalho, VinculoPessoa,
  MidiaArquivo, VideoLink, FatorAvaliacao, LaudoExterno, Consultor, Cronograma,
} from "@/lib/supabase/types";

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
  acidentado_cpf: string;
  acidentado_pis: string;
  acidentado_estado_civil: string;
  acidentado_nascimento: string;
  acidentado_escolaridade: string;
  acidentado_telefone: string;
  acidentado_endereco: string;
  acidentado_cbo: string;
  acidentado_tempo_funcao: string;
  acidentado_tempo_empresa: string;
  acidentado_jornada: string;
  acidentado_tempo_apos_inicio: string;
  qtd_acidentados: string;
  consequencias: string[];
  fatores_morbi: string[];
  pessoas_envolvidas: PessoaEnvolvida[];
  organizacao_trabalho: OrganizacaoTrabalho;
  atividade_momento: string;
  relatos_envolvidos: RelatoEnvolvido[];
  videos: VideoLink[];
  fatores_contribuintes: Record<string, FatorAvaliacao>;
  laudos_externos: LaudoExterno[];
  analise_equipe: string;
  consultores: Consultor[];
  analise_links: VideoLink[];
  medidas_adotadas: string;
  cronogramas: Cronograma[];
  responsavel_legal_nome: string;
  responsavel_legal_cargo: string;
  responsavel_legal_data: string;
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
  cinco_porques: { pergunta: string; resposta: string }[];
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
  acidentado_cpf: "", acidentado_pis: "", acidentado_estado_civil: "", acidentado_nascimento: "",
  acidentado_escolaridade: "", acidentado_telefone: "", acidentado_endereco: "", acidentado_cbo: "",
  acidentado_tempo_funcao: "", acidentado_tempo_empresa: "", acidentado_jornada: "", acidentado_tempo_apos_inicio: "",
  qtd_acidentados: "", consequencias: [], fatores_morbi: [],
  pessoas_envolvidas: [], organizacao_trabalho: {}, atividade_momento: "", relatos_envolvidos: [], videos: [],
  fatores_contribuintes: {},
  laudos_externos: [], analise_equipe: "", consultores: [], analise_links: [],
  medidas_adotadas: "", cronogramas: [],
  responsavel_legal_nome: "", responsavel_legal_cargo: "", responsavel_legal_data: "",
  tipo_acidente: "", houve_afastamento: false, dias_afastamento: "", gravidade: "",
  descricao: "", agente_causador: "", partes_corpo: [], natureza_lesao: "", cid: "",
  testemunhas: [], causas_imediatas: "", causas_basicas: "", cinco_porques: [],
  ishikawa: {}, medidas: "", conclusao: "", status: "RASCUNHO", data_validade: "",
};

const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável", "Outro"];
const ESCOLARIDADE = [
  "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo",
  "Superior incompleto", "Superior completo", "Pós-graduação",
];
const CONSEQUENCIAS = [
  "Óbito", "Amputação", "Esmagamento", "Perda de visão", "Perda permanente de função",
  "Fratura com cirurgia", "Queimadura >30% da superfície corporal", "Afastamento >30 dias",
];
const FATORES_MORBI = [
  "Agente químico", "Agente físico", "Agente biológico", "Queda", "Corrente elétrica",
  "Soterramento", "Impacto", "Colisão", "Transporte", "Incêndio", "Explosão", "Máquinas", "Outros",
];
const FATORES_CONTRIBUINTES: { key: string; label: string; hint?: string }[] = [
  { key: "metas", label: "Metas / premiação", hint: "Pressão por produtividade, metas, premiação" },
  { key: "layout", label: "Layout / arranjo físico do posto" },
  { key: "materiais", label: "Natureza dos materiais", hint: "Materiais perigosos, forma de manuseio" },
  { key: "instalacoes", label: "Uso das instalações / equipamentos" },
  { key: "eps", label: "Suficiência dos equipamentos de segurança (EPI/EPC)" },
  { key: "externas", label: "Condições externas", hint: "Clima, interferências, interrupções, flutuação de demanda, violência" },
  { key: "organizacao", label: "Organização do trabalho", hint: "Jornada, remuneração, relações humanas, supervisão" },
  { key: "manutencao", label: "Manutenção / limpeza / iluminação / piso" },
  { key: "agentes", label: "Agentes de risco conhecidos e não controlados" },
];
const LAUDO_TIPOS = [
  "LPAT / PRF", "Perícia (Polícia Científica)", "B.O. (Polícia Civil)",
  "Certidão (Corpo de Bombeiros)", "Outro",
];
const CRONOGRAMA_TIPOS = ["Manutenção", "Aquisições", "Treinamentos", "Procedimentos", "Outro"];
const CRONOGRAMA_STATUS = ["Pendente", "Em andamento", "Concluído"];

export default function EditorInvestigacaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useInvestigacaoAcidente(id);
  const salvar = useSalvarInvestigacao();
  const { data: catalogo } = useCatalogoEmpresa(data?.id_empresa);
  const canEdit = useCanEdit();
  const ro = !canEdit;

  const [form, setForm] = useState<FormState>(VAZIO);
  const [dirty, setDirty] = useState(false);
  // Mídia (FotoSlots) — estado de slots por grupo (Item 7).
  const [croquiSlots, setCroquiSlots] = useState<(FotoSlot | null)[]>([]);
  const [mapaSlots, setMapaSlots] = useState<(FotoSlot | null)[]>([]);
  const [fotoAntSlots, setFotoAntSlots] = useState<(FotoSlot | null)[]>([]);
  const [fotoMomSlots, setFotoMomSlots] = useState<(FotoSlot | null)[]>([]);
  const [fotoAtuSlots, setFotoAtuSlots] = useState<(FotoSlot | null)[]>([]);
  const [fotoPosSlots, setFotoPosSlots] = useState<(FotoSlot | null)[]>([]);
  const [salvando, setSalvando] = useState(false);

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
      acidentado_cpf: data.acidentado_cpf ?? "",
      acidentado_pis: data.acidentado_pis ?? "",
      acidentado_estado_civil: data.acidentado_estado_civil ?? "",
      acidentado_nascimento: data.acidentado_nascimento ?? "",
      acidentado_escolaridade: data.acidentado_escolaridade ?? "",
      acidentado_telefone: data.acidentado_telefone ?? "",
      acidentado_endereco: data.acidentado_endereco ?? "",
      acidentado_cbo: data.acidentado_cbo ?? "",
      acidentado_tempo_funcao: data.acidentado_tempo_funcao ?? "",
      acidentado_tempo_empresa: data.acidentado_tempo_empresa ?? "",
      acidentado_jornada: data.acidentado_jornada ?? "",
      acidentado_tempo_apos_inicio: data.acidentado_tempo_apos_inicio ?? "",
      qtd_acidentados: data.qtd_acidentados != null ? String(data.qtd_acidentados) : "",
      consequencias: data.consequencias ?? [],
      fatores_morbi: data.fatores_morbi ?? [],
      pessoas_envolvidas: data.pessoas_envolvidas ?? [],
      organizacao_trabalho: data.organizacao_trabalho ?? {},
      atividade_momento: data.atividade_momento ?? "",
      relatos_envolvidos: data.relatos_envolvidos ?? [],
      videos: data.videos ?? [],
      fatores_contribuintes: data.fatores_contribuintes ?? {},
      laudos_externos: data.laudos_externos ?? [],
      analise_equipe: data.analise_equipe ?? "",
      consultores: data.consultores ?? [],
      analise_links: data.analise_links ?? [],
      medidas_adotadas: data.medidas_adotadas ?? "",
      cronogramas: data.cronogramas ?? [],
      responsavel_legal_nome: data.responsavel_legal_nome ?? "",
      responsavel_legal_cargo: data.responsavel_legal_cargo ?? "",
      responsavel_legal_data: data.responsavel_legal_data ?? "",
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
      // aceita objeto {pergunta,resposta}, JSON-string (coerção do text[]) e string simples (legado)
      cinco_porques: ((data.cinco_porques ?? []) as unknown[]).map((p) => {
        if (typeof p === "string") {
          const s = p.trim();
          if (s.startsWith("{")) {
            try {
              const o = JSON.parse(s) as { pergunta?: unknown; resposta?: unknown };
              if (o && typeof o === "object") return { pergunta: String(o.pergunta ?? ""), resposta: String(o.resposta ?? "") };
            } catch { /* trata como resposta */ }
          }
          return { pergunta: "", resposta: p };
        }
        const o = (p ?? {}) as { pergunta?: string; resposta?: string };
        return { pergunta: o.pergunta ?? "", resposta: o.resposta ?? "" };
      }),
      ishikawa: data.ishikawa ?? {},
      medidas: data.medidas ?? "",
      conclusao: data.conclusao ?? "",
      status: data.status ?? "RASCUNHO",
      data_validade: data.data_validade ?? "",
    });
    const toSlots = (arr: MidiaArquivo[] | undefined): (FotoSlot | null)[] =>
      (arr ?? []).map((m) => ({ type: "existing" as const, url: m.url, path: m.path }));
    setCroquiSlots(toSlots(data.croqui));
    setMapaSlots(toSlots(data.mapa_riscos));
    setFotoAntSlots(toSlots(data.fotos_anteriores));
    setFotoMomSlots(toSlots(data.fotos_momento));
    setFotoAtuSlots(toSlots(data.fotos_atuais));
    setFotoPosSlots(toSlots(data.fotos_pos));
    setDirty(false);
  }, [data]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50";
  function updPessoa<K extends keyof PessoaEnvolvida>(i: number, k: K, v: PessoaEnvolvida[K]) {
    const arr = [...form.pessoas_envolvidas];
    arr[i] = { ...arr[i], [k]: v };
    set("pessoas_envolvidas", arr);
  }
  function updRelato<K extends keyof RelatoEnvolvido>(i: number, k: K, v: RelatoEnvolvido[K]) {
    const arr = [...form.relatos_envolvidos];
    arr[i] = { ...arr[i], [k]: v };
    set("relatos_envolvidos", arr);
  }
  function setOrg(k: keyof OrganizacaoTrabalho, v: string) {
    set("organizacao_trabalho", { ...form.organizacao_trabalho, [k]: v });
  }
  function updVideo<K extends keyof VideoLink>(i: number, k: K, v: VideoLink[K]) {
    const arr = [...form.videos];
    arr[i] = { ...arr[i], [k]: v };
    set("videos", arr);
  }
  const onSlots = (setter: (s: (FotoSlot | null)[]) => void) => (s: (FotoSlot | null)[]) => {
    setter(s);
    setDirty(true);
  };
  function getFator(key: string): FatorAvaliacao {
    return form.fatores_contribuintes[key] ?? { resposta: "", obs: "" };
  }
  function setFator(key: string, patch: Partial<FatorAvaliacao>) {
    set("fatores_contribuintes", { ...form.fatores_contribuintes, [key]: { ...getFator(key), ...patch } });
  }
  function updLaudo<K extends keyof LaudoExterno>(i: number, k: K, v: LaudoExterno[K]) {
    const arr = [...form.laudos_externos]; arr[i] = { ...arr[i], [k]: v }; set("laudos_externos", arr);
  }
  function updConsultor<K extends keyof Consultor>(i: number, k: K, v: Consultor[K]) {
    const arr = [...form.consultores]; arr[i] = { ...arr[i], [k]: v }; set("consultores", arr);
  }
  function updCronograma<K extends keyof Cronograma>(i: number, k: K, v: Cronograma[K]) {
    const arr = [...form.cronogramas]; arr[i] = { ...arr[i], [k]: v }; set("cronogramas", arr);
  }
  function updAnaliseLink<K extends keyof VideoLink>(i: number, k: K, v: VideoLink[K]) {
    const arr = [...form.analise_links]; arr[i] = { ...arr[i], [k]: v }; set("analise_links", arr);
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
    const supabase = createSupabaseBrowserClient();
    const base = `investigacao/${id}`;
    const oldPaths = (arr?: MidiaArquivo[]) => (arr ?? []).map((m) => m.path);
    const up = async (slots: (FotoSlot | null)[], old: string[], sub: string): Promise<MidiaArquivo[]> => {
      const { urls, paths } = await uploadFotoSlots(supabase, slots, old, "fotos", `${base}/${sub}`, gerarId);
      return urls.map((url, i) => ({ url, path: paths[i] }));
    };
    const croqui = await up(croquiSlots, oldPaths(data?.croqui), "croqui");
    const mapa_riscos = await up(mapaSlots, oldPaths(data?.mapa_riscos), "mapa");
    const fotos_anteriores = await up(fotoAntSlots, oldPaths(data?.fotos_anteriores), "fotos-ant");
    const fotos_momento = await up(fotoMomSlots, oldPaths(data?.fotos_momento), "fotos-mom");
    const fotos_atuais = await up(fotoAtuSlots, oldPaths(data?.fotos_atuais), "fotos-atu");
    const fotos_pos = await up(fotoPosSlots, oldPaths(data?.fotos_pos), "fotos-pos");
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
      acidentado_cpf: form.acidentado_cpf || null,
      acidentado_pis: form.acidentado_pis || null,
      acidentado_estado_civil: form.acidentado_estado_civil || null,
      acidentado_nascimento: form.acidentado_nascimento || null,
      acidentado_escolaridade: form.acidentado_escolaridade || null,
      acidentado_telefone: form.acidentado_telefone || null,
      acidentado_endereco: form.acidentado_endereco || null,
      acidentado_cbo: form.acidentado_cbo || null,
      acidentado_tempo_funcao: form.acidentado_tempo_funcao || null,
      acidentado_tempo_empresa: form.acidentado_tempo_empresa || null,
      acidentado_jornada: form.acidentado_jornada || null,
      acidentado_tempo_apos_inicio: form.acidentado_tempo_apos_inicio || null,
      qtd_acidentados: form.qtd_acidentados ? parseInt(form.qtd_acidentados, 10) : null,
      consequencias: form.consequencias,
      fatores_morbi: form.fatores_morbi,
      pessoas_envolvidas: form.pessoas_envolvidas.filter((p) => p.nome.trim() || p.cpf.trim() || p.funcao.trim()),
      organizacao_trabalho: form.organizacao_trabalho,
      atividade_momento: form.atividade_momento || null,
      relatos_envolvidos: form.relatos_envolvidos.filter((r) => r.pessoa.trim() || r.relato.trim()),
      fatores_contribuintes: form.fatores_contribuintes,
      laudos_externos: form.laudos_externos.filter((l) => l.tipo.trim() || l.numero.trim() || l.url.trim()),
      analise_equipe: form.analise_equipe || null,
      consultores: form.consultores.filter((c) => c.nome.trim()),
      analise_links: form.analise_links.filter((v) => v.url.trim()),
      medidas_adotadas: form.medidas_adotadas || null,
      cronogramas: form.cronogramas.filter((c) => c.descricao.trim() || c.tipo.trim()),
      fotos_pos,
      responsavel_legal_nome: form.responsavel_legal_nome || null,
      responsavel_legal_cargo: form.responsavel_legal_cargo || null,
      responsavel_legal_data: form.responsavel_legal_data || null,
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
      cinco_porques: form.cinco_porques.filter((p) => p.pergunta.trim() || p.resposta.trim()),
      ishikawa: form.ishikawa,
      medidas: form.medidas || null,
      conclusao: form.conclusao || null,
      status: form.status as never,
      data_validade: form.data_validade || null,
      videos: form.videos.filter((v) => v.url.trim()),
      croqui, mapa_riscos, fotos_anteriores, fotos_momento, fotos_atuais,
    });
    setDirty(false);
    toast.success("Investigação salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar (verifique a mídia / storage).");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <EditorSkeleton />;
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
            disabled={salvando || salvar.isPending || !dirty}
            className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando || salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {salvando ? "Enviando…" : dirty ? "Salvar" : "Salvo"}
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
          <Campo label="CPF" value={form.acidentado_cpf} onChange={(v) => set("acidentado_cpf", v)} ro={ro} />
          <Campo label="PIS" value={form.acidentado_pis} onChange={(v) => set("acidentado_pis", v)} ro={ro} />
          <Campo label="Data de nascimento" type="date" value={form.acidentado_nascimento} onChange={(v) => set("acidentado_nascimento", v)} ro={ro} />
          <Sel label="Estado civil" value={form.acidentado_estado_civil} onChange={(v) => set("acidentado_estado_civil", v)} ro={ro}
            opcoes={[["", "—"], ...ESTADO_CIVIL.map((x) => [x, x] as [string, string])]} />
          <Sel label="Escolaridade" value={form.acidentado_escolaridade} onChange={(v) => set("acidentado_escolaridade", v)} ro={ro}
            opcoes={[["", "—"], ...ESCOLARIDADE.map((x) => [x, x] as [string, string])]} />
          <Campo label="CBO" value={form.acidentado_cbo} onChange={(v) => set("acidentado_cbo", v)} ro={ro} placeholder="Código CBO" />
          <Campo label="Telefone" value={form.acidentado_telefone} onChange={(v) => set("acidentado_telefone", v)} ro={ro} />
          <Campo label="Endereço" value={form.acidentado_endereco} onChange={(v) => set("acidentado_endereco", v)} ro={ro} />
          <Campo label="Tempo na função" value={form.acidentado_tempo_funcao} onChange={(v) => set("acidentado_tempo_funcao", v)} ro={ro} placeholder="ex.: 2 anos" />
          <Campo label="Tempo na empresa" value={form.acidentado_tempo_empresa} onChange={(v) => set("acidentado_tempo_empresa", v)} ro={ro} placeholder="ex.: 5 anos" />
          <Campo label="Jornada de trabalho" value={form.acidentado_jornada} onChange={(v) => set("acidentado_jornada", v)} ro={ro} placeholder="ex.: 8h/dia · 44h/sem" />
          <Campo label="Tempo do acidente após início da jornada" value={form.acidentado_tempo_apos_inicio} onChange={(v) => set("acidentado_tempo_apos_inicio", v)} ro={ro} placeholder="ex.: 3h30" />
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

      {/* Dados do acidente (Bloco 1 / Item 5) */}
      <Secao titulo="Dados do acidente">
        <Grid>
          <Campo label="Quantidade de acidentados" type="number" value={form.qtd_acidentados} onChange={(v) => set("qtd_acidentados", v)} ro={ro} className="w-40" />
        </Grid>
        <Checklist label="Consequência(s) do acidente" opcoes={CONSEQUENCIAS} value={form.consequencias} onChange={(v) => set("consequencias", v)} ro={ro} />
        <Checklist label="Fator de morbi/mortalidade" opcoes={FATORES_MORBI} value={form.fatores_morbi} onChange={(v) => set("fatores_morbi", v)} ro={ro} />
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

      {/* Local — mídia (Bloco 2b / Item 7) */}
      <Secao titulo="Local — croqui, mapa de riscos e fotos">
        <MidiaGrupo label="Planta baixa / croqui do setor" slots={croquiSlots} onChange={onSlots(setCroquiSlots)} max={4} ro={ro} />
        <MidiaGrupo label="Mapa de riscos vigente à época" slots={mapaSlots} onChange={onSlots(setMapaSlots)} max={1} ro={ro} />
        <MidiaGrupo label="Fotos — anteriores ao acidente" slots={fotoAntSlots} onChange={onSlots(setFotoAntSlots)} max={6} ro={ro} />
        <MidiaGrupo label="Fotos — do momento do acidente" slots={fotoMomSlots} onChange={onSlots(setFotoMomSlots)} max={6} ro={ro} />
        <MidiaGrupo label="Fotos — atuais" slots={fotoAtuSlots} onChange={onSlots(setFotoAtuSlots)} max={6} ro={ro} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Vídeos (links)</label>
          <div className="space-y-2">
            {form.videos.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input disabled={ro} value={v.url} onChange={(e) => updVideo(i, "url", e.target.value)} placeholder="URL do vídeo (Drive, YouTube…)" className={inputCls} />
                <input disabled={ro} value={v.descricao ?? ""} onChange={(e) => updVideo(i, "descricao", e.target.value)} placeholder="Descrição (opcional)" className={inputCls} />
                {!ro && (
                  <button type="button" onClick={() => set("videos", form.videos.filter((_, j) => j !== i))} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {!ro && (
              <button type="button" onClick={() => set("videos", [...form.videos, { url: "", descricao: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Plus className="size-4" /> Adicionar vídeo
              </button>
            )}
          </div>
        </div>
      </Secao>

      {/* Pessoas envolvidas (Bloco 2 / Item 8) */}
      <Secao titulo="Pessoas envolvidas / organograma">
        <div className="space-y-3">
          {form.pessoas_envolvidas.map((p, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input disabled={ro} value={p.nome} onChange={(e) => updPessoa(i, "nome", e.target.value)} placeholder="Nome" className={inputCls} />
                <input disabled={ro} value={p.funcao} onChange={(e) => updPessoa(i, "funcao", e.target.value)} placeholder="Função" className={inputCls} />
                <input disabled={ro} value={p.cpf} onChange={(e) => updPessoa(i, "cpf", e.target.value)} placeholder="CPF" className={inputCls} />
                <input disabled={ro} value={p.telefone} onChange={(e) => updPessoa(i, "telefone", e.target.value)} placeholder="Telefone" className={inputCls} />
                <input disabled={ro} value={p.email} onChange={(e) => updPessoa(i, "email", e.target.value)} placeholder="E-mail" className={inputCls} />
                <select disabled={ro} value={p.vinculo} onChange={(e) => updPessoa(i, "vinculo", e.target.value as VinculoPessoa)} className={inputCls}>
                  <option value="equipe">Equipe</option>
                  <option value="chefia_direta">Chefia direta</option>
                  <option value="chefia_indireta">Chefia indireta</option>
                  <option value="comando">Comando / organograma</option>
                </select>
              </div>
              {!ro && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => set("pessoas_envolvidas", form.pessoas_envolvidas.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!ro && (
            <button type="button" onClick={() => set("pessoas_envolvidas", [...form.pessoas_envolvidas, { nome: "", cpf: "", funcao: "", telefone: "", email: "", vinculo: "equipe" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Plus className="size-4" /> Adicionar pessoa
            </button>
          )}
        </div>
      </Secao>

      {/* Organização do trabalho (Item 9) */}
      <Secao titulo="Organização do trabalho da tarefa">
        <Area label="Planejamento" value={form.organizacao_trabalho.planejamento ?? ""} onChange={(v) => setOrg("planejamento", v)} ro={ro} rows={2} />
        <Area label="Orientação de execução" value={form.organizacao_trabalho.orientacao ?? ""} onChange={(v) => setOrg("orientacao", v)} ro={ro} rows={2} />
        <Area label="Materiais, máquinas, ferramentas, EPI/EPC" value={form.organizacao_trabalho.recursos ?? ""} onChange={(v) => setOrg("recursos", v)} ro={ro} rows={2} />
        <Area label="Processos e controle de tempo" value={form.organizacao_trabalho.processos ?? ""} onChange={(v) => setOrg("processos", v)} ro={ro} rows={2} />
        <Area label="Sinalização" value={form.organizacao_trabalho.sinalizacao ?? ""} onChange={(v) => setOrg("sinalizacao", v)} ro={ro} rows={2} />
        <Area label="Hierarquia" value={form.organizacao_trabalho.hierarquia ?? ""} onChange={(v) => setOrg("hierarquia", v)} ro={ro} rows={2} />
      </Secao>

      {/* Atividade no momento (Item 10) */}
      <Secao titulo="Atividade executada no momento do acidente">
        <Area label="Descreva a atividade exata que estava sendo executada" value={form.atividade_momento} onChange={(v) => set("atividade_momento", v)} ro={ro} rows={3} />
      </Secao>

      {/* Relatos dos envolvidos (Item 11) */}
      <Secao titulo="Descrição sob o ponto de vista dos envolvidos">
        <div className="space-y-3">
          {form.relatos_envolvidos.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <input disabled={ro} value={r.pessoa} onChange={(e) => updRelato(i, "pessoa", e.target.value)} placeholder="Pessoa" className={inputCls} />
                {!ro && (
                  <button type="button" onClick={() => set("relatos_envolvidos", form.relatos_envolvidos.filter((_, j) => j !== i))} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <textarea disabled={ro} value={r.relato} onChange={(e) => updRelato(i, "relato", e.target.value)} placeholder="Relato sob o ponto de vista desta pessoa" rows={2} className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50" />
            </div>
          ))}
          {!ro && (
            <button type="button" onClick={() => set("relatos_envolvidos", [...form.relatos_envolvidos, { pessoa: "", relato: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Plus className="size-4" /> Adicionar relato
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
              <div key={i} className="rounded-lg border border-gray-200 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">{i + 1}º Por quê?</span>
                  {!ro && (
                    <button type="button" onClick={() => set("cinco_porques", form.cinco_porques.filter((_, j) => j !== i))} className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <input
                  disabled={ro}
                  value={p.pergunta}
                  placeholder="Pergunta — por que isso aconteceu?"
                  onChange={(e) => {
                    const arr = [...form.cinco_porques];
                    arr[i] = { ...arr[i], pergunta: e.target.value };
                    set("cinco_porques", arr);
                  }}
                  className="mb-1.5 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                />
                <input
                  disabled={ro}
                  value={p.resposta}
                  placeholder="Resposta"
                  onChange={(e) => {
                    const arr = [...form.cinco_porques];
                    arr[i] = { ...arr[i], resposta: e.target.value };
                    set("cinco_porques", arr);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                />
              </div>
            ))}
            {!ro && form.cinco_porques.length < 5 && (
              <button type="button" onClick={() => set("cinco_porques", [...form.cinco_porques, { pergunta: "", resposta: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
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

      {/* Fatores contribuintes (Bloco 3 / Item 12) */}
      <Secao titulo="Fatores contribuintes (questionário causal)">
        <p className="-mt-1 mb-1 text-xs text-gray-500">Avalie se cada fator contribuiu para o acidente.</p>
        <div className="divide-y divide-gray-100">
          {FATORES_CONTRIBUINTES.map((f) => {
            const fa = getFator(f.key);
            return (
              <div key={f.key} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{f.label}</p>
                    {f.hint && <p className="text-[11px] text-gray-400">{f.hint}</p>}
                  </div>
                  <select disabled={ro} value={fa.resposta} onChange={(e) => setFator(f.key, { resposta: e.target.value as FatorAvaliacao["resposta"] })} className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50">
                    <option value="">—</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                    <option value="parcial">Parcial</option>
                    <option value="na">N/A</option>
                  </select>
                </div>
                {(fa.resposta === "sim" || fa.resposta === "parcial" || fa.obs) && (
                  <input disabled={ro} value={fa.obs} onChange={(e) => setFator(f.key, { obs: e.target.value })} placeholder="Observação" className={`${inputCls} mt-1.5`} />
                )}
              </div>
            );
          })}
        </div>
      </Secao>

      {/* 6. Medidas + 7. Conclusão */}
      <Secao titulo="Medidas e conclusão">
        <Area label="Medidas recomendadas (corretivas e preventivas)" value={form.medidas} onChange={(v) => set("medidas", v)} ro={ro} rows={3} />
        <Area label="Conclusão / parecer técnico" value={form.conclusao} onChange={(v) => set("conclusao", v)} ro={ro} rows={3} />
      </Secao>

      {/* Laudos externos (Bloco 4 / Item 13) */}
      <Secao titulo="Laudos externos">
        <div className="space-y-3">
          {form.laudos_externos.map((l, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select disabled={ro} value={l.tipo} onChange={(e) => updLaudo(i, "tipo", e.target.value)} className={inputCls}>
                  <option value="">— tipo —</option>
                  {LAUDO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input disabled={ro} value={l.numero} onChange={(e) => updLaudo(i, "numero", e.target.value)} placeholder="Número / protocolo" className={inputCls} />
                <input disabled={ro} type="date" value={l.data} onChange={(e) => updLaudo(i, "data", e.target.value)} className={inputCls} />
                <input disabled={ro} value={l.url} onChange={(e) => updLaudo(i, "url", e.target.value)} placeholder="Link do documento (opcional)" className={inputCls} />
              </div>
              <input disabled={ro} value={l.obs} onChange={(e) => updLaudo(i, "obs", e.target.value)} placeholder="Observação" className={inputCls} />
              {!ro && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => set("laudos_externos", form.laudos_externos.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          ))}
          {!ro && (
            <button type="button" onClick={() => set("laudos_externos", [...form.laudos_externos, { tipo: "", numero: "", data: "", url: "", obs: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Plus className="size-4" /> Adicionar laudo externo
            </button>
          )}
        </div>
      </Secao>

      {/* Análise da equipe técnica (Item 14) */}
      <Secao titulo="Análise da equipe técnica / consultores">
        <Area label="Análise técnica do acidente" value={form.analise_equipe} onChange={(v) => set("analise_equipe", v)} ro={ro} rows={4} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Consultores / equipe</label>
          <div className="space-y-2">
            {form.consultores.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input disabled={ro} value={c.nome} onChange={(e) => updConsultor(i, "nome", e.target.value)} placeholder="Nome" className={inputCls} />
                <input disabled={ro} value={c.registro} onChange={(e) => updConsultor(i, "registro", e.target.value)} placeholder="Registro (CREA/MTE…)" className={inputCls} />
                {!ro && <button type="button" onClick={() => set("consultores", form.consultores.filter((_, j) => j !== i))} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>}
              </div>
            ))}
            {!ro && <button type="button" onClick={() => set("consultores", [...form.consultores, { nome: "", registro: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"><Plus className="size-4" /> Adicionar consultor</button>}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Filmes / esquemas do dia (links)</label>
          <div className="space-y-2">
            {form.analise_links.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input disabled={ro} value={v.url} onChange={(e) => updAnaliseLink(i, "url", e.target.value)} placeholder="URL" className={inputCls} />
                <input disabled={ro} value={v.descricao ?? ""} onChange={(e) => updAnaliseLink(i, "descricao", e.target.value)} placeholder="Descrição" className={inputCls} />
                {!ro && <button type="button" onClick={() => set("analise_links", form.analise_links.filter((_, j) => j !== i))} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>}
              </div>
            ))}
            {!ro && <button type="button" onClick={() => set("analise_links", [...form.analise_links, { url: "", descricao: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"><Plus className="size-4" /> Adicionar link</button>}
          </div>
        </div>
      </Secao>

      {/* Medidas adotadas, cronogramas, relatório fotográfico e responsável legal (Item 17) */}
      <Secao titulo="Medidas adotadas após o acidente">
        <Area label="Medidas adotadas" value={form.medidas_adotadas} onChange={(v) => set("medidas_adotadas", v)} ro={ro} rows={3} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Cronogramas</label>
          <div className="space-y-2">
            {form.cronogramas.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-2">
                <select disabled={ro} value={c.tipo} onChange={(e) => updCronograma(i, "tipo", e.target.value)} className={inputCls}>
                  <option value="">— tipo —</option>
                  {CRONOGRAMA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input disabled={ro} value={c.descricao} onChange={(e) => updCronograma(i, "descricao", e.target.value)} placeholder="Descrição" className={inputCls} />
                <input disabled={ro} value={c.prazo} onChange={(e) => updCronograma(i, "prazo", e.target.value)} placeholder="Prazo" className={inputCls} />
                <input disabled={ro} value={c.responsavel} onChange={(e) => updCronograma(i, "responsavel", e.target.value)} placeholder="Responsável" className={inputCls} />
                <select disabled={ro} value={c.status} onChange={(e) => updCronograma(i, "status", e.target.value)} className={inputCls}>
                  <option value="">— status —</option>
                  {CRONOGRAMA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {!ro && <div className="flex items-center sm:col-span-2 sm:justify-end"><button type="button" onClick={() => set("cronogramas", form.cronogramas.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button></div>}
              </div>
            ))}
            {!ro && <button type="button" onClick={() => set("cronogramas", [...form.cronogramas, { tipo: "", descricao: "", prazo: "", responsavel: "", status: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"><Plus className="size-4" /> Adicionar cronograma</button>}
          </div>
        </div>
        <MidiaGrupo label="Relatório fotográfico (pós-acidente)" slots={fotoPosSlots} onChange={onSlots(setFotoPosSlots)} max={6} ro={ro} />
        <Grid>
          <Campo label="Responsável legal — nome" value={form.responsavel_legal_nome} onChange={(v) => set("responsavel_legal_nome", v)} ro={ro} />
          <Campo label="Responsável legal — cargo" value={form.responsavel_legal_cargo} onChange={(v) => set("responsavel_legal_cargo", v)} ro={ro} />
          <Campo label="Data" type="date" value={form.responsavel_legal_data} onChange={(v) => set("responsavel_legal_data", v)} ro={ro} />
        </Grid>
      </Secao>

      {/* Controle */}
      <Secao titulo="Controle do documento">
        <Grid>
          <Sel label="Situação" value={form.status} onChange={(v) => set("status", v)} ro={ro}
            opcoes={[["RASCUNHO", "Rascunho"], ["CONCLUIDA", "Concluída"]]} />
          <Campo label="Validade do documento" type="date" value={form.data_validade} onChange={(v) => set("data_validade", v)} ro={ro} />
        </Grid>
      </Secao>

      {/* Plano de Ação 5W2H (Fase A) — múltiplas ações vivem com a investigação/laudo */}
      <Secao titulo="Plano de Ação (5W2H)">
        <PlanoAcaoTable idInvestigacao={id} readOnly={ro} />
      </Secao>

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

function MidiaGrupo({
  label, slots, onChange, max, ro,
}: {
  label: string; slots: (FotoSlot | null)[]; onChange: (s: (FotoSlot | null)[]) => void; max: number; ro?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      <FotoSlots slots={slots} onChange={onChange} max={max} disabled={ro} />
    </div>
  );
}

function Checklist({
  label, opcoes, value, onChange, ro,
}: {
  label: string; opcoes: string[]; value: string[]; onChange: (v: string[]) => void; ro?: boolean;
}) {
  function toggle(op: string) {
    if (ro) return;
    onChange(value.includes(op) ? value.filter((x) => x !== op) : [...value, op]);
  }
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((op) => {
          const on = value.includes(op);
          return (
            <button
              key={op}
              type="button"
              disabled={ro}
              onClick={() => toggle(op)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                on
                  ? "border-verde-primary bg-verde-primary/10 text-verde-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {op}
            </button>
          );
        })}
      </div>
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
