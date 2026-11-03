"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_AET_IDENTIFICACAO } from "@/lib/dicas/aet";
import BotaoHistoricoDocumento from "@/components/auditoria/BotaoHistoricoDocumento";
import { EditorSkeleton } from "@/components/ui/PageSkeletons";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useAetRelatorio, useSalvarAet } from "@/lib/hooks/useAet";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { mesmoNome } from "@/lib/registro-profissional";
import { LevarParaCampo } from "@/components/ui/LevarParaCampo";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import Link from "next/link";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetDadosPage({ idRelatorio }: { idRelatorio: string }) {
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const { data: empresa } = useEmpresa(rel?.id_empresa ?? null);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();

  if (isLoading) return <EditorSkeleton />;

  function salvarCaracterizacao(patch: {
    responsavel_elaboracao: string;
    titulo_profissional: string;
    registro_profissional: string;
    data_elaboracao: string;
    data_validade: string;
    status: "RASCUNHO" | "CONCLUIDO";
  }) {
    salvar.mutate(
      // data_validade é coluna `date`: "" → null.
      { id: idRelatorio, patch: { ...patch, data_validade: patch.data_validade || null } },
      {
        onSuccess: () => toast.success("Dados salvos"),
        onError: (e: Error) => toast.error(mensagemErro(e)),
      }
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Dados Gerais</h1>
        <BotaoHistoricoDocumento docTabela="aet_relatorios" docId={idRelatorio} />
      </div>

      {/* Levar para o campo — esta é a tela de entrada do laudo (a raiz
          redireciona para cá), então é aqui que a decisão de copiar para o
          aparelho tem que caber. A coleta acontece na aba Setores, já sem
          sinal. */}
      <LevarParaCampo idDocumento={idRelatorio} dados={rel} rotulo="AET" />

      {/* Seção 1 – Caracterização */}
      <CaracterizacaoCard
        rel={rel}
        empresa={empresa}
        canEdit={canEdit}
        salvando={salvar.isPending}
        onSalvar={salvarCaracterizacao}
      />

      {/* As Seções 2–12 ficavam aqui, mas o laudo e o PDF montam esses capítulos a partir do
          Texto padrão da AET: o que se editava aqui nunca chegava ao documento (removido em 0.3.215). */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Os textos das demais seções do laudo (introdução, objetivo, metodologia e as outras) são
        editados em{" "}
        <Link href="/aet/texto-padrao" className="font-semibold underline">
          Texto padrão da AET
        </Link>
        {" "}e valem para todos os laudos.
      </div>
    </div>
  );
}

// ─── Card Caracterização ──────────────────────────────────────────────────────

function CaracterizacaoCard({
  rel,
  empresa,
  canEdit,
  salvando,
  onSalvar,
}: {
  rel: import("@/lib/supabase/types").AetRelatorio | undefined;
  empresa: { nome_empresa: string; cnpj: string | null } | null | undefined;
  canEdit: boolean;
  salvando: boolean;
  onSalvar: (patch: {
    responsavel_elaboracao: string;
    titulo_profissional: string;
    registro_profissional: string;
    data_elaboracao: string;
    data_validade: string;
    status: "RASCUNHO" | "CONCLUIDO";
  }) => void;
}) {
  const [form, setForm] = useState({
    responsavel_elaboracao: rel?.responsavel_elaboracao ?? "",
    titulo_profissional: rel?.titulo_profissional ?? "",
    registro_profissional: rel?.registro_profissional ?? "",
    data_elaboracao: rel?.data_elaboracao ?? "",
    data_validade: rel?.data_validade ?? "",
    status: (rel?.status ?? "RASCUNHO") as "RASCUNHO" | "CONCLUIDO",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!rel) return;
    setForm({
      responsavel_elaboracao: rel.responsavel_elaboracao,
      titulo_profissional: rel.titulo_profissional,
      registro_profissional: rel.registro_profissional,
      data_elaboracao: rel.data_elaboracao ?? "",
      data_validade: rel.data_validade ?? "",
      status: rel.status,
    });
    setDirty(false);
  }, [rel?.id_relatorio]);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          1 – Caracterização da Empresa
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => { onSalvar(form); setDirty(false); }}
            disabled={!dirty || salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-2 text-xs font-semibold text-white hover:bg-marca-accent disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        )}
      </div>

      {/* Bloco Configuração */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Configuração
        </p>

        {/* Campos somente-leitura */}
        <div className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <ReadRow label="Razão Social" value={empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"} />
          <ReadRow label="CNPJ" value={empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"} />
        </div>

        {/* Campos editáveis */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <Dica texto={DICAS_AET_IDENTIFICACAO.responsavel}>Responsável pela Elaboração</Dica>
            </label>
            <ProfissionalSelect
              value={form.responsavel_elaboracao}
              onChange={(nome, cargo, _cert, regValue) => {
                set("responsavel_elaboracao", nome);
                set("titulo_profissional", cargo ?? "");
                if (regValue) set("registro_profissional", regValue);
              }}
              // Laudo ANTIGO: nasceu antes do preenchimento automático e ficou
              // sem registro. Aqui a gente só SUGERE — em campo vazio, nunca
              // sobrescrevendo — e nada vai para o banco sem clicar em Salvar.
              // Ver mesmoNome(): o match do select é difuso e não serve para
              // decidir de quem é o registro.
              onMatchFound={({ nome, cargo, registro }) => {
                // Visualizador não salva: mostrar valor que não está no laudo
                // seria mentir sobre o documento.
                if (!canEdit) return;
                if (!mesmoNome(nome, form.responsavel_elaboracao)) return;
                const titulo = form.titulo_profissional || cargo || "";
                const reg = form.registro_profissional || registro || "";
                if (titulo === form.titulo_profissional && reg === form.registro_profissional) return;
                setForm((f) => ({ ...f, titulo_profissional: titulo, registro_profissional: reg }));
                setDirty(true);
              }}
              className={!canEdit ? "pointer-events-none opacity-60" : ""}
            />
          </div>
          <InputField
            label="Título Profissional"
            dica={DICAS_AET_IDENTIFICACAO.titulo}
            value={form.titulo_profissional}
            disabled={!canEdit}
            onChange={(v) => set("titulo_profissional", v)}
          />
          <InputField
            label="Registro Profissional"
            dica={DICAS_AET_IDENTIFICACAO.registro}
            value={form.registro_profissional}
            disabled={!canEdit}
            onChange={(v) => set("registro_profissional", v)}
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <Dica texto={DICAS_AET_IDENTIFICACAO.data_elaboracao}>Data de Elaboração</Dica>
            </label>
            <input
              type="date"
              value={form.data_elaboracao}
              disabled={!canEdit}
              onChange={(e) => set("data_elaboracao", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <Dica texto={DICAS_AET_IDENTIFICACAO.validade}>Validade do Documento</Dica>
            </label>
            <input
              type="date"
              value={form.data_validade}
              disabled={!canEdit}
              onChange={(e) => set("data_validade", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <Dica texto={DICAS_AET_IDENTIFICACAO.status}>Status</Dica>
            </label>
            <select
              value={form.status}
              disabled={!canEdit}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-100"
            >
              <option value="RASCUNHO">Rascunho</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pré-visualização */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Pré-visualização — como aparece no laudo
        </p>
        {/* Mesmo container do laudo/page.tsx */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">

          {/* Cabeçalho — igual ao laudo */}
          <div className="mb-8 flex items-start justify-between border-b pb-4">
            <div className="text-xs text-gray-500">JCN Consultoria Saúde e Segurança do Trabalho</div>
          </div>

          {/* Capa — igual ao laudo */}
          <div className="mb-10 space-y-3 text-center">
            <p className="text-sm font-bold">LAUDO DE AVALIAÇÃO ERGONÔMICA</p>
            <p className="text-sm font-bold">AET – ANÁLISE ERGONÔMICA DO TRABALHO</p>
            <p className="text-xs text-gray-600">Portaria 3.214/78 - Norma Regulamentadora - 17</p>
            <div className="mt-6 space-y-1 text-sm">
              <p><strong>EMPRESA:</strong> {empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"}</p>
              <p><strong>CNPJ:</strong> {empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"}</p>
              <p><strong>DATA:</strong> {form.data_elaboracao ? new Date(form.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>

          {/* 1 – Caracterização — igual ao laudo */}
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase text-gray-800">
              1 – CARACTERIZAÇÃO DA EMPRESA AVALIADA
            </h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {(
                  [
                    ["Razão Social", empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"],
                    ["CNPJ", empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"],
                    ["Responsável pela Elaboração", form.responsavel_elaboracao || "—"],
                    ["Título Profissional", form.titulo_profissional || "—"],
                    ["Registro Profissional", form.registro_profissional || "—"],
                    ["Data da elaboração", form.data_elaboracao ? new Date(form.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <tr key={k} className="border border-gray-300">
                    <td className="w-48 bg-gray-50 px-2 py-1 font-semibold">{k}:</td>
                    <td className="px-2 py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Assinatura — igual ao laudo */}
          <div className="mt-10 space-y-2 text-center text-xs text-gray-600">
            <div className="mt-6 flex justify-center">
              <div className="text-center">
                <div className="mx-auto mb-1 w-56 border-t border-gray-400" />
                <p>Assinatura do responsável da Empresa</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="font-semibold">{form.responsavel_elaboracao || "—"}</p>
              {form.titulo_profissional && <p>{form.titulo_profissional}</p>}
              {form.registro_profissional && <p>Registro: {form.registro_profissional}</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-medium text-gray-500">{label}:</span>
      <span className="text-gray-900">{value || "—"}</span>
    </div>
  );
}

function InputField({
  label,
  dica,
  value,
  disabled,
  onChange,
}: {
  label: string;
  /** Dica de preenchimento (lib/dicas/aet.ts). */
  dica?: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {dica ? <Dica texto={dica}>{label}</Dica> : label}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-100"
      />
    </div>
  );
}
