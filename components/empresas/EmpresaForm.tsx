"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import {
  type Empresa,
  type ModuloEmpresa,
  MODULOS_EMPRESA,
} from "@/lib/supabase/types";
import { useUnidades } from "@/lib/hooks/useUnidades";

// Toda empresa é habilitada em todos os quadros (filtro por módulo removido).
const TODOS_MODULOS: ModuloEmpresa[] = MODULOS_EMPRESA.map((m) => m.value);

/** Aplica a máscara 00.000.000/0000-00 conforme o usuário digita/cola (só dígitos, máx. 14). */
function formatarCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "." + d.slice(2, 5);
  if (d.length > 5) out += "." + d.slice(5, 8);
  if (d.length > 8) out += "/" + d.slice(8, 12);
  if (d.length > 12) out += "-" + d.slice(12, 14);
  return out;
}

interface Props {
  open: boolean;
  onClose: () => void;
  empresa?: Empresa | null;
  /** Chamado apos criar (não edição), recebe o id_empresa novo. */
  onCreated?: (idEmpresa: string) => void;
}

export default function EmpresaForm({
  open,
  onClose,
  empresa,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!empresa;
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const { data: unidades = [] } = useUnidades();

  const [form, setForm] = useState({
    nome_empresa: "",
    razao_social: "",
    cnpj: "",
    cpf: "",
    cei: "",
    caepf: "",
    cno: "",
    id_unidade: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
    telefone: "",
    email: "",
    cnae_principal: "",
    cnae_descricao: "",
    situacao_cadastral: "",
    porte: "",
    status: "Ativo" as "Ativo" | "Inativa",
    observacao: "",
    modulos_habilitados: [...TODOS_MODULOS] as ModuloEmpresa[],
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome_empresa: empresa?.nome_empresa ?? "",
        razao_social: empresa?.razao_social ?? "",
        cnpj: empresa?.cnpj ? formatarCnpj(empresa.cnpj) : "",
        cpf: empresa?.cpf ?? "",
        cei: empresa?.cei ?? "",
        caepf: empresa?.caepf ?? "",
        cno: empresa?.cno ?? "",
        id_unidade: empresa?.id_unidade ?? "",
        logradouro: empresa?.logradouro ?? "",
        numero: empresa?.numero ?? "",
        complemento: empresa?.complemento ?? "",
        bairro: empresa?.bairro ?? "",
        municipio: empresa?.municipio ?? "",
        uf: empresa?.uf ?? "",
        cep: empresa?.cep ?? "",
        telefone: empresa?.telefone ?? "",
        email: empresa?.email ?? "",
        cnae_principal: empresa?.cnae_principal ?? "",
        cnae_descricao: empresa?.cnae_descricao ?? "",
        situacao_cadastral: empresa?.situacao_cadastral ?? "",
        porte: empresa?.porte ?? "",
        status: (empresa?.status as "Ativo" | "Inativa") ?? "Ativo",
        observacao: empresa?.observacao ?? "",
        modulos_habilitados: [...TODOS_MODULOS],
      });
    }
  }, [open, empresa]);

  /**
   * Busca os dados da empresa na base da Receita Federal (via BrasilAPI,
   * dados públicos) e preenche os campos estruturados (razão social, nome
   * fantasia, endereço, contato, CNAE, situação, porte). Capital social não
   * é trazido. Nada é salvo aqui — o usuário revisa e confirma.
   */
  async function buscarCnpj() {
    const digitos = form.cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos para buscar.");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const res = await fetch(`/api/cnpj/${digitos}`);
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 404) throw new Error("CNPJ não encontrado na Receita.");
      if (!res.ok)
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            `Falha na consulta (HTTP ${res.status}).`,
        );

      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const razao = str(d.razao_social);
      const fantasia = str(d.nome_fantasia);
      const cepDig = str(d.cep).replace(/\D/g, "");
      const cepFmt = cepDig.length === 8 ? `${cepDig.slice(0, 5)}-${cepDig.slice(5)}` : str(d.cep);
      const cnaeCod =
        d.cnae_fiscal != null && d.cnae_fiscal !== "" ? String(d.cnae_fiscal) : "";

      // Mantém o que já houver preenchido como fallback (?? f.campo).
      setForm((f) => ({
        ...f,
        razao_social: razao || f.razao_social,
        nome_empresa: f.nome_empresa.trim() || fantasia || razao || f.nome_empresa,
        logradouro: str(d.logradouro) || f.logradouro,
        numero: str(d.numero) || f.numero,
        complemento: str(d.complemento) || f.complemento,
        bairro: str(d.bairro) || f.bairro,
        municipio: str(d.municipio) || f.municipio,
        uf: str(d.uf) || f.uf,
        cep: cepFmt || f.cep,
        telefone: str(d.ddd_telefone_1) || f.telefone,
        email: str(d.email) || f.email,
        cnae_principal: cnaeCod || f.cnae_principal,
        cnae_descricao: str(d.cnae_fiscal_descricao) || f.cnae_descricao,
        situacao_cadastral: str(d.descricao_situacao_cadastral) || f.situacao_cadastral,
        porte: str(d.porte) || f.porte,
      }));
      toast.success("Dados da Receita carregados — revise e salve.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao consultar o CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  }


  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        nome_empresa: form.nome_empresa.trim(),
        razao_social: form.razao_social.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        cpf: form.cpf.replace(/\D/g, "") || null,
        cei: form.cei.replace(/\D/g, "") || null,
        caepf: form.caepf.replace(/\D/g, "") || null,
        cno: form.cno.replace(/\D/g, "") || null,
        id_unidade: form.id_unidade || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        cep: form.cep.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        cnae_principal: form.cnae_principal.trim() || null,
        cnae_descricao: form.cnae_descricao.trim() || null,
        situacao_cadastral: form.situacao_cadastral.trim() || null,
        porte: form.porte.trim() || null,
        status: form.status,
        observacao: form.observacao.trim() || null,
        modulos_habilitados: form.modulos_habilitados,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && empresa) {
        const { error } = await supabase
          .from("empresas")
          .update(payload as never)
          .eq("id_empresa", empresa.id_empresa);
        if (error) throw error;
        return null;
      } else {
        const id = gerarId("EMP");
        const insertRow = {
          id_empresa: id,
          ...payload,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("empresas")
          .insert(insertRow as never);
        if (error) throw error;
        return id;
      }
    },
    onSuccess: (novoId) => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success(isEdit ? "Empresa atualizada" : "Empresa criada");
      if (!isEdit && novoId && onCreated) onCreated(novoId);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao salvar empresa");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome_empresa.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.id_unidade) {
      toast.error("Selecione a unidade da empresa");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Empresa" : "Nova Empresa"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Nome *</label>
          <input
            type="text"
            value={form.nome_empresa}
            onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">CNPJ</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarCnpj();
                  }
                }}
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
              <button
                type="button"
                onClick={buscarCnpj}
                disabled={buscandoCnpj}
                title="Buscar dados da empresa na Receita Federal pelo CNPJ"
                className="shrink-0 rounded-md bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
              >
                {buscandoCnpj ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Razão Social</label>
            <input
              type="text"
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Identificadores alternativos (opcionais)
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-700">CPF</label>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CEI</label>
              <input
                type="text"
                value={form.cei}
                onChange={(e) => setForm({ ...form, cei: e.target.value })}
                placeholder="00.000.00000/00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CAEPF</label>
              <input
                type="text"
                value={form.caepf}
                onChange={(e) => setForm({ ...form, caepf: e.target.value })}
                placeholder="000.000.000/000-00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CNO</label>
              <input
                type="text"
                value={form.cno}
                onChange={(e) => setForm({ ...form, cno: e.target.value })}
                placeholder="00.000.00000/00"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Unidade — controla quais usuários enxergam esta empresa (obrigatória) */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Unidade <span className="text-red-500">*</span>
          </label>
          <select
            value={form.id_unidade}
            onChange={(e) => setForm({ ...form, id_unidade: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="" disabled>
              Selecione a unidade…
            </option>
            {unidades.map((u) => (
              <option key={u.id_unidade} value={u.id_unidade}>
                {u.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Só usuários com esta unidade (e Admins) verão a empresa.
          </p>
          {unidades.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Nenhuma unidade cadastrada. Cadastre em Configurações → Unidades antes.
            </p>
          )}
        </div>

        {/* Endereço e contato — preenchidos pela busca por CNPJ, editáveis */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Endereço e contato
          </p>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-4">
              <label className="text-xs font-medium text-gray-700">Logradouro</label>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Número</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CEP</label>
              <input
                type="text"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                placeholder="00000-000"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-700">Complemento</label>
              <input
                type="text"
                value={form.complemento}
                onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-700">Bairro</label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-gray-700">Município</label>
              <input
                type="text"
                value={form.municipio}
                onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-gray-700">UF</label>
              <input
                type="text"
                maxLength={2}
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-700">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-700">E-mail</label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Dados cadastrais da Receita */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Atividade e situação (Receita)
          </p>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-gray-700">CNAE</label>
              <input
                type="text"
                value={form.cnae_principal}
                onChange={(e) => setForm({ ...form, cnae_principal: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-5">
              <label className="text-xs font-medium text-gray-700">Atividade principal</label>
              <input
                type="text"
                value={form.cnae_descricao}
                onChange={(e) => setForm({ ...form, cnae_descricao: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-700">Situação cadastral</label>
              <input
                type="text"
                value={form.situacao_cadastral}
                onChange={(e) => setForm({ ...form, situacao_cadastral: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-700">Porte</label>
              <input
                type="text"
                value={form.porte}
                onChange={(e) => setForm({ ...form, porte: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as "Ativo" | "Inativa" })
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="Ativo">Ativo</option>
            <option value="Inativa">Inativa</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Observação</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>

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
            disabled={mutation.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
