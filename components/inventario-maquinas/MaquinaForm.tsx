"use client";

import { useState, useRef, useEffect } from "react";
import { Save, Upload, X, ImageOff, Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import StorageImg from "@/components/ui/StorageImg";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import {
  uploadFotoMaquina,
  removerFotoMaquinaStorage,
  type MaquinaInput,
} from "@/lib/hooks/useInventarioMaquinas";
import {
  STATUS_MAQUINA_LABELS,
  GRAU_RISCO_MAQUINA_LABELS,
  type Maquina,
  type StatusMaquina,
  type GrauRiscoMaquina,
} from "@/lib/supabase/types";
import RevisaoIAModal, { type CampoRevisaoIA } from "@/components/ui/RevisaoIAModal";
import { cn } from "@/lib/utils";

const BOOL_OPTS = [
  { value: "", label: "— Não informado —" },
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

function parseBool(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function initialForm(m?: Maquina): MaquinaInput {
  return {
    id_empresa: m?.id_empresa ?? null,
    nome: m?.nome ?? "",
    tipo: m?.tipo ?? null,
    categoria: m?.categoria ?? null,
    codigo_interno: m?.codigo_interno ?? null,
    tag: m?.tag ?? null,
    marca: m?.marca ?? null,
    modelo: m?.modelo ?? null,
    numero_serie: m?.numero_serie ?? null,
    ano_fabricacao: m?.ano_fabricacao ?? null,
    numero_patrimonio: m?.numero_patrimonio ?? null,
    status: m?.status ?? "OPERANTE",
    unidade: m?.unidade ?? null,
    setor: m?.setor ?? null,
    linha_processo: m?.linha_processo ?? null,
    area: m?.area ?? null,
    responsavel_setor: m?.responsavel_setor ?? null,
    operacao_executada: m?.operacao_executada ?? null,
    localizacao: m?.localizacao ?? null,
    capacidade_operacional: m?.capacidade_operacional ?? null,
    producao_estimada: m?.producao_estimada ?? null,
    potencia: m?.potencia ?? null,
    tensao: m?.tensao ?? null,
    pressao: m?.pressao ?? null,
    capacidade_carga: m?.capacidade_carga ?? null,
    velocidade: m?.velocidade ?? null,
    dimensoes: m?.dimensoes ?? null,
    finalidade: m?.finalidade ?? null,
    descricao_tecnica: m?.descricao_tecnica ?? null,
    protecao_fixa: m?.protecao_fixa ?? null,
    descricao_protecao_fixa: m?.descricao_protecao_fixa ?? null,
    protecao_movel: m?.protecao_movel ?? null,
    descricao_protecao_movel: m?.descricao_protecao_movel ?? null,
    dispositivos_seguranca: m?.dispositivos_seguranca ?? null,
    intertravamento: m?.intertravamento ?? null,
    botao_emergencia: m?.botao_emergencia ?? null,
    sistema_bloqueio: m?.sistema_bloqueio ?? null,
    possui_manual: m?.possui_manual ?? null,
    possui_diagrama_eletrico: m?.possui_diagrama_eletrico ?? null,
    aterramento: m?.aterramento ?? null,
    sinalizacao: m?.sinalizacao ?? null,
    necessita_adequacao_nr12: m?.necessita_adequacao_nr12 ?? null,
    grau_risco: m?.grau_risco ?? null,
    observacoes_tecnicas: m?.observacoes_tecnicas ?? null,
    observacoes: m?.observacoes ?? null,
    foto_url: m?.foto_url ?? null,
    foto_storage_path: m?.foto_storage_path ?? null,
  };
}

interface MaquinaFormProps {
  inicial?: Maquina;
  idMaquina: string;
  disabled?: boolean;
  onSubmit: (input: MaquinaInput) => Promise<void>;
  submitLabel?: string;
}

const ABAS = ["Identificação", "Localização", "Capacidade", "Segurança"] as const;

export default function MaquinaForm({
  inicial,
  idMaquina,
  disabled = false,
  onSubmit,
  submitLabel = "Salvar",
}: MaquinaFormProps) {
  const { data: empresas = [] } = useEmpresas();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<MaquinaInput>(() => initialForm(inicial));
  const [abaAtiva, setAbaAtiva] = useState<0 | 1 | 2 | 3>(0);
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  // Sugestões da IA aguardando revisão (modal aceitar/editar/rejeitar)
  const [revisaoIA, setRevisaoIA] = useState<CampoRevisaoIA[] | null>(null);

  useEffect(() => {
    if (inicial) setForm(initialForm(inicial));
  }, [inicial]);

  function setF(key: keyof MaquinaInput, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Foto maior que 10 MB. Reduza antes de enviar.");
      return;
    }
    setFotoFile(file);
    setUploading(true);
    try {
      if (form.foto_storage_path) {
        await removerFotoMaquinaStorage(form.foto_storage_path);
      }
      const { publicUrl, storagePath } = await uploadFotoMaquina(idMaquina, file);
      setF("foto_url", publicUrl);
      setF("foto_storage_path", storagePath);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar foto.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAnalisarIA() {
    if (!fotoFile) return;
    setAnalisando(true);
    try {
      // Redimensiona para max 1024px antes de enviar (reduz custo de tokens)
      const base64 = await resizeAndBase64(fotoFile, 1024);
      const res = await fetch("/api/maquina/analisar-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: fotoFile.type || "image/jpeg" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { data } = await res.json() as { data: Record<string, unknown> };
      // Monta a revisão — nada é aplicado sem o usuário confirmar no modal
      const SUGESTOES: { key: keyof MaquinaInput & string; label: string; multiline?: boolean }[] = [
        { key: "nome", label: "Nome da máquina" },
        { key: "tipo", label: "Tipo" },
        { key: "categoria", label: "Categoria" },
        { key: "marca", label: "Fabricante / Marca" },
        { key: "modelo", label: "Modelo" },
        { key: "numero_serie", label: "Número de série" },
        { key: "ano_fabricacao", label: "Ano de fabricação" },
        { key: "capacidade_operacional", label: "Capacidade operacional" },
        { key: "tensao", label: "Tensão" },
        { key: "potencia", label: "Potência" },
        { key: "descricao_tecnica", label: "Descrição técnica", multiline: true },
      ];
      const campos: CampoRevisaoIA[] = [];
      for (const s of SUGESTOES) {
        const val = data[s.key];
        if (val === null || val === undefined || val === "") continue;
        campos.push({
          key: s.key,
          label: s.label,
          valorSugerido: String(val),
          valorAtual: form[s.key] != null ? String(form[s.key]) : null,
          multiline: s.multiline,
        });
      }
      if (campos.length === 0) {
        toast("A IA não identificou dados na foto. Tente uma foto da plaqueta.", { icon: "ℹ️" });
        return;
      }
      setRevisaoIA(campos);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha na análise IA");
    } finally {
      setAnalisando(false);
    }
  }

  /** Aplica os campos aceitos na revisão da IA. */
  function aplicarRevisaoIA(valores: Record<string, string>) {
    for (const [key, valor] of Object.entries(valores)) {
      if (key === "ano_fabricacao") {
        const n = Number(valor);
        setF("ano_fabricacao", valor && Number.isFinite(n) ? n : null);
      } else {
        setF(key as keyof MaquinaInput, valor || null);
      }
    }
    setRevisaoIA(null);
    toast.success("Sugestões aplicadas — revise e salve");
  }

  async function handleRemoverFoto() {
    if (form.foto_storage_path) {
      try {
        await removerFotoMaquinaStorage(form.foto_storage_path);
      } catch {
        // segue mesmo assim
      }
    }
    setF("foto_url", null);
    setF("foto_storage_path", null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome da máquina.");
      return;
    }
    if (!form.setor?.trim()) {
      toast.error("Informe o setor — toda máquina pertence a um setor.");
      return;
    }
    setSalvando(true);
    try {
      await onSubmit({ ...form, nome: form.nome.trim() });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Foto + Empresa */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Foto */}
        <div className="flex items-start gap-3">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {form.foto_url ? (
              <StorageImg stored={form.foto_url} alt="Foto" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-7 text-gray-300" />
            )}
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={disabled || uploading} onChange={handleFotoChange} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {form.foto_url ? "Trocar foto" : "Enviar foto"}
            </button>
            {/* Analisar com IA — aparece após enviar a foto */}
            {fotoFile && !disabled && (
              <button
                type="button"
                onClick={handleAnalisarIA}
                disabled={analisando || uploading}
                className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
              >
                {analisando ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {analisando ? "Analisando..." : "Analisar com IA"}
              </button>
            )}
            {form.foto_url && !disabled && (
              <button
                type="button"
                onClick={handleRemoverFoto}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <X className="size-3" /> Remover
              </button>
            )}
            <p className="text-[11px] text-gray-400">Até 10 MB · JPG/PNG/WebP</p>
          </div>
        </div>

        {/* Empresa */}
        <div className="min-w-[220px] flex-1">
          <Campo label="Empresa">
            <select
              value={form.id_empresa ?? ""}
              onChange={(e) => setF("id_empresa", e.target.value || null)}
              disabled={disabled}
              className={inputClass}
            >
              <option value="">Patrimônio interno JCN Consultoria</option>
              {empresas.map((e) => (
                <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {ABAS.map((aba, i) => (
            <button
              key={aba}
              type="button"
              onClick={() => setAbaAtiva(i as 0 | 1 | 2 | 3)}
              className={cn(
                "px-4 py-2 text-xs font-semibold transition-colors",
                abaAtiva === i
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {aba}
            </button>
          ))}
        </div>
      </div>

      {/* ABA 0: Identificação */}
      {abaAtiva === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nome da máquina / equipamento *">
              <input type="text" value={form.nome} onChange={(e) => setF("nome", e.target.value)} disabled={disabled} required placeholder="Ex: Furadeira de bancada" className={inputClass} />
            </Campo>
            <Campo label="Status">
              <select value={form.status} onChange={(e) => setF("status", e.target.value as StatusMaquina)} disabled={disabled} className={inputClass}>
                {(Object.keys(STATUS_MAQUINA_LABELS) as StatusMaquina[]).map((s) => (
                  <option key={s} value={s}>{STATUS_MAQUINA_LABELS[s]}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Tipo">
              <input type="text" value={form.tipo ?? ""} onChange={(e) => setF("tipo", e.target.value || null)} disabled={disabled} placeholder="Ex: Prensa, Torno, Compressor..." className={inputClass} />
            </Campo>
            <Campo label="Categoria">
              <input type="text" value={form.categoria ?? ""} onChange={(e) => setF("categoria", e.target.value || null)} disabled={disabled} placeholder="Ex: Máquina de produção, Auxiliar..." className={inputClass} />
            </Campo>
            <Campo label="Código interno">
              <input type="text" value={form.codigo_interno ?? ""} onChange={(e) => setF("codigo_interno", e.target.value || null)} disabled={disabled} placeholder="Ex: MAQ-001" className={inputClass} />
            </Campo>
            <Campo label="TAG">
              <input type="text" value={form.tag ?? ""} onChange={(e) => setF("tag", e.target.value || null)} disabled={disabled} placeholder="Ex: EQ-2024-001" className={inputClass} />
            </Campo>
            <Campo label="Fabricante / Marca">
              <input type="text" value={form.marca ?? ""} onChange={(e) => setF("marca", e.target.value || null)} disabled={disabled} placeholder="Ex: Schuler, Romi..." className={inputClass} />
            </Campo>
            <Campo label="Modelo">
              <input type="text" value={form.modelo ?? ""} onChange={(e) => setF("modelo", e.target.value || null)} disabled={disabled} placeholder="Ex: PH-200T" className={inputClass} />
            </Campo>
            <Campo label="Nº de série">
              <input type="text" value={form.numero_serie ?? ""} onChange={(e) => setF("numero_serie", e.target.value || null)} disabled={disabled} className={inputClass} />
            </Campo>
            <Campo label="Ano de fabricação">
              <input type="number" value={form.ano_fabricacao ?? ""} onChange={(e) => setF("ano_fabricacao", e.target.value ? Number(e.target.value) : null)} disabled={disabled} min={1900} max={new Date().getFullYear()} placeholder="Ex: 2018" className={inputClass} />
            </Campo>
            <Campo label="Nº de patrimônio">
              <input type="text" value={form.numero_patrimonio ?? ""} onChange={(e) => setF("numero_patrimonio", e.target.value || null)} disabled={disabled} placeholder="Código interno" className={inputClass} />
            </Campo>
          </div>
          <Campo label="Observações gerais">
            <textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value || null)} disabled={disabled} placeholder="Histórico, defeitos conhecidos, manutenções pendentes..." className={inputClass} />
          </Campo>
        </div>
      )}

      {/* ABA 1: Localização */}
      {abaAtiva === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Unidade">
            <input type="text" value={form.unidade ?? ""} onChange={(e) => setF("unidade", e.target.value || null)} disabled={disabled} placeholder="Ex: Planta I, Filial SP" className={inputClass} />
          </Campo>
          <Campo label="Setor *">
            <input type="text" value={form.setor ?? ""} onChange={(e) => setF("setor", e.target.value || null)} disabled={disabled} placeholder="Ex: Estamparia, Montagem" className={inputClass} />
          </Campo>
          <Campo label="Linha / Processo">
            <input type="text" value={form.linha_processo ?? ""} onChange={(e) => setF("linha_processo", e.target.value || null)} disabled={disabled} placeholder="Ex: Linha 3 — Conformação" className={inputClass} />
          </Campo>
          <Campo label="Área">
            <input type="text" value={form.area ?? ""} onChange={(e) => setF("area", e.target.value || null)} disabled={disabled} placeholder="Ex: Área produtiva, Almoxarifado" className={inputClass} />
          </Campo>
          <Campo label="Responsável pelo setor">
            <input type="text" value={form.responsavel_setor ?? ""} onChange={(e) => setF("responsavel_setor", e.target.value || null)} disabled={disabled} className={inputClass} />
          </Campo>
          <Campo label="Localização física">
            <input type="text" value={form.localizacao ?? ""} onChange={(e) => setF("localizacao", e.target.value || null)} disabled={disabled} placeholder="Ex: Galpão A, Sala 3" className={inputClass} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Operação executada">
              <textarea rows={3} value={form.operacao_executada ?? ""} onChange={(e) => setF("operacao_executada", e.target.value || null)} disabled={disabled} placeholder="Descreva a operação realizada pela máquina neste setor/processo..." className={inputClass} />
            </Campo>
          </div>
        </div>
      )}

      {/* ABA 2: Capacidade */}
      {abaAtiva === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Capacidade operacional">
            <input type="text" value={form.capacidade_operacional ?? ""} onChange={(e) => setF("capacidade_operacional", e.target.value || null)} disabled={disabled} placeholder="Ex: 200 ton, 500 L/h" className={inputClass} />
          </Campo>
          <Campo label="Produção estimada">
            <input type="text" value={form.producao_estimada ?? ""} onChange={(e) => setF("producao_estimada", e.target.value || null)} disabled={disabled} placeholder="Ex: 1200 peças/turno" className={inputClass} />
          </Campo>
          <Campo label="Potência">
            <input type="text" value={form.potencia ?? ""} onChange={(e) => setF("potencia", e.target.value || null)} disabled={disabled} placeholder="Ex: 15 kW, 20 CV" className={inputClass} />
          </Campo>
          <Campo label="Tensão">
            <input type="text" value={form.tensao ?? ""} onChange={(e) => setF("tensao", e.target.value || null)} disabled={disabled} placeholder="Ex: 380V trifásico" className={inputClass} />
          </Campo>
          <Campo label="Pressão">
            <input type="text" value={form.pressao ?? ""} onChange={(e) => setF("pressao", e.target.value || null)} disabled={disabled} placeholder="Ex: 8 bar, 120 PSI" className={inputClass} />
          </Campo>
          <Campo label="Capacidade de carga">
            <input type="text" value={form.capacidade_carga ?? ""} onChange={(e) => setF("capacidade_carga", e.target.value || null)} disabled={disabled} placeholder="Ex: 5 ton, 200 kg" className={inputClass} />
          </Campo>
          <Campo label="Velocidade">
            <input type="text" value={form.velocidade ?? ""} onChange={(e) => setF("velocidade", e.target.value || null)} disabled={disabled} placeholder="Ex: 1450 RPM, 0–80 m/min" className={inputClass} />
          </Campo>
          <Campo label="Dimensões (C × L × A)">
            <input type="text" value={form.dimensoes ?? ""} onChange={(e) => setF("dimensoes", e.target.value || null)} disabled={disabled} placeholder="Ex: 3,2m × 1,8m × 2,5m" className={inputClass} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Finalidade">
              <textarea rows={2} value={form.finalidade ?? ""} onChange={(e) => setF("finalidade", e.target.value || null)} disabled={disabled} placeholder="Descreva a finalidade principal..." className={inputClass} />
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo label="Descrição técnica da operação">
              <textarea rows={3} value={form.descricao_tecnica ?? ""} onChange={(e) => setF("descricao_tecnica", e.target.value || null)} disabled={disabled} placeholder="Descreva detalhadamente como a máquina opera, ciclos, interações com operador..." className={inputClass} />
            </Campo>
          </div>
        </div>
      )}

      {/* ABA 3: Segurança */}
      {abaAtiva === 3 && (
        <div className="space-y-5">
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-700">Dispositivos de segurança</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ["protecao_fixa", "Proteção fixa"],
                ["protecao_movel", "Proteção móvel"],
                ["intertravamento", "Intertravamento"],
                ["botao_emergencia", "Botão de emergência"],
                ["sistema_bloqueio", "Sistema de bloqueio"],
                ["aterramento", "Aterramento"],
                ["sinalizacao", "Sinalização"],
              ] as [keyof MaquinaInput, string][]).map(([key, label]) => (
                <Campo key={key} label={label}>
                  <select
                    value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                    onChange={(e) => setF(key, parseBool(e.target.value))}
                    disabled={disabled}
                    className={inputClass}
                  >
                    {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
            {/* Campos de texto para inventário NR-12 */}
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Campo label="Proteções fixas — descrição (NR-12)">
                <input type="text" value={form.descricao_protecao_fixa ?? ""} onChange={(e) => setF("descricao_protecao_fixa", e.target.value || null)} disabled={disabled} placeholder="Ex: Proteção fixa nas correntes de transmissão" className={inputClass} />
              </Campo>
              <Campo label="Proteções móveis — descrição (NR-12)">
                <input type="text" value={form.descricao_protecao_movel ?? ""} onChange={(e) => setF("descricao_protecao_movel", e.target.value || null)} disabled={disabled} placeholder="Ex: Proteção móvel no cabeçote, enclausuramento" className={inputClass} />
              </Campo>
              <Campo label="Dispositivos de segurança (NR-12)">
                <input type="text" value={form.dispositivos_seguranca ?? ""} onChange={(e) => setF("dispositivos_seguranca", e.target.value || null)} disabled={disabled} placeholder="Ex: Botões de parada de emergência, proteção lateral" className={inputClass} />
              </Campo>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-600">Documentação técnica</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ["possui_manual", "Manual da máquina"],
                ["possui_diagrama_eletrico", "Diagrama elétrico"],
              ] as [keyof MaquinaInput, string][]).map(([key, label]) => (
                <Campo key={key} label={label}>
                  <select
                    value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                    onChange={(e) => setF(key, parseBool(e.target.value))}
                    disabled={disabled}
                    className={inputClass}
                  >
                    {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-red-700">Avaliação de conformidade NR-12</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Grau de risco">
                <select value={form.grau_risco ?? ""} onChange={(e) => setF("grau_risco", (e.target.value as GrauRiscoMaquina) || null)} disabled={disabled} className={inputClass}>
                  <option value="">— Não avaliado —</option>
                  {(Object.keys(GRAU_RISCO_MAQUINA_LABELS) as GrauRiscoMaquina[]).map((g) => (
                    <option key={g} value={g}>{GRAU_RISCO_MAQUINA_LABELS[g]}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Necessita adequação NR-12?">
                <select
                  value={form.necessita_adequacao_nr12 === null || form.necessita_adequacao_nr12 === undefined ? "" : String(form.necessita_adequacao_nr12)}
                  onChange={(e) => setF("necessita_adequacao_nr12", parseBool(e.target.value))}
                  disabled={disabled}
                  className={inputClass}
                >
                  {BOOL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Campo>
            </div>
            <div className="mt-3">
              <Campo label="Observações técnicas de segurança">
                <textarea rows={3} value={form.observacoes_tecnicas ?? ""} onChange={(e) => setF("observacoes_tecnicas", e.target.value || null)} disabled={disabled} placeholder="Pendências de adequação, riscos identificados, ações necessárias..." className={inputClass} />
              </Campo>
            </div>
          </div>
        </div>
      )}

      {!disabled && (
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="submit"
            disabled={salvando || uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {submitLabel}
          </button>
        </div>
      )}

      {/* Revisão das sugestões da IA — aceitar/editar/rejeitar */}
      {revisaoIA && (
        <RevisaoIAModal
          titulo="Sugestões da IA — dados da máquina"
          descricao="Extraído da foto enviada (plaqueta/identificação da máquina)."
          campos={revisaoIA}
          onAplicar={aplicarRevisaoIA}
          onClose={() => setRevisaoIA(null)}
        />
      )}
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

/** Redimensiona e converte para base64 (sem prefixo data:) para envio ao servidor. */
async function resizeAndBase64(file: File, maxPx = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve(dataUrl.split(",")[1]); // remove prefixo "data:image/jpeg;base64,"
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}
