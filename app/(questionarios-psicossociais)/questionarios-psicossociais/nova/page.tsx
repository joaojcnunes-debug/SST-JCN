"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useQpsTipos, useCreateQpsAplicacao } from "@/lib/hooks/useQuestionarios";
import { useUserStore } from "@/lib/store";

interface Form {
  id_empresa: string;
  id_tipo: string;
  titulo: string;
  responsavel: string;
  periodo_inicio: string;
  periodo_fim: string;
}

const empty: Form = {
  id_empresa: "",
  id_tipo: "",
  titulo: "",
  responsavel: "",
  periodo_inicio: "",
  periodo_fim: "",
};

export default function NovaAplicacaoPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const [form, setForm] = useState<Form>(empty);

  const { data: empresas = [], isLoading: loadingEmpresas } = useEmpresas();
  const { data: tipos = [], isLoading: loadingTipos } = useQpsTipos();
  const criar = useCreateQpsAplicacao();

  function setF(key: keyof Form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id_empresa || !form.id_tipo || !form.titulo.trim()) {
      toast.error("Preencha empresa, tipo e título");
      return;
    }
    try {
      const nova = await criar.mutateAsync({
        id_empresa: form.id_empresa,
        id_tipo: form.id_tipo,
        titulo: form.titulo.trim(),
        responsavel: form.responsavel.trim() || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
      });
      toast.success("Aplicação criada com sucesso");
      router.push(`/questionarios-psicossociais/${nova.id_aplicacao}`);
    } catch {
      toast.error("Erro ao criar aplicação");
    }
  }

  const tiposSelecionado = tipos.find((t) => t.id_tipo === form.id_tipo);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/questionarios-psicossociais"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookOpen className="size-5 text-indigo-600" /> Nova Aplicação
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Preencha os dados para iniciar uma nova aplicação de questionário psicossocial.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Empresa */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Empresa <span className="text-red-500">*</span>
            </label>
            {loadingEmpresas ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <select
                value={form.id_empresa}
                onChange={(e) => setF("id_empresa", e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione a empresa</option>
                {empresas.map((e) => (
                  <option key={e.id_empresa} value={e.id_empresa}>
                    {e.nome_empresa}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tipo de questionário */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tipo de Questionário <span className="text-red-500">*</span>
            </label>
            {loadingTipos ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            ) : tipos.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Nenhum tipo cadastrado.{" "}
                <Link
                  href="/questionarios-psicossociais/tipos"
                  className="font-semibold underline"
                >
                  Cadastre um tipo primeiro.
                </Link>
              </div>
            ) : (
              <select
                value={form.id_tipo}
                onChange={(e) => setF("id_tipo", e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione o tipo</option>
                {tipos
                  .filter((t) => t.ativo)
                  .map((t) => (
                    <option key={t.id_tipo} value={t.id_tipo}>
                      {t.nome}
                    </option>
                  ))}
              </select>
            )}
            {tiposSelecionado?.descricao && (
              <p className="mt-1.5 text-xs text-gray-500">{tiposSelecionado.descricao}</p>
            )}
          </div>

          {/* Título */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Título da Aplicação <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setF("titulo", e.target.value)}
              required
              placeholder="Ex: DRPS 2025 – Unidade Centro"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Responsável
            </label>
            <input
              type="text"
              value={form.responsavel}
              onChange={(e) => setF("responsavel", e.target.value)}
              placeholder="Nome do técnico"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Período inicio */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Início do Período
            </label>
            <input
              type="date"
              value={form.periodo_inicio}
              onChange={(e) => setF("periodo_inicio", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Período fim */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Fim do Período
            </label>
            <input
              type="date"
              value={form.periodo_fim}
              onChange={(e) => setF("periodo_fim", e.target.value)}
              min={form.periodo_inicio || undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Link
            href="/questionarios-psicossociais"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar Aplicação
          </button>
        </div>
      </form>
    </div>
  );
}
