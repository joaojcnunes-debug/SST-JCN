"use client";

import { useState, useRef, useEffect } from "react";
import { Save, Upload, X, ImageOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import {
  uploadFotoMaquina,
  removerFotoMaquinaStorage,
  type MaquinaInput,
} from "@/lib/hooks/useInventarioMaquinas";
import {
  STATUS_MAQUINA_LABELS,
  type Maquina,
  type StatusMaquina,
} from "@/lib/supabase/types";

const STATUS_OPCOES: StatusMaquina[] = [
  "OPERANTE",
  "MANUTENCAO",
  "INATIVA",
  "BAIXADA",
];

interface MaquinaFormProps {
  /** Quando presente, modo edição. Quando undefined, modo criação. */
  inicial?: Maquina;
  /** ID estável da máquina pra upload de foto. No modo criação, gerar antes
   *  de chamar o form (o caller passa o `id_maquina` que vai ser usado no insert). */
  idMaquina: string;
  disabled?: boolean;
  /** Chamado quando o usuário clica Salvar. Recebe o input já validado. */
  onSubmit: (input: MaquinaInput) => Promise<void>;
  /** Texto do botão de submit. Default: "Salvar". */
  submitLabel?: string;
}

export default function MaquinaForm({
  inicial,
  idMaquina,
  disabled = false,
  onSubmit,
  submitLabel = "Salvar",
}: MaquinaFormProps) {
  const { data: empresas = [] } = useEmpresas();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [idEmpresa, setIdEmpresa] = useState<string>(inicial?.id_empresa ?? "");
  const [marca, setMarca] = useState(inicial?.marca ?? "");
  const [modelo, setModelo] = useState(inicial?.modelo ?? "");
  const [numeroSerie, setNumeroSerie] = useState(inicial?.numero_serie ?? "");
  const [anoFabricacao, setAnoFabricacao] = useState<string>(
    inicial?.ano_fabricacao?.toString() ?? ""
  );
  const [numeroPatrimonio, setNumeroPatrimonio] = useState(
    inicial?.numero_patrimonio ?? ""
  );
  const [localizacao, setLocalizacao] = useState(inicial?.localizacao ?? "");
  const [status, setStatus] = useState<StatusMaquina>(
    inicial?.status ?? "OPERANTE"
  );
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial?.foto_url ?? null);
  const [fotoPath, setFotoPath] = useState<string | null>(
    inicial?.foto_storage_path ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Reinicia estado quando inicial muda (caso da edição que carrega async).
  useEffect(() => {
    if (!inicial) return;
    setNome(inicial.nome);
    setIdEmpresa(inicial.id_empresa ?? "");
    setMarca(inicial.marca ?? "");
    setModelo(inicial.modelo ?? "");
    setNumeroSerie(inicial.numero_serie ?? "");
    setAnoFabricacao(inicial.ano_fabricacao?.toString() ?? "");
    setNumeroPatrimonio(inicial.numero_patrimonio ?? "");
    setLocalizacao(inicial.localizacao ?? "");
    setStatus(inicial.status);
    setObservacoes(inicial.observacoes ?? "");
    setFotoUrl(inicial.foto_url ?? null);
    setFotoPath(inicial.foto_storage_path ?? null);
  }, [inicial]);

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto maior que 5 MB. Reduza antes de enviar.");
      return;
    }
    setUploading(true);
    try {
      // Se já tinha foto anterior com path diferente, remove primeiro.
      if (fotoPath && !fotoPath.endsWith(file.name)) {
        await removerFotoMaquinaStorage(fotoPath);
      }
      const { publicUrl, storagePath } = await uploadFotoMaquina(idMaquina, file);
      setFotoUrl(publicUrl);
      setFotoPath(storagePath);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar foto.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoverFoto() {
    if (!fotoPath) {
      setFotoUrl(null);
      return;
    }
    try {
      await removerFotoMaquinaStorage(fotoPath);
    } catch {
      // Se falhar, segue mesmo assim — o usuário quer remover do form.
    }
    setFotoUrl(null);
    setFotoPath(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da máquina.");
      return;
    }
    const anoNum = anoFabricacao.trim() ? parseInt(anoFabricacao, 10) : null;
    if (anoFabricacao.trim() && (Number.isNaN(anoNum) || anoNum! < 1900)) {
      toast.error("Ano de fabricação inválido.");
      return;
    }
    setSalvando(true);
    try {
      await onSubmit({
        id_empresa: idEmpresa || null,
        nome: nome.trim(),
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        numero_serie: numeroSerie.trim() || null,
        ano_fabricacao: anoNum,
        numero_patrimonio: numeroPatrimonio.trim() || null,
        localizacao: localizacao.trim() || null,
        status,
        observacoes: observacoes.trim() || null,
        foto_url: fotoUrl,
        foto_storage_path: fotoPath,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Foto */}
      <div className="flex items-start gap-4">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt="Foto da máquina"
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImageOff className="size-8 text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || uploading}
            onChange={handleFotoChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {fotoUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {fotoUrl && !disabled && (
            <button
              type="button"
              onClick={handleRemoverFoto}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <X className="size-3" /> Remover foto
            </button>
          )}
          <p className="text-[11px] text-gray-500">Até 5 MB · JPG/PNG/WebP</p>
        </div>
      </div>

      {/* Grid de campos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Nome *" htmlFor="nome">
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={disabled}
            required
            placeholder="Ex: Furadeira de bancada"
            className={inputClass}
          />
        </Campo>

        <Campo label="Empresa" htmlFor="empresa">
          <select
            id="empresa"
            value={idEmpresa}
            onChange={(e) => setIdEmpresa(e.target.value)}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Patrimônio interno Chabra</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Marca" htmlFor="marca">
          <input
            id="marca"
            type="text"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </Campo>

        <Campo label="Modelo" htmlFor="modelo">
          <input
            id="modelo"
            type="text"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </Campo>

        <Campo label="Nº de série" htmlFor="serie">
          <input
            id="serie"
            type="text"
            value={numeroSerie}
            onChange={(e) => setNumeroSerie(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </Campo>

        <Campo label="Ano de fabricação" htmlFor="ano">
          <input
            id="ano"
            type="number"
            min={1900}
            max={2100}
            value={anoFabricacao}
            onChange={(e) => setAnoFabricacao(e.target.value)}
            disabled={disabled}
            placeholder="Ex: 2018"
            className={inputClass}
          />
        </Campo>

        <Campo label="Nº de patrimônio" htmlFor="patrimonio">
          <input
            id="patrimonio"
            type="text"
            value={numeroPatrimonio}
            onChange={(e) => setNumeroPatrimonio(e.target.value)}
            disabled={disabled}
            placeholder="Código interno"
            className={inputClass}
          />
        </Campo>

        <Campo label="Localização" htmlFor="local">
          <input
            id="local"
            type="text"
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            disabled={disabled}
            placeholder="Ex: Galpão A, Sala 3"
            className={inputClass}
          />
        </Campo>

        <Campo label="Status" htmlFor="status">
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusMaquina)}
            disabled={disabled}
            className={inputClass}
          >
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>
                {STATUS_MAQUINA_LABELS[s]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Observações" htmlFor="obs">
        <textarea
          id="obs"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          disabled={disabled}
          placeholder="Histórico, defeitos conhecidos, manutenções pendentes..."
          className={inputClass}
        />
      </Campo>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || salvando || uploading}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {salvando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}
