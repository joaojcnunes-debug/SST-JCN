"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Bot,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  Wrench,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Camera,
  FileText,
  Send,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravar } from "@/lib/offline/gravar";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import { useImportarMaquinasInspecao } from "@/lib/hooks/useInventarioMaquinas";
import RevisaoIAModal, { type CampoRevisaoIA } from "@/components/ui/RevisaoIAModal";
import StorageImg from "@/components/ui/StorageImg";
import { abrirMidiaAssinada } from "@/lib/storage/abrir-midia-assinada";
import { extrairPathStorage } from "@/lib/storage/signed-url";
import { redimensionarParaBase64 } from "@/lib/imagem/redimensionar";
import { cn } from "@/lib/utils";
import SetorMultiSelect from "../SetorMultiSelect";
import type { InspecaoMaquina, Setor } from "@/lib/supabase/types";

// ─── helpers ────────────────────────────────────────────────────────────────

type GrauRisco = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

const GRAU_LABELS: Record<GrauRisco, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};
const GRAU_COLORS: Record<GrauRisco, string> = {
  BAIXO: "bg-green-100 text-green-800 border-green-200",
  MEDIO: "bg-amber-100 text-amber-800 border-amber-200",
  ALTO: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICO: "bg-red-100 text-red-800 border-red-200",
};

// Fotos por chamada da IA de visao: a rota corta em 3 (teto de tokens do Groq,
// ver app/api/maquina/analisar-foto). Cortar aqui tambem evita mandar a 4a
// foto para ser descartada em silencio.
const MAX_FOTOS_IA = 3;

const BOOL_OPTS = [
  { label: "—", value: null },
  { label: "Sim", value: true },
  { label: "Não", value: false },
] as const;

const SAFETY_FIELDS: { key: keyof InspecaoMaquina; label: string }[] = [
  { key: "protecao_fixa", label: "Proteção fixa" },
  { key: "protecao_movel", label: "Proteção móvel" },
  { key: "intertravamento", label: "Intertravamento" },
  { key: "botao_emergencia", label: "Botão emergência" },
  { key: "sistema_bloqueio", label: "Sistema de bloqueio/LOTO" },
  { key: "possui_manual", label: "Manual do fabricante" },
  { key: "aterramento", label: "Aterramento elétrico" },
  { key: "sinalizacao", label: "Sinalização de segurança" },
];

// ─── types ───────────────────────────────────────────────────────────────────

interface FormState {
  nome: string;
  tipo: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  tag: string;
  ano_fabricacao: string;
  potencia: string;
  tensao: string;
  ids_setores: string[];
  protecao_fixa: boolean | null;
  protecao_movel: boolean | null;
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  possui_manual: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: string;
  observacoes: string;
}

const EMPTY: FormState = {
  nome: "",
  tipo: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  tag: "",
  ano_fabricacao: "",
  potencia: "",
  tensao: "",
  ids_setores: [],
  protecao_fixa: null,
  protecao_movel: null,
  intertravamento: null,
  botao_emergencia: null,
  sistema_bloqueio: null,
  possui_manual: null,
  aterramento: null,
  sinalizacao: null,
  necessita_adequacao_nr12: null,
  grau_risco: "",
  observacoes: "",
};

interface Props {
  idInspecao: string;
  idEmpresa: string | null;
  setores: Setor[];
  maquinas: InspecaoMaquina[];
  readOnly?: boolean;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function MaquinasTab({
  idInspecao,
  idEmpresa,
  setores,
  maquinas,
  readOnly,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();

  const [view, setView] = useState<"lista" | "por-setor">("lista");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<InspecaoMaquina | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [analisandoId, setAnalisandoId] = useState<string | null>(null);
  const [expandedParecer, setExpandedParecer] = useState<string | null>(null);
  const importarApreciacao = useImportarMaquinasInspecao();
  // Sugestões da IA aguardando revisão (modal aceitar/editar/rejeitar)
  const [revisaoIA, setRevisaoIA] = useState<{
    maquina: InspecaoMaquina;
    campos: CampoRevisaoIA[];
  } | null>(null);
  const [aplicandoIA, setAplicandoIA] = useState(false);
  // IA dentro do form: lê as fotos e sugere os campos (revisão antes de aplicar)
  const [analisandoForm, setAnalisandoForm] = useState(false);
  const [revisaoForm, setRevisaoForm] = useState<CampoRevisaoIA[] | null>(null);

  // foto upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [fotosUpload, setFotosUpload] = useState<File[]>([]);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);

  const setoresMap = useMemo(
    () => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])),
    [setores]
  );

  // v160: a máquina pode estar em vários setores, então aparece sob CADA um
  // deles. Sem setor nenhum, cai no grupo null ("sem setor").
  const maquinasPorSetor = useMemo(() => {
    const map = new Map<string | null, InspecaoMaquina[]>();
    for (const m of maquinas) {
      const chaves: (string | null)[] =
        m.ids_setores && m.ids_setores.length > 0 ? m.ids_setores : [null];
      for (const k of chaves) {
        const arr = map.get(k) ?? [];
        arr.push(m);
        map.set(k, arr);
      }
    }
    return map;
  }, [maquinas]);

  /**
   * Reescreve os vínculos de setor da máquina (v160).
   *
   * Apaga e reinsere em vez de calcular o diff: são poucas linhas por máquina e
   * a PK composta faria um insert repetido falhar. Se o delete passar e o
   * insert falhar, a máquina fica sem setor — por isso o erro é propagado, para
   * o usuário ver e refazer, em vez de sumir em silêncio.
   */
  async function gravarSetores(idMaquina: string, dependeDe: string[]) {
    const encadeado = [...dependeDe];

    const limpeza = await gravar({
      tabela: "inspecao_maquinas_setores",
      tipo: "delete",
      linhas: null,
      filtro: { id_maquina_inspecao: idMaquina },
      modulo: "inspecoes",
      id_documento: idInspecao,
      depende_de: encadeado.length > 0 ? encadeado : undefined,
    });
    if (limpeza.destino === "APARELHO") encadeado.push(limpeza.idOperacao);

    if (form.ids_setores.length === 0) return;

    await gravar({
      tabela: "inspecao_maquinas_setores",
      tipo: "insert",
      linhas: form.ids_setores.map((idSetor) => ({
        id_maquina_inspecao: idMaquina,
        id_setor: idSetor,
      })),
      filtro: null,
      modulo: "inspecoes",
      id_documento: idInspecao,
      depende_de: encadeado.length > 0 ? encadeado : undefined,
    });
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
    // máquinas salvas/deletadas aqui alimentam o banner/modal de importação
    qc.invalidateQueries({ queryKey: ["inspecao-maquinas-pendentes"] });
  }

  function f<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function openNew() {
    setEditando(null);
    setForm(EMPTY);
    setFotosUpload([]);
    setFotosPreview([]);
    setFormOpen(true);
  }

  function openEdit(m: InspecaoMaquina) {
    setEditando(m);
    setForm({
      nome: m.nome,
      tipo: m.tipo ?? "",
      marca: m.marca ?? "",
      modelo: m.modelo ?? "",
      numero_serie: m.numero_serie ?? "",
      tag: m.tag ?? "",
      ano_fabricacao: m.ano_fabricacao?.toString() ?? "",
      potencia: m.potencia ?? "",
      tensao: m.tensao ?? "",
      ids_setores: m.ids_setores ?? [],
      protecao_fixa: m.protecao_fixa,
      protecao_movel: m.protecao_movel,
      intertravamento: m.intertravamento,
      botao_emergencia: m.botao_emergencia,
      sistema_bloqueio: m.sistema_bloqueio,
      possui_manual: m.possui_manual,
      aterramento: m.aterramento,
      sinalizacao: m.sinalizacao,
      necessita_adequacao_nr12: m.necessita_adequacao_nr12,
      grau_risco: m.grau_risco ?? "",
      observacoes: m.observacoes ?? "",
    });
    setFotosUpload([]);
    setFotosPreview(m.foto_urls ?? []);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditando(null);
    setForm(EMPTY);
    setFotosUpload([]);
    setFotosPreview([]);
  }

  function handleFotoSelect(files: FileList | null) {
    if (!files) return;
    const allowed = Array.from(files).slice(0, Math.max(0, 4 - fotosPreview.length));
    setFotosUpload((p) => [...p, ...allowed]);
    setFotosPreview((p) => [...p, ...allowed.map((f) => URL.createObjectURL(f))]);
  }

  function removeFoto(idx: number) {
    // split: existingFotos = previews com URLs https://... ; novos = blob://...
    const isExisting = fotosPreview[idx].startsWith("http");
    if (isExisting) {
      setFotosPreview((p) => p.filter((_, i) => i !== idx));
    } else {
      const uploadIdx = fotosPreview.slice(0, idx).filter((u) => !u.startsWith("http")).length;
      setFotosUpload((p) => p.filter((_, i) => i !== uploadIdx));
      setFotosPreview((p) => p.filter((_, i) => i !== idx));
    }
  }

  /**
   * Decide caminho e URL de cada foto nova, SEM subir nada.
   *
   * Quem sobe é o `gravar()`, junto da linha e na ordem certa. Assim a máquina
   * pode ser cadastrada em campo, com foto, e o arquivo chega ao MinIO quando a
   * fila subir — no mesmo caminho que a linha já está apontando.
   *
   * Antes o erro de upload virava um `toast` e a foto era simplesmente pulada;
   * agora uma falha de rede leva o conjunto inteiro para a fila, o que é a
   * resposta certa: a foto não se perde por causa do sinal.
   */
  function prepararFotos(): {
    urls: string[];
    paths: string[];
    imagens: { blob: Blob; caminho: string }[];
  } {
    const urls: string[] = [];
    const paths: string[] = [];
    const imagens: { blob: Blob; caminho: string }[] = [];
    for (const file of fotosUpload) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const caminho = `inspecao-maquinas/${idInspecao}/${gerarId("IMG")}.${ext}`;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(caminho);
      urls.push(pub.publicUrl);
      paths.push(caminho);
      imagens.push({ blob: file, caminho });
    }
    return { urls, paths, imagens };
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome da máquina é obrigatório"); return; }
    if (form.ids_setores.length === 0) { toast.error("Escolha ao menos um setor — toda máquina pertence a algum setor"); return; }
    setSaving(true);
    try {
      // monta lista de fotos existentes (as que ficaram no preview com URL https)
      const existingUrls = fotosPreview.filter((u) => u.startsWith("http"));
      const existingPaths = editando
        ? (editando.foto_storage_paths ?? []).filter((_, i) =>
            (editando.foto_urls ?? []).some((u) => existingUrls.includes(u))
          )
        : [];

      const { urls: newUrls, paths: newPaths, imagens } = prepararFotos();

      const payload = {
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        // v160: `id_setor` nao entra no payload — congelado como legado. Os
        // setores vao para inspecao_maquinas_setores, depois do upsert.
        nome: form.nome.trim(),
        tipo: form.tipo || null,
        marca: form.marca || null,
        modelo: form.modelo || null,
        numero_serie: form.numero_serie || null,
        tag: form.tag || null,
        ano_fabricacao: form.ano_fabricacao ? parseInt(form.ano_fabricacao) : null,
        potencia: form.potencia || null,
        tensao: form.tensao || null,
        protecao_fixa: form.protecao_fixa,
        protecao_movel: form.protecao_movel,
        intertravamento: form.intertravamento,
        botao_emergencia: form.botao_emergencia,
        sistema_bloqueio: form.sistema_bloqueio,
        possui_manual: form.possui_manual,
        aterramento: form.aterramento,
        sinalizacao: form.sinalizacao,
        necessita_adequacao_nr12: form.necessita_adequacao_nr12,
        grau_risco: form.grau_risco || null,
        observacoes: form.observacoes || null,
        foto_urls: [...existingUrls, ...newUrls],
        foto_storage_paths: [...existingPaths, ...newPaths],
        updated_at: new Date().toISOString(),
      };

      /**
       * O id da máquina passa a nascer no NAVEGADOR.
       *
       * Antes vinha do banco, por `insert().select().single()` — e era isso que
       * impedia o cadastro offline: sem o id, a ligação com os setores não tinha
       * para onde apontar.
       *
       * A coluna é `uuid` (ver `v160_inspecao_maquinas_setores.sql`), e
       * `crypto.randomUUID()` gera um uuid v4 válido. Informar o id no insert só
       * sobrepõe o default do banco — nenhuma migração é necessária. É o mesmo
       * princípio que o resto do painel já usa com `gerarId`, e o que torna o
       * reenvio idempotente.
       */
      const idMaquina = editando?.id_maquina_inspecao ?? crypto.randomUUID();
      const dependeDe: string[] = [];

      const principal = await gravar({
        tabela: "inspecao_maquinas",
        tipo: editando ? "update" : "insert",
        linhas: editando ? payload : [{ id_maquina_inspecao: idMaquina, ...payload }],
        filtro: editando ? { id_maquina_inspecao: idMaquina } : null,
        modulo: "inspecoes",
        id_documento: idInspecao,
        imagens,
      });
      if (principal.destino === "APARELHO") dependeDe.push(principal.idOperacao);

      await gravarSetores(idMaquina, dependeDe);

      if (principal.destino === "SERVIDOR") {
        toast.success(editando ? "Máquina atualizada" : "Máquina adicionada");
        refresh();
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        // `ids_setores` é achatado pelo `useInspecao` a partir da tabela de
        // ligação — offline, quem monta é aqui.
        const linha = {
          ...payload,
          id_maquina_inspecao: idMaquina,
          ids_setores: [...form.ids_setores],
        } as unknown as InspecaoMaquina;
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            maquinas: editando
              ? antigo.maquinas.map((m) =>
                  m.id_maquina_inspecao === idMaquina ? linha : m,
                )
              : [...antigo.maquinas, linha],
          };
        });
        toast.success("Máquina guardada no aparelho", { icon: "📵" });
      }
      closeForm();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: InspecaoMaquina) {
    if (!confirm(`Remover "${m.nome}"?`)) return;
    setDeletingId(m.id_maquina_inspecao);
    try {
      const resultado = await gravar({
        tabela: "inspecao_maquinas",
        tipo: "delete",
        linhas: null,
        filtro: { id_maquina_inspecao: m.id_maquina_inspecao },
        modulo: "inspecoes",
        id_documento: idInspecao,
      });

      if (resultado.destino === "SERVIDOR") {
        toast.success("Máquina removida");
        refresh();
      } else {
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) =>
          antigo
            ? {
                ...antigo,
                maquinas: antigo.maquinas.filter(
                  (x) => x.id_maquina_inspecao !== m.id_maquina_inspecao,
                ),
              }
            : antigo,
        );
        toast.success("Remoção guardada no aparelho", { icon: "📵" });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function analisarComIA(m: InspecaoMaquina) {
    if (m.foto_urls.length === 0 && !m.tipo && !m.observacoes) {
      toast("Adicione fotos ou descrição da máquina antes de analisar com IA", { icon: "ℹ️" });
      return;
    }
    setAnalisandoId(m.id_maquina_inspecao);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-maquina-ia", {
        body: {
          maquina: {
            nome: m.nome,
            tipo: m.tipo,
            marca: m.marca,
            modelo: m.modelo,
            potencia: m.potencia,
            tensao: m.tensao,
            observacoes: m.observacoes,
          },
          foto_urls: m.foto_urls ?? [],
        },
      });
      if (error) throw error;
      const result = data?.data;
      if (!result) throw new Error("Resposta inválida da IA");

      // Monta a revisão — nada é persistido sem o usuário confirmar no modal
      const boolParaTexto = (v: boolean | null | undefined) =>
        v === true ? "Sim" : v === false ? "Não" : "";
      const SIM_NAO = [
        { value: "Sim", label: "Sim" },
        { value: "Não", label: "Não" },
      ];
      const campos: CampoRevisaoIA[] = [];
      if (result.parecer) {
        campos.push({
          key: "parecer_ia",
          label: "Parecer técnico (IA)",
          valorSugerido: String(result.parecer),
          valorAtual: m.parecer_ia,
          multiline: true,
        });
      }
      // Grau de risco e os 7 booleanos de dispositivo de seguranca saíram da
      // sugestao da IA em 2026-08-11 -- ver o comentario em
      // app/api/fn/analisar-maquina-ia/route.ts. O que a IA observar sobre
      // protecoes chega como texto no parecer, onde da pra ler a incerteza.
      const BOOLS: { key: keyof InspecaoMaquina & string; label: string }[] = [
        { key: "necessita_adequacao_nr12", label: "Necessita adequação NR-12" },
      ];
      for (const b of BOOLS) {
        const v = result[b.key];
        if (v === undefined || v === null) continue;
        campos.push({
          key: b.key,
          label: b.label,
          valorSugerido: boolParaTexto(v as boolean),
          valorAtual: boolParaTexto(m[b.key] as boolean | null) || null,
          options: SIM_NAO,
        });
      }
      if (campos.length === 0) {
        toast("A IA não retornou sugestões pra esta máquina.", { icon: "ℹ️" });
        return;
      }
      setRevisaoIA({ maquina: m, campos });
    } catch (e) {
      toast.error(`Erro na análise IA: ${(e as Error).message}`);
    } finally {
      setAnalisandoId(null);
    }
  }

  /** Persiste os campos aceitos na revisão da análise de IA. */
  async function aplicarRevisaoIA(valores: Record<string, string>) {
    if (!revisaoIA) return;
    setAplicandoIA(true);
    try {
      const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [key, valor] of Object.entries(valores)) {
        if (key === "parecer_ia") upd.parecer_ia = valor || null;
        else if (key === "grau_risco") upd.grau_risco = valor || null;
        else upd[key] = valor === "Sim" ? true : valor === "Não" ? false : null;
      }
      const { error } = await supabase
        .from("inspecao_maquinas")
        .update(upd as never)
        .eq("id_maquina_inspecao", revisaoIA.maquina.id_maquina_inspecao);
      if (error) throw error;
      toast.success("Análise IA aplicada");
      setRevisaoIA(null);
      refresh();
    } catch (e) {
      toast.error(`Erro ao aplicar: ${(e as Error).message}`);
    } finally {
      setAplicandoIA(false);
    }
  }

  /**
   * IA dentro do form: lê TODAS as fotos anexadas (novas e já salvas) e
   * sugere identificação + campos NR-12 visíveis. O que a IA não conseguir
   * identificar fica de fora (preenchimento manual). Nada é aplicado sem
   * confirmação no modal de revisão.
   */
  async function handleAnalisarFotosForm() {
    if (fotosPreview.length === 0) {
      toast("Adicione ao menos uma foto da máquina (de preferência da plaqueta)", { icon: "ℹ️" });
      return;
    }
    setAnalisandoForm(true);
    try {
      const images: { b64: string; mime: string }[] = [];
      for (const file of fotosUpload.slice(0, MAX_FOTOS_IA)) {
        images.push({ b64: await redimensionarParaBase64(file), mime: "image/jpeg" });
      }
      // fotos já salvas (edição): baixa do storage com a credencial do painel e
      // redimensiona. Era `fetch(url)` na URL pública -- desde que o bucket ficou
      // privado (10/09) isso devolve 403 e o XML do erro ia como "foto".
      for (const url of fotosPreview.filter((u) => u.startsWith("http"))) {
        if (images.length >= MAX_FOTOS_IA) break;
        const path = extrairPathStorage(url, "fotos");
        if (!path) continue;
        const { data: blob } = await supabase.storage.from("fotos").download(path);
        if (!blob) continue;
        const file = new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
        images.push({ b64: await redimensionarParaBase64(file), mime: "image/jpeg" });
      }

      const res = await fetch("/api/maquina/analisar-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { data } = (await res.json()) as { data: Record<string, unknown> };

      const boolParaTexto = (v: unknown) =>
        v === true ? "Sim" : v === false ? "Não" : "";
      const SIM_NAO = [
        { value: "Sim", label: "Sim" },
        { value: "Não", label: "Não" },
      ];
      const TEXTOS: { key: keyof FormState & string; label: string; ia?: string; multiline?: boolean }[] = [
        { key: "nome", label: "Nome / Descrição" },
        { key: "tipo", label: "Tipo" },
        { key: "marca", label: "Fabricante / Marca" },
        { key: "modelo", label: "Modelo" },
        { key: "numero_serie", label: "Nº de Série" },
        { key: "tag", label: "TAG / Patrimônio" },
        { key: "ano_fabricacao", label: "Ano de Fabricação" },
        { key: "potencia", label: "Potência" },
        { key: "tensao", label: "Tensão" },
        { key: "observacoes", label: "Observações técnicas", ia: "descricao_tecnica", multiline: true },
      ];
      // Mesma remocao do outro caminho: dispositivo de seguranca e grau de risco
      // nao vem mais da foto. Medido em 9 fotos reais -- os dois provedores
      // afirmam LOTO e aterramento que a imagem nao mostra.
      const BOOLS: { key: keyof FormState & string; label: string }[] = [
        { key: "necessita_adequacao_nr12", label: "Necessita adequação NR-12?" },
      ];

      const campos: CampoRevisaoIA[] = [];
      for (const t of TEXTOS) {
        const val = data[t.ia ?? t.key];
        if (val === null || val === undefined || val === "") continue;
        campos.push({
          key: t.key,
          label: t.label,
          valorSugerido: String(val),
          valorAtual: (form[t.key] as string) || null,
          multiline: t.multiline,
        });
      }
      for (const b of BOOLS) {
        const v = data[b.key];
        if (v !== true && v !== false) continue;
        campos.push({
          key: b.key,
          label: b.label,
          valorSugerido: boolParaTexto(v),
          valorAtual: boolParaTexto(form[b.key]) || null,
          options: SIM_NAO,
        });
      }
      if (campos.length === 0) {
        toast("A IA não identificou dados nas fotos. Preencha manualmente.", { icon: "ℹ️" });
        return;
      }
      setRevisaoForm(campos);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha na análise IA");
    } finally {
      setAnalisandoForm(false);
    }
  }

  /** Aplica no form os campos aceitos na revisão (nada vai pro banco aqui). */
  function aplicarRevisaoForm(valores: Record<string, string>) {
    setForm((p) => {
      const next = { ...p };
      for (const [key, valor] of Object.entries(valores)) {
        const k = key as keyof FormState;
        if (typeof p[k] === "boolean" || p[k] === null) {
          (next as Record<string, unknown>)[key] =
            valor === "Sim" ? true : valor === "Não" ? false : null;
        } else {
          (next as Record<string, unknown>)[key] = valor;
        }
      }
      return next;
    });
    setRevisaoForm(null);
    toast.success("Sugestões aplicadas — revise e salve");
  }

  async function gerarRelatorio() {
    // O popup é aberto via document.write — uma janela SEM sessão Supabase, que
    // não consegue assinar URL. Então assino as fotos AQUI (em lote) e embuto as
    // URLs assinadas no HTML. Sem isso, ao privatizar o bucket `fotos` o relatório
    // sairia com as imagens quebradas.
    const todas = Array.from(new Set(maquinas.flatMap((m) => m.foto_urls).filter(Boolean)));
    const assinadas = new Map<string, string>();
    const comPath = todas
      .map((u) => ({ u, path: extrairPathStorage(u, "fotos") }))
      .filter((x): x is { u: string; path: string } => !!x.path);
    if (comPath.length) {
      try {
        const sb = createSupabaseBrowserClient();
        const { data } = await sb.storage
          .from("fotos")
          .createSignedUrls(comPath.map((x) => x.path), 3600);
        data?.forEach((d, i) => {
          if (d.signedUrl) assinadas.set(comPath[i].u, d.signedUrl);
        });
      } catch {
        // fallback: mantém as URLs originais (degrada como antes, não trava o relatório)
      }
    }
    const html = buildRelatorioHTML(maquinas, setoresMap, assinadas);
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloqueado. Permita popups para este site."); return; }
    w.document.write(html);
    w.document.close();
  }

  /** Envia as máquinas da inspeção pro inventário NR-12 (módulo Apreciação). */
  async function enviarParaApreciacao() {
    try {
      const r = await importarApreciacao.mutateAsync(maquinas);
      if (r.criadas > 0) {
        toast.success(
          `${r.criadas} máquina${r.criadas > 1 ? "s" : ""} enviada${r.criadas > 1 ? "s" : ""} pro inventário NR-12` +
            (r.ignoradas > 0 ? ` · ${r.ignoradas} já existia(m)` : "") +
            " — disponíveis em Apreciação de Máquinas",
          { duration: 6000 }
        );
      } else {
        toast(`Todas as ${r.ignoradas} máquinas já estão no inventário NR-12.`, { icon: "ℹ️" });
      }
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  // ─── render helpers ────────────────────────────────────────────────────────

  function BoolToggle({
    value,
    onChange,
  }: {
    value: boolean | null;
    onChange: (v: boolean | null) => void;
  }) {
    return (
      <div className="flex gap-0.5">
        {BOOL_OPTS.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              value === opt.value
                ? "bg-verde-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  function SafetyIcon({ val }: { val: boolean | null }) {
    if (val === true) return <CheckCircle2 className="size-3.5 text-green-600" />;
    if (val === false) return <XCircle className="size-3.5 text-red-500" />;
    return <span className="size-3.5 inline-block text-gray-300">—</span>;
  }

  function GrauBadge({ grau }: { grau: GrauRisco | null }) {
    if (!grau) return null;
    return (
      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", GRAU_COLORS[grau])}>
        {GRAU_LABELS[grau]}
      </span>
    );
  }

  function MaquinaCard({ m }: { m: InspecaoMaquina }) {
    const isDeleting = deletingId === m.id_maquina_inspecao;
    const isAnalysing = analisandoId === m.id_maquina_inspecao;
    const parecerOpen = expandedParecer === m.id_maquina_inspecao;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Wrench className="size-4 shrink-0 text-gray-500" />
              <span className="font-semibold text-gray-900">{m.nome}</span>
              {m.tipo && <span className="text-xs text-gray-500">{m.tipo}</span>}
              <GrauBadge grau={m.grau_risco} />
              {m.necessita_adequacao_nr12 && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                  Adequação NR-12
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
              {m.marca && <span>Marca: {m.marca}</span>}
              {m.modelo && <span>Modelo: {m.modelo}</span>}
              {m.numero_serie && <span>N/S: {m.numero_serie}</span>}
              {m.tag && <span>TAG: {m.tag}</span>}
              {m.potencia && <span>Potência: {m.potencia}</span>}
              {m.tensao && <span>Tensão: {m.tensao}</span>}
            </div>
            {/* safety icons row */}
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {SAFETY_FIELDS.map(({ key, label }) => (
                <span key={key} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <SafetyIcon val={m[key] as boolean | null} />
                  {label}
                </span>
              ))}
            </div>
            {/* fotos */}
            {m.foto_urls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.foto_urls.map((url, i) => (
                  <span
                    key={i}
                    onClick={() => abrirMidiaAssinada(url)}
                    title="Clique para ampliar"
                    className="cursor-pointer"
                  >
                    <StorageImg
                      stored={m.foto_storage_paths?.[i] || url}
                      alt={`foto ${i + 1}`}
                      className="h-14 w-14 rounded border border-gray-200 object-cover hover:opacity-80"
                    />
                  </span>
                ))}
              </div>
            )}
            {/* parecer IA */}
            {m.parecer_ia && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedParecer(parecerOpen ? null : m.id_maquina_inspecao)
                  }
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900"
                >
                  <Bot className="size-3.5" />
                  Parecer IA
                  {parecerOpen ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </button>
                {parecerOpen && (
                  <p className="mt-1 rounded-md border border-purple-100 bg-purple-50 p-2 text-[11px] leading-relaxed text-purple-900 whitespace-pre-wrap">
                    {m.parecer_ia}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* actions */}
          {!readOnly && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => analisarComIA(m)}
                disabled={isAnalysing}
                title="Analisar com IA (NR-12)"
                className="rounded-md border border-purple-200 bg-purple-50 p-1.5 text-purple-700 hover:bg-purple-100 disabled:opacity-50"
              >
                {isAnalysing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Bot className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => openEdit(m)}
                className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(m)}
                disabled={isDeleting}
                className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Máquinas / NR-12</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {maquinas.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* view toggle */}
          <div className="flex overflow-hidden rounded-md border border-gray-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setView("lista")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                view === "lista"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setView("por-setor")}
              className={cn(
                "border-l border-gray-200 px-3 py-1.5 transition-colors",
                view === "por-setor"
                  ? "bg-verde-primary text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              Por Setor
            </button>
          </div>
          {maquinas.length > 0 && (
            <button
              type="button"
              onClick={gerarRelatorio}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileText className="size-3.5" />
              Relatório
            </button>
          )}
          {maquinas.length > 0 && !readOnly && (
            <button
              type="button"
              onClick={enviarParaApreciacao}
              disabled={importarApreciacao.isPending}
              title="Envia as máquinas desta inspeção pro inventário do módulo Apreciação de Máquinas NR-12 (sem duplicar)"
              className="inline-flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            >
              {importarApreciacao.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Enviar p/ Apreciação NR-12
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent"
            >
              <Plus className="size-3.5" />
              Adicionar Máquina
            </button>
          )}
        </div>
      </div>

      {/* form panel */}
      {formOpen && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">
              {editando ? "Editar Máquina" : "Nova Máquina"}
            </h4>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* setor primeiro — toda máquina pertence a um setor */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Setor
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Setor(es) da máquina <span className="text-red-500">*</span>
                  </label>
                  {/* v160: a mesma máquina pode ser usada em mais de um setor */}
                  <SetorMultiSelect
                    setores={setores}
                    value={form.ids_setores}
                    onChange={(ids) => f("ids_setores", ids)}
                  />
                  {setores.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Cadastre os setores na aba Setores antes de adicionar máquinas.
                    </p>
                  )}
                  {form.ids_setores.length === 0 && setores.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Escolha ao menos um setor pra liberar os dados da máquina.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {form.ids_setores.length > 0 && (
            <>
            {/* identificação */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Identificação
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Nome / Descrição <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.nome}
                    onChange={(e) => f("nome", e.target.value)}
                    placeholder="Ex: Prensa Hidráulica 50T"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  />
                </div>
                {(
                  [
                    { k: "tipo", label: "Tipo" },
                    { k: "marca", label: "Fabricante / Marca" },
                    { k: "modelo", label: "Modelo" },
                    { k: "numero_serie", label: "Nº de Série" },
                    { k: "tag", label: "TAG / Patrimônio" },
                    { k: "ano_fabricacao", label: "Ano de Fabricação" },
                  ] as const
                ).map(({ k, label }) => (
                  <div key={k}>
                    <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
                    <input
                      value={form[k] as string}
                      onChange={(e) => f(k, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* capacidade */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Capacidade
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Potência</label>
                  <input
                    value={form.potencia}
                    onChange={(e) => f("potencia", e.target.value)}
                    placeholder="Ex: 5 kW"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Tensão</label>
                  <input
                    value={form.tensao}
                    onChange={(e) => f("tensao", e.target.value)}
                    placeholder="Ex: 220 V"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* segurança NR-12 */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Segurança NR-12
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SAFETY_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                    <span className="text-xs text-gray-700">{label}</span>
                    <BoolToggle
                      value={form[key as keyof FormState] as boolean | null}
                      onChange={(v) => f(key as keyof FormState, v)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-md border border-orange-100 bg-orange-50 px-3 py-2">
                  <span className="text-xs font-medium text-orange-800">Necessita adequação NR-12?</span>
                  <BoolToggle
                    value={form.necessita_adequacao_nr12}
                    onChange={(v) => f("necessita_adequacao_nr12", v)}
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Grau de Risco</label>
                <select
                  value={form.grau_risco}
                  onChange={(e) => f("grau_risco", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none sm:w-48"
                >
                  <option value="">— não avaliado —</option>
                  {(["BAIXO", "MEDIO", "ALTO", "CRITICO"] as GrauRisco[]).map((g) => (
                    <option key={g} value={g}>{GRAU_LABELS[g]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* observações */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Observações técnicas</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => f("observacoes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
              />
            </div>

            {/* fotos */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Fotos da Máquina (máx. 4 — usadas pela IA)
                </p>
                <button
                  type="button"
                  onClick={handleAnalisarFotosForm}
                  disabled={analisandoForm || fotosPreview.length === 0}
                  title="A IA lê as fotos e sugere os dados da máquina (identificação + segurança NR-12). Você revisa antes de aplicar."
                  className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {analisandoForm ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Bot className="size-3.5" />
                  )}
                  Preencher com IA
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {fotosPreview.map((url, i) => (
                  <div key={i} className="relative">
                    <StorageImg
                      stored={url}
                      alt={`foto ${i + 1}`}
                      className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFoto(i)}
                      className="absolute -right-1.5 -top-1.5 rounded-full border border-white bg-red-500 p-0.5 text-white hover:bg-red-600"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
                {fotosPreview.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-verde-primary hover:text-verde-primary"
                  >
                    <Camera className="size-5" />
                    <span className="text-[10px]">Foto</span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFotoSelect(e.target.files)}
              />
            </div>
            </>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || form.ids_setores.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editando ? "Salvar alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {/* empty */}
      {maquinas.length === 0 && !formOpen && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <Wrench className="mx-auto mb-2 size-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Nenhuma máquina cadastrada</p>
          {!readOnly && (
            <p className="mt-1 text-xs text-gray-400">
              Clique em &quot;Adicionar Máquina&quot; para registrar equipamentos NR-12
            </p>
          )}
        </div>
      )}

      {/* lista view */}
      {view === "lista" && maquinas.length > 0 && (
        <div className="space-y-2">
          {maquinas.map((m) => (
            <MaquinaCard key={m.id_maquina_inspecao} m={m} />
          ))}
        </div>
      )}

      {/* por-setor view */}
      {view === "por-setor" && maquinas.length > 0 && (
        <div className="space-y-4">
          {/* setores com máquinas */}
          {setores
            .filter((s) => maquinasPorSetor.has(s.id_setor))
            .map((s) => {
              const lista = maquinasPorSetor.get(s.id_setor) ?? [];
              return (
                <div key={s.id_setor} className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-amber-50 px-4 py-2.5 rounded-t-xl">
                    <Layers className="size-4 text-amber-700" />
                    <span className="font-semibold text-amber-900">{s.setor_ghe}</span>
                    <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      {lista.length} máquina{lista.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {lista.map((m) => (
                      <MaquinaCard key={m.id_maquina_inspecao} m={m} />
                    ))}
                  </div>
                </div>
              );
            })}
          {/* sem setor */}
          {maquinasPorSetor.has(null) && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5 rounded-t-xl">
                <AlertTriangle className="size-4 text-gray-500" />
                <span className="font-semibold text-gray-700">Sem setor vinculado</span>
                <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  {(maquinasPorSetor.get(null) ?? []).length}
                </span>
              </div>
              <div className="space-y-2 p-3">
                {(maquinasPorSetor.get(null) ?? []).map((m) => (
                  <MaquinaCard key={m.id_maquina_inspecao} m={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revisão da análise de IA — aceitar/editar/rejeitar antes de persistir */}
      {revisaoIA && (
        <RevisaoIAModal
          titulo={`Análise NR-12 da IA — ${revisaoIA.maquina.nome}`}
          descricao="Sugestões geradas a partir das fotos e dados da máquina. Nada é salvo sem a sua confirmação."
          campos={revisaoIA.campos}
          onAplicar={aplicarRevisaoIA}
          onClose={() => setRevisaoIA(null)}
          aplicando={aplicandoIA}
        />
      )}

      {/* Revisão das sugestões da IA lidas das fotos do FORM */}
      {revisaoForm && (
        <RevisaoIAModal
          titulo="Sugestões da IA — dados da máquina"
          descricao="Extraído das fotos anexadas. O que a IA não identificou ficou de fora — preencha manualmente."
          campos={revisaoForm}
          onAplicar={aplicarRevisaoForm}
          onClose={() => setRevisaoForm(null)}
        />
      )}
    </div>
  );
}

// ─── relatório HTML ────────────────────────────────────────────────────────

function buildRelatorioHTML(
  maquinas: InspecaoMaquina[],
  setoresMap: Map<string, string>,
  fotosAssinadas: Map<string, string> = new Map()
): string {
  const grauCores: Record<string, string> = {
    BAIXO: "#166534",
    MEDIO: "#92400e",
    ALTO: "#9a3412",
    CRITICO: "#7f1d1d",
  };
  const grauBg: Record<string, string> = {
    BAIXO: "#dcfce7",
    MEDIO: "#fef3c7",
    ALTO: "#ffedd5",
    CRITICO: "#fee2e2",
  };

  const boolStr = (v: boolean | null) =>
    v === true ? "Sim" : v === false ? "Não" : "—";

  // Agrupar por setor
  const grupos = new Map<string, { nome: string; items: InspecaoMaquina[] }>();
  for (const m of maquinas) {
    // v160: sem setor vira um grupo so; com varios, a maquina entra em cada um
    const chaves = m.ids_setores && m.ids_setores.length > 0 ? m.ids_setores : [null];
    for (const idSetor of chaves) {
      const key = idSetor ?? "__sem_setor__";
      const nome = idSetor
        ? (setoresMap.get(idSetor) ?? "Setor desconhecido")
        : "Sem setor vinculado";
      const g = grupos.get(key) ?? { nome, items: [] };
      g.items.push(m);
      grupos.set(key, g);
    }
  }

  const rows = Array.from(grupos.values())
    .map(({ nome, items }) => {
      const cards = items
        .map((m) => {
          const grauStyle = m.grau_risco
            ? `background:${grauBg[m.grau_risco]};color:${grauCores[m.grau_risco]};border:1px solid ${grauCores[m.grau_risco]}33;`
            : "";
          const fotos = m.foto_urls.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${m.foto_urls
                .map(
                  (u) =>
                    `<img src="${fotosAssinadas.get(u) ?? u}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" referrerpolicy="no-referrer"/>`
                )
                .join("")}</div>`
            : "";
          const parecer = m.parecer_ia
            ? `<div style="margin-top:8px;padding:8px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;font-size:11px;color:#4c1d95;white-space:pre-wrap;">${m.parecer_ia}</div>`
            : "";
          const safety = SAFETY_FIELDS.map(
            ({ key, label }) =>
              `<span style="margin-right:10px;font-size:10px;color:#555;">${boolStr(m[key as keyof InspecaoMaquina] as boolean | null)} ${label}</span>`
          ).join("");
          return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;background:#fff;page-break-inside:avoid;">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
    <strong style="font-size:13px;">${m.nome}</strong>
    ${m.tipo ? `<span style="font-size:11px;color:#6b7280;">${m.tipo}</span>` : ""}
    ${m.grau_risco ? `<span style="border-radius:12px;padding:2px 8px;font-size:10px;font-weight:600;${grauStyle}">${m.grau_risco}</span>` : ""}
    ${m.necessita_adequacao_nr12 ? `<span style="border-radius:12px;padding:2px 8px;font-size:10px;font-weight:600;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;">Adequação NR-12</span>` : ""}
  </div>
  <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
    ${m.marca ? `Marca: ${m.marca} &nbsp;` : ""}${m.modelo ? `Modelo: ${m.modelo} &nbsp;` : ""}${m.numero_serie ? `N/S: ${m.numero_serie} &nbsp;` : ""}${m.tag ? `TAG: ${m.tag} &nbsp;` : ""}${m.potencia ? `Potência: ${m.potencia} &nbsp;` : ""}${m.tensao ? `Tensão: ${m.tensao}` : ""}
  </div>
  <div style="margin-bottom:4px;">${safety}</div>
  ${m.observacoes ? `<div style="font-size:11px;color:#374151;margin-top:4px;">${m.observacoes}</div>` : ""}
  ${fotos}
  ${parecer}
</div>`;
        })
        .join("");

      return `
<div style="margin-bottom:24px;">
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
    <strong style="font-size:13px;color:#92400e;">${nome}</strong>
    <span style="font-size:11px;color:#b45309;">(${items.length} máquina${items.length !== 1 ? "s" : ""})</span>
  </div>
  ${cards}
</div>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório de Máquinas NR-12</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:32px 40px;max-width:900px;margin:0 auto;}
  @media print{body{padding:16px 20px;}button{display:none!important;}}
</style>
</head><body>
<div style="border-bottom:3px solid #16a34a;padding-bottom:12px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
  <div>
    <h1 style="font-size:20px;font-weight:700;color:#15803d;">Relatório de Máquinas — NR-12</h1>
    <p style="font-size:12px;color:#6b7280;margin-top:4px;">Inventário de equipamentos e conformidade NR-12 por setor</p>
  </div>
  <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Imprimir</button>
</div>
${rows}
</body></html>`;
}
