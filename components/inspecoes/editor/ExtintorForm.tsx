"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { Extintor, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  editing: Extintor | null;
  setores: Setor[];
}

const TIPOS_AGENTE = [
  "Pó Químico Seco ABC",
  "Pó Químico Seco BC",
  "CO₂ (Dióxido de Carbono)",
  "Água Pressurizada",
  "Espuma Mecânica",
  "Pó Específico para Metais (D)",
];

const CAPACIDADES = [
  "1 kg", "2 kg", "4 kg", "6 kg", "9 kg", "12 kg",
  "2 L", "5 L", "9 L", "10 L", "12 L",
];

const STATUS_OPCOES = [
  "Adequado",
  "Vencido",
  "A vencer (próx. 3 meses)",
  "Danificado",
  "Sinalização inadequada",
  "Lacre violado",
];

export default function ExtintorForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  editing,
  setores,
}: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [idSetor, setIdSetor] = useState<string>("");
  const [tipoAgente, setTipoAgente] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [numeroIdentificacao, setNumeroIdentificacao] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [status, setStatus] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ordem, setOrdem] = useState(99);

  // Foto: arquivo novo (File) ou URL existente já salva no DB
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIdSetor(editing?.id_setor ?? "");
    setTipoAgente(editing?.tipo_agente ?? "");
    setCapacidade(editing?.capacidade ?? "");
    setNumeroIdentificacao(editing?.numero_identificacao ?? "");
    setLocalizacao(editing?.localizacao ?? "");
    setDataValidade(editing?.data_validade ?? "");
    setStatus(editing?.status ?? "");
    setObservacoes(editing?.observacoes ?? "");
    setOrdem(editing?.ordem ?? 99);
    setFotoFile(null);
    setFotoPreview(editing?.foto_url ?? null);
    setProgress(0);
  }, [open, editing]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFotoFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setFotoPreview(url);
    }
  }

  function removerFoto() {
    setFotoFile(null);
    setFotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!tipoAgente.trim()) throw new Error("Tipo de agente é obrigatório");

      const supabase = createSupabaseBrowserClient();
      const idExtintor = editing?.id_extintor ?? gerarId("EXT");

      let fotoUrl: string | null = editing?.foto_url ?? null;
      let fotoStoragePath: string | null = editing?.foto_storage_path ?? null;

      // Se removeu a foto (preview null) e havia uma antes
      const removeu = !fotoPreview && !!editing?.foto_url;

      if (fotoFile) {
        // Upload novo arquivo
        const ext = fotoFile.name.split(".").pop() ?? "jpg";
        const path = `extintores/${idEmpresa}/${idInspecao}/${idExtintor}.${ext}`;

        // Apaga arquivo anterior se existia em path diferente
        if (editing?.foto_storage_path && editing.foto_storage_path !== path) {
          await supabase.storage.from("fotos").remove([editing.foto_storage_path]);
        }

        setProgress(20);
        const { error: upErr } = await supabase.storage
          .from("fotos")
          .upload(path, fotoFile, { upsert: true });
        if (upErr) throw upErr;
        setProgress(70);

        const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
        fotoUrl = pub.publicUrl;
        fotoStoragePath = path;
      } else if (removeu) {
        // Usuário clicou em "remover" sem nova foto
        if (editing?.foto_storage_path) {
          await supabase.storage.from("fotos").remove([editing.foto_storage_path]);
        }
        fotoUrl = null;
        fotoStoragePath = null;
      }

      const payload = {
        id_extintor: idExtintor,
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        id_setor: idSetor || null,
        tipo_agente: tipoAgente.trim(),
        capacidade: capacidade.trim() || null,
        numero_identificacao: numeroIdentificacao.trim() || null,
        localizacao: localizacao.trim() || null,
        data_validade: dataValidade || null,
        status: status.trim() || null,
        observacoes: observacoes.trim() || null,
        foto_url: fotoUrl,
        foto_storage_path: fotoStoragePath,
        ordem,
        ativo: editing?.ativo ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("extintores")
        .upsert(payload as never, { onConflict: "id_extintor" });
      if (error) throw error;
      setProgress(100);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(editing ? "Extintor atualizado" : "Extintor cadastrado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Extintor" : "Novo Extintor"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Setor */}
        <div>
          <label className={lblCls}>Setor</label>
          <select
            value={idSetor}
            onChange={(e) => setIdSetor(e.target.value)}
            className={inputCls}
          >
            <option value="">— Geral / sem setor específico —</option>
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.setor_ghe}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo + Capacidade */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo de agente extintor *</label>
            <input
              type="text"
              list="tipos-agente"
              value={tipoAgente}
              onChange={(e) => setTipoAgente(e.target.value)}
              required
              placeholder="Ex: Pó Químico Seco ABC"
              className={inputCls}
            />
            <datalist id="tipos-agente">
              {TIPOS_AGENTE.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className={lblCls}>Capacidade</label>
            <input
              type="text"
              list="capacidades"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              placeholder="Ex: 4 kg, 9 L"
              className={inputCls}
            />
            <datalist id="capacidades">
              {CAPACIDADES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {/* Nº identificação + Localização */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Nº de identificação / Patrimônio</label>
            <input
              type="text"
              value={numeroIdentificacao}
              onChange={(e) => setNumeroIdentificacao(e.target.value)}
              placeholder="Ex: EXT-001"
              className={inputCls}
            />
          </div>
          <div>
            <label className={lblCls}>Localização no setor</label>
            <input
              type="text"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: Próximo à saída de emergência"
              className={inputCls}
            />
          </div>
        </div>

        {/* Validade + Status + Ordem */}
        <div className="grid gap-3 md:grid-cols-[160px_1fr_100px]">
          <div>
            <label className={lblCls}>Validade do agente</label>
            <input
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={lblCls}>Status</label>
            <input
              type="text"
              list="status-opcoes"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Ex: Adequado"
              className={inputCls}
            />
            <datalist id="status-opcoes">
              {STATUS_OPCOES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={lblCls}>Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className={lblCls}>Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Observações sobre o extintor (opcional)"
            className={inputCls}
          />
        </div>

        {/* Foto */}
        <div>
          <label className={lblCls}>Foto do extintor</label>
          {fotoPreview ? (
            <div className="mt-1 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoPreview}
                alt="Preview"
                className="h-28 w-28 rounded-lg border border-gray-200 object-cover"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ImagePlus className="size-3.5" /> Trocar foto
                </button>
                <button
                  type="button"
                  onClick={removerFoto}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <X className="size-3.5" /> Remover foto
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-6 text-sm text-gray-500 hover:border-verde-primary hover:bg-verde-light hover:text-verde-primary"
            >
              <ImagePlus className="size-5" />
              Clique para adicionar uma foto
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
          {fotoFile && (
            <p className="mt-1 text-xs text-gray-500">
              {fotoFile.name} · {(fotoFile.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        {save.isPending && progress > 0 && progress < 100 && (
          <div>
            <p className="text-xs text-gray-500">Enviando... {progress}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-verde-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
