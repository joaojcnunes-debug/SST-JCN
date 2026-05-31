"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Grid3x3,
  Activity,
  BarChart3,
  ListChecks,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  Upload,
  Tags,
  HelpCircle,
  Layers,
  BookText,
} from "lucide-react";
import TiposRiscoTab from "@/components/config/TiposRiscoTab";
import PerguntasTab from "@/components/config/PerguntasTab";
import MatrizesTab from "@/components/config/MatrizesTab";
import TextosPadraoTab from "@/components/config/TextosPadraoTab";
import toast from "react-hot-toast";
import MatrizRisco from "@/components/riscos/MatrizRisco";
import { PROBABILIDADES, SEVERIDADES } from "@/lib/utils";
import { NIVEIS_RISCO, NIVEL_CONFIG } from "@/lib/constants";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import { useConfiguracoes, useSaveConfig, type Configs } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

type TabKey =
  | "matrizes"
  | "tiposRisco"
  | "perguntas"
  | "matrizPadrao"
  | "listas"
  | "probsev"
  | "niveis"
  | "logo"
  | "assinatura"
  | "textosPadrao";

export default function ConfigPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<TabKey>("matrizes");
  const { data: configs, isLoading } = useConfiguracoes();

  useEffect(() => {
    if (!isAdmin) {
      const t = setTimeout(() => {
        toast.error("Apenas administradores podem acessar Configurações");
        router.replace("/dashboard");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isAdmin, router]);

  const TABS = [
    { key: "matrizes" as TabKey, label: "Matrizes de Risco", icon: Layers },
    { key: "tiposRisco" as TabKey, label: "Tipos de Risco", icon: Tags },
    { key: "perguntas" as TabKey, label: "Perguntas Customizadas", icon: HelpCircle },
    { key: "matrizPadrao" as TabKey, label: "Matriz Padrão (visual)", icon: Grid3x3 },
    { key: "listas" as TabKey, label: "Listas Auxiliares", icon: ListChecks },
    { key: "probsev" as TabKey, label: "Probabilidade & Severidade (legado)", icon: Activity },
    { key: "niveis" as TabKey, label: "Níveis", icon: BarChart3 },
    { key: "logo" as TabKey, label: "Logo da Empresa", icon: ImageIcon },
    { key: "assinatura" as TabKey, label: "Assinatura da Empresa", icon: Upload },
    { key: "textosPadrao" as TabKey, label: "Textos Padrão", icon: BookText },
  ];

  if (isLoading || !configs) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <nav className="flex flex-wrap gap-1 border-b border-gray-200 p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-verde-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="p-5">
          {tab === "matrizes" && <MatrizesTab />}
          {tab === "tiposRisco" && <TiposRiscoTab />}
          {tab === "perguntas" && <PerguntasTab />}
          {tab === "matrizPadrao" && (
            <section className="space-y-3">
              <p className="text-sm text-gray-600">
                Visualização da matriz SGG padrão (calculada pela fórmula
                hardcoded). Para criar matrizes customizadas, use a aba{" "}
                <strong>Matrizes de Risco</strong>.
              </p>
              <MatrizRisco />
            </section>
          )}

          {tab === "listas" && (
            <ListasAuxiliares configs={configs} />
          )}

          {tab === "probsev" && (
            <ProbSevView />
          )}

          {tab === "niveis" && <NiveisView />}

          {tab === "logo" && <LogoUpload configs={configs} />}

          {tab === "assinatura" && <AssinaturaEmpresaUpload configs={configs} />}

          {tab === "textosPadrao" && <TextosPadraoTab />}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Listas auxiliares (editáveis)
// =============================================================

function ListasAuxiliares({ configs }: { configs: Configs }) {
  const LISTAS: { key: keyof Configs; titulo: string; desc: string }[] = [
    {
      key: "meios_propagacao",
      titulo: "Meios de Propagação",
      desc: "Aparece no select 'Meio de Propagação' do form de risco.",
    },
    {
      key: "situacoes",
      titulo: "Situações",
      desc: "Aparece no select 'Situação' do form de risco.",
    },
    {
      key: "tempos_exposicao",
      titulo: "Tempos de Exposição",
      desc: "Aparece no select 'Tempo de Exposição' do form de risco.",
    },
    {
      key: "tecnicas",
      titulo: "Técnicas Utilizadas",
      desc: "Aparece no select 'Técnica Utilizada' do form de risco.",
    },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Edite as listas usadas nos selects do formulário de risco. Use as
        setas para reordenar e o botão de lixeira para remover.{" "}
        <strong>
          Atenção: alterar/remover valores que já estão sendo usados em riscos
          existentes pode deixar registros antigos com valor inconsistente.
        </strong>
      </p>
      {LISTAS.map((l) => (
        <ListaEditor
          key={l.key}
          chave={l.key}
          titulo={l.titulo}
          desc={l.desc}
          itens={configs[l.key] as string[]}
        />
      ))}
    </div>
  );
}

function ListaEditor({
  chave,
  titulo,
  desc,
  itens,
}: {
  chave: keyof Configs;
  titulo: string;
  desc: string;
  itens: string[];
}) {
  const save = useSaveConfig();
  const [local, setLocal] = useState<string[]>(itens);
  const [novo, setNovo] = useState("");
  const dirty = JSON.stringify(local) !== JSON.stringify(itens);

  useEffect(() => {
    setLocal(itens);
  }, [itens]);

  function move(idx: number, dir: -1 | 1) {
    const arr = [...local];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setLocal(arr);
  }

  function remove(idx: number) {
    setLocal(local.filter((_, i) => i !== idx));
  }

  function rename(idx: number, val: string) {
    setLocal(local.map((v, i) => (i === idx ? val : v)));
  }

  function add() {
    const v = novo.trim();
    if (!v) return;
    if (local.includes(v)) {
      toast.error("Já existe");
      return;
    }
    setLocal([...local, v]);
    setNovo("");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={() => save.mutate({ chave, valor: local })}
            disabled={save.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
          >
            <Save className="size-3.5" /> Salvar
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {local.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className="flex items-center gap-1 rounded border border-gray-100 bg-gray-50 px-2 py-1"
          >
            <span className="w-6 text-center text-xs font-mono text-gray-400">
              {i}
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => rename(i, e.target.value)}
              className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-verde-primary focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
              title="Subir"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === local.length - 1}
              className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
              title="Descer"
            >
              <ArrowDown className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-alert"
              title="Remover"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Adicionar item..."
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}

// =============================================================
// Probabilidades / Severidades (read-only, com explicação)
// =============================================================

function ProbSevView() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ℹ️ Probabilidades e Severidades são parte da fórmula{" "}
        <code className="rounded bg-white px-1">calcularNivelRisco</code> em{" "}
        <code className="rounded bg-white px-1">lib/utils.ts</code>. Renomear
        afeta os labels mas pode quebrar avaliações antigas; alterar a
        quantidade quebra a fórmula. Para alterar, edite o código fonte.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListaReadOnly titulo="Probabilidades (5)" itens={[...PROBABILIDADES]} />
        <ListaReadOnly titulo="Severidades (4)" itens={[...SEVERIDADES]} />
      </div>
    </div>
  );
}

function ListaReadOnly({
  titulo,
  itens,
}: {
  titulo: string;
  itens: string[];
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{titulo}</h3>
      <ol className="space-y-1">
        {itens.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-verde-light text-xs font-bold text-verde-primary">
              {i}
            </span>
            <span className="text-sm text-gray-800">{item}</span>
            <span className="ml-auto text-xs text-gray-400">peso {i}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// =============================================================
// Níveis (read-only)
// =============================================================

function NiveisView() {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-gray-900">
        Níveis de Risco
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Cores aplicadas nos badges e na matriz.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {NIVEIS_RISCO.map((n, i) => {
          const cfg = NIVEL_CONFIG[n];
          return (
            <div
              key={n}
              className="rounded-lg border p-3"
              style={{ borderColor: cfg.borda, backgroundColor: cfg.bg }}
            >
              <p className="text-xs text-gray-500">Grau {i + 1}</p>
              <p className="text-lg font-bold" style={{ color: cfg.cor }}>
                {n}
              </p>
              <p className="mt-1 font-mono text-[10px]" style={{ color: cfg.cor }}>
                {cfg.cor}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// =============================================================
// Upload de logo da empresa
// =============================================================

function LogoUpload({ configs }: { configs: Configs }) {
  const save = useSaveConfig();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `_config/logo_${gerarId("LOGO")}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      save.mutate({ chave: "logo_url", valor: pub.publicUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">
        Logo da Empresa
      </h2>
      <p className="text-sm text-gray-600">
        Esta logo aparece nos relatórios. Recomendado: PNG transparente,
        proporção 4:1, mín. 400×100px.
      </p>

      {configs.logo_url ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={configs.logo_url}
            alt="Logo"
            className="max-h-24 max-w-md object-contain"
          />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma logo configurada.
        </p>
      )}

      <div className="flex items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-sm font-medium text-white hover:bg-verde-accent ${
            uploading ? "opacity-50" : ""
          }`}
        >
          <Upload className="size-4" />
          {uploading
            ? "Enviando..."
            : configs.logo_url
            ? "Trocar logo"
            : "Enviar logo"}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFile}
            className="hidden"
          />
        </label>
        {configs.logo_url && (
          <button
            type="button"
            onClick={() => save.mutate({ chave: "logo_url", valor: "" })}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Remover
          </button>
        )}
      </div>
    </section>
  );
}

// =============================================================
// Upload de assinatura da empresa
// =============================================================

function AssinaturaEmpresaUpload({ configs }: { configs: Configs }) {
  const save = useSaveConfig();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `assinaturas/empresa_${gerarId("EMP")}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      save.mutate({ chave: "assinatura_empresa_url", valor: pub.publicUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        Assinatura da Empresa
      </h2>
      <p className="text-sm text-gray-600">
        Esta assinatura aparece no bloco final de todos os relatórios, ao lado
        da assinatura do técnico responsável. Recomendado: PNG transparente,
        proporção 3:1, mín. 300×100px.
      </p>

      {configs.assinatura_empresa_url ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={configs.assinatura_empresa_url}
            alt="Assinatura da empresa"
            className="max-h-24 max-w-md object-contain"
          />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma assinatura da empresa configurada.
        </p>
      )}

      <div className="flex items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-sm font-medium text-white hover:bg-verde-accent ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Upload className="size-4" />
          {uploading
            ? "Enviando..."
            : configs.assinatura_empresa_url
            ? "Trocar assinatura"
            : "Enviar assinatura"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={handleFile}
            className="hidden"
          />
        </label>
        {configs.assinatura_empresa_url && (
          <button
            type="button"
            onClick={() =>
              save.mutate({ chave: "assinatura_empresa_url", valor: "" })
            }
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Remover
          </button>
        )}
      </div>
    </section>
  );
}
