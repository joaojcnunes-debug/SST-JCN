"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cog, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCriarApreciacaoMaquina } from "@/lib/hooks/useApreciacoesMaquinas";
import { useImportarInspecaoParaLaudo } from "@/lib/hooks/useFichasMaquina";
import { useRequireCreate } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { formatCNPJ } from "@/lib/utils";

export default function NovaApreciacaoPage() {
  useRequireCreate("/apreciacao-maquinas");
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { data: empresas = [] } = useEmpresas();
  const criar = useCriarApreciacaoMaquina();
  const importar = useImportarInspecaoParaLaudo();

  const [idEmpresa, setIdEmpresa] = useState("");
  const [responsavel, setResponsavel] = useState(user?.nome ?? "");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [notificacaoSit, setNotificacaoSit] = useState("");
  const [dataApreciacao, setDataApreciacao] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const empresaSelecionada = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;
  const ocupado = criar.isPending || importar.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idEmpresa) {
      toast.error("Selecione a empresa.");
      return;
    }
    try {
      const row = await criar.mutateAsync({
        id_empresa: idEmpresa,
        id_maquina: null,
        maquina_descricao: null,
        titulo: null,
        setor: null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: null,
        data_apreciacao: dataApreciacao || null,
        notificacao_sit: notificacaoSit.trim() || null,
      });
      // Auto-importa as máquinas da inspeção da empresa (por setor + operadores + fotos).
      const n = await importar.mutateAsync({
        idApreciacao: row.id_apreciacao,
        idEmpresa: idEmpresa,
      });
      toast.success(
        n > 0
          ? `Laudo criado — ${n} máquina${n > 1 ? "s" : ""} importada${n > 1 ? "s" : ""} da inspeção.`
          : "Laudo criado — adicione as máquinas no editor."
      );
      router.push(`/apreciacao-maquinas/${row.id_apreciacao}`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao criar a apreciação");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/apreciacao-maquinas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Cog className="size-5 text-orange-600" />
          Nova apreciação NR-12
        </h1>
        <p className="text-sm text-gray-600">
          Selecione a empresa. As <strong>máquinas cadastradas na inspeção</strong>{" "}
          são importadas automaticamente, <strong>agrupadas por setor</strong>, com
          operadores, fotos e checklist NR-12 — prontas para avaliação. Setor e
          cidade vêm da identificação da empresa; o título é sempre “Apreciação de
          Máquinas NR-12”.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm reveal-up"
      >
        <Campo label="Empresa *" htmlFor="empresa">
          <select
            id="empresa"
            value={idEmpresa}
            onChange={(e) => setIdEmpresa(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
                {e.cnpj ? ` — ${formatCNPJ(e.cnpj)}` : ""}
              </option>
            ))}
          </select>
          {empresaSelecionada?.cnpj && (
            <p className="mt-1 text-xs text-gray-500">
              CNPJ {formatCNPJ(empresaSelecionada.cnpj)}
            </p>
          )}
        </Campo>

        <Campo label="Notificação SIT/MTE (opcional)" htmlFor="notif">
          <input
            id="notif"
            type="text"
            value={notificacaoSit}
            onChange={(e) => setNotificacaoSit(e.target.value)}
            placeholder="Ex: RMBHIUV2OAHH6O — itens 10, 11 e 13"
            className={inputClass}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Responsável técnico (JCN Consultoria)" htmlFor="resp">
            <ProfissionalSelect
              value={responsavel}
              onChange={(nome) => setResponsavel(nome)}
            />
          </Campo>
          <Campo label="Responsável da empresa" htmlFor="respe">
            <input
              id="respe"
              type="text"
              value={responsavelEmpresa}
              onChange={(e) => setResponsavelEmpresa(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Data da apreciação" htmlFor="data">
            <input
              id="data"
              type="date"
              value={dataApreciacao}
              onChange={(e) => setDataApreciacao(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {ocupado && <Loader2 className="size-4 animate-spin" />}
            {importar.isPending ? "Importando máquinas…" : "Criar apreciação"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

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
