"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useAepRelatorio, useSalvarAep } from "@/lib/hooks/useAep";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { detectRegistroTipo } from "@/lib/registro-profissional";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import type { StatusAEP } from "@/lib/supabase/types";

export default function AepDadosPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const router = useRouter();
  const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
  const salvar  = useSalvarAep();
  const canEdit = useCanEdit();

  const [responsavel, setResponsavel] = useState("");
  const [titulo,      setTitulo]      = useState("");
  const [registro,    setRegistro]    = useState("");
  const [data,        setData]        = useState("");
  const [validade,    setValidade]    = useState("");
  const [endereco,    setEndereco]    = useState("");
  const [conclusao,   setConclusao]   = useState("");
  const [status,      setStatus]      = useState<StatusAEP>("RASCUNHO");

  useEffect(() => {
    if (!rel) return;
    setResponsavel(rel.responsavel_elaboracao ?? "");
    setTitulo(rel.titulo_profissional     ?? "");
    setRegistro(rel.registro_profissional ?? "");
    setData(rel.data_elaboracao           ?? "");
    setValidade(rel.data_validade         ?? "");
    setEndereco(rel.endereco_empresa      ?? "");
    setConclusao(rel.conclusao            ?? "");
    setStatus(rel.status);
  }, [rel]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await salvar.mutateAsync({
        id: idRelatorio,
        responsavel_elaboracao: responsavel.trim(),
        titulo_profissional:    titulo.trim(),
        registro_profissional:  registro.trim(),
        data_elaboracao:        data || null,
        data_validade:          validade || null,
        endereco_empresa:       endereco.trim() || null,
        conclusao:              conclusao.trim(),
        status,
      });
    } catch {
      // erro já tratado pelo hook
    }
  }

  const empresa = rel?.empresas as { nome_empresa?: string; cnpj?: string | null } | null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/aep")}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="size-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dados da Análise</h1>
          <p className="text-sm text-gray-500">{empresa?.nome_empresa ?? "—"}</p>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

        {/* Empresa (read-only) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
          <input
            type="text"
            readOnly
            value={empresa?.nome_empresa ?? "—"}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-default"
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <div className="flex gap-2">
            {(["RASCUNHO", "CONCLUIDO"] as StatusAEP[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canEdit}
                onClick={() => setStatus(s)}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition",
                  status === s
                    ? s === "CONCLUIDO"
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-yellow-400 bg-yellow-50 text-yellow-800"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50",
                ].join(" ")}
              >
                {s === "RASCUNHO" ? "Rascunho" : "Concluído"}
              </button>
            ))}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Responsável pela elaboração</label>
          <ProfissionalSelect
            value={responsavel}
            onChange={(nome, cargo, _cert, regValue) => {
              setResponsavel(nome);
              setTitulo(cargo ?? "");
              if (regValue) setRegistro(regValue);
            }}
            onMatchFound={({ cargo, registro }) => {
              setTitulo((prev) => prev || cargo || "");
              setRegistro((prev) => prev || registro || "");
            }}
            className={!canEdit ? "pointer-events-none opacity-60" : ""}
          />
        </div>

        {/* Título + Registro */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Título profissional</label>
            <input
              type="text"
              value={titulo}
              disabled={!canEdit}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Eng. de Segurança"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{detectRegistroTipo(titulo).label}</label>
            <input
              type="text"
              value={registro}
              disabled={!canEdit}
              onChange={(e) => setRegistro(e.target.value)}
              placeholder={detectRegistroTipo(titulo).placeholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
            />
          </div>
        </div>

        {/* Data */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Data de elaboração</label>
          <input
            type="date"
            value={data}
            disabled={!canEdit}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        </div>

        {/* Validade do documento */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Validade do documento</label>
          <input
            type="date"
            value={validade}
            disabled={!canEdit}
            onChange={(e) => setValidade(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        </div>

        {/* Endereço */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Endereço da empresa</label>
          <input
            type="text"
            value={endereco}
            disabled={!canEdit}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, nº, bairro — cidade/UF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        </div>

        {/* Considerações finais */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Considerações finais</label>
          <p className="mb-1.5 text-xs text-gray-500">
            Texto livre que aparece no laudo após a análise dos setores.
          </p>
          <textarea
            value={conclusao}
            disabled={!canEdit}
            onChange={(e) => setConclusao(e.target.value)}
            rows={5}
            placeholder="Conclusões gerais, encaminhamentos, observações..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
          />
        </div>

        {canEdit && (
          <button
            type="submit"
            disabled={salvar.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvar.isPending
              ? <><Loader2 className="size-4 animate-spin" /> Salvando…</>
              : <><Save className="size-4" /> Salvar alterações</>
            }
          </button>
        )}
      </form>
    </div>
  );
}
