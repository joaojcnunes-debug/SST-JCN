"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  Lock,
  Trash2,
  Upload,
  X,
  BadgeCheck,
  Users,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import StorageImg from "@/components/ui/StorageImg";
import { detectRegistroTipo } from "@/lib/registro-profissional";
import Badge from "@/components/ui/Badge";
import { TabelaSkeleton } from "@/components/ui/PageSkeletons";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { usePagination } from "@/lib/hooks/usePagination";
import { cn, gerarId } from "@/lib/utils";
import type {
  ModuloPermitido,
  PerfilUsuario,
  Usuario,
} from "@/lib/supabase/types";
import { ROTULO_MODULO, TODOS_MODULOS } from "@/lib/supabase/types";

const PERFIS: PerfilUsuario[] = ["Admin", "Tecnico", "Visualizador", "Cliente"];

/**
 * Defaults granulares por perfil (V45+). Admin sempre tudo; Técnico cria
 * e edita mas não exclui; Visualizador read-only.
 */
function defaultPerm(
  perfil: PerfilUsuario,
  acao: "criar" | "editar" | "excluir"
): boolean {
  if (perfil === "Admin") return true;
  if (perfil === "Tecnico") return acao !== "excluir";
  return false; // Visualizador
}

function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Usuario[];
    },
  });
}

export default function UsuariosPage() {
  const currentUser = useCurrentUser();
  const { data: usuarios = [], isLoading } = useUsuarios();
  const [busca, setBusca] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [confirmDel, setConfirmDel] = useState<Usuario | null>(null);
  const qcGlobal = useQueryClient();

  const excluir = useMutation({
    mutationFn: async (u: Usuario) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc(
        "excluir_usuario_admin" as never,
        { p_email: u.email } as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qcGlobal.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário excluído");
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
  });

  const filtrados = usuarios.filter((u) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      u.nome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.cargo ?? "").toLowerCase().includes(q)
    );
  });

  const pag = usePagination({
    data: filtrados,
    pageSize: 20,
    resetKey: busca,
  });

  const perfilVariant = (p: PerfilUsuario) =>
    p === "Admin" ? "info" : p === "Tecnico" ? "success" : "muted";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
        >
          <Plus className="size-4" />
          Novo Usuário
        </button>
      </div>

      <div className="reveal-up overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <TabelaSkeleton linhas={5} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-verde-light">
              <Users className="size-7 text-verde-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-800">
              {usuarios.length === 0 ? "Nenhum usuário cadastrado" : "Nenhum usuário encontrado"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {usuarios.length === 0 ? "Crie o primeiro usuário do sistema" : "Tente ajustar a busca"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nome</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">E-mail</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cargo</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Perfil</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pag.pageItems.map((u) => (
                  <tr key={u.id_usuario} className="border-b border-gray-50 transition-colors hover:bg-verde-light/25 last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {u.nome}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {u.cargo ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={perfilVariant(u.perfil)}>{u.perfil}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={u.ativo_sistema ? "success" : "muted"}>
                        {u.ativo_sistema ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(u);
                            setFormOpen(true);
                          }}
                          className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-verde-light hover:text-verde-primary"
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <ToggleAtivo usuario={u} />
                        {currentUser?.email !== u.email && (
                          <button
                            type="button"
                            onClick={() => setConfirmDel(u)}
                            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                            title="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pag.showPagination && (
              <Pagination
                page={pag.page}
                totalPages={pag.totalPages}
                totalItems={pag.totalItems}
                pageSize={pag.pageSize}
                onChange={pag.setPage}
              />
            )}
          </div>
        )}
      </div>

      <UsuarioFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        usuario={editing}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir usuário?"
        description={
          confirmDel
            ? `${confirmDel.nome} (${confirmDel.email}) será removido permanentemente do sistema e do Auth. Esta ação não pode ser desfeita.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => confirmDel && excluir.mutate(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

function ToggleAtivo({ usuario }: { usuario: Usuario }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("usuarios")
        .update({ ativo_sistema: !usuario.ativo_sistema } as never)
        .eq("id_usuario", usuario.id_usuario);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      type="button"
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg transition hover:bg-amber-50 disabled:opacity-50",
        usuario.ativo_sistema
          ? "text-gray-400 hover:text-amber-warning"
          : "text-amber-warning"
      )}
      title={usuario.ativo_sistema ? "Desativar" : "Ativar"}
    >
      <Power className="size-4" />
    </button>
  );
}

interface UsuarioFormProps {
  open: boolean;
  onClose: () => void;
  usuario?: Usuario | null;
}

function UsuarioFormModal({ open, onClose, usuario }: UsuarioFormProps) {
  const qc = useQueryClient();
  const isEdit = !!usuario;
  const { data: empresas = [] } = useEmpresas();
  const { data: unidades = [] } = useUnidades();

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    cargo: "",
    perfil: "Tecnico" as PerfilUsuario,
    ativo_sistema: true,
    empresas_vinculadas: [] as string[],
    unidades: [] as string[],
    modulos_permitidos: [...TODOS_MODULOS] as ModuloPermitido[],
    // V45: permissões granulares — Admin contorna estes flags, mas a UI
    // mantém eles marcados pra clareza.
    pode_criar: true,
    pode_editar: true,
    pode_excluir: false,
    // Assinatura digital
    assinatura_url: null as string | null,
    mostrar_assinatura_imagem: true,
    tipo_certificado: null as "A1" | "A3" | null,
    certificado_pfx_path: null as string | null,
    certificado_validade: null as string | null,
    certificado_titular: null as string | null,
    crp: null as string | null,
    crm: null as string | null,
    registro_mte: null as string | null,
  });
  const [uploadingAssinatura, setUploadingAssinatura] = useState(false);
  const [uploadingPfx, setUploadingPfx] = useState(false);
  const [senhaVerif, setSenhaVerif] = useState("");
  const [verificandoCert, setVerificandoCert] = useState(false);

  /** Verifica o .pfx no servidor com a senha e atualiza a validade exibida. */
  async function verificarValidade() {
    if (!senhaVerif) {
      toast.error("Informe a senha do certificado para verificar.");
      return;
    }
    setVerificandoCert(true);
    try {
      const res = await fetch("/api/cert/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: senhaVerif,
          signatoryEmail: usuario?.email ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setForm((f) => ({
        ...f,
        certificado_validade: data.validade ?? null,
        certificado_titular: data.titular ?? f.certificado_titular,
      }));
      setSenhaVerif("");
      toast.success(
        data.vencido
          ? "Certificado VENCIDO — veja a data."
          : "Certificado válido — validade atualizada."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar certificado");
    } finally {
      setVerificandoCert(false);
    }
  }

  useEffect(() => {
    if (open) {
      const perfilDoUser = usuario?.perfil ?? "Tecnico";
      setForm({
        nome: usuario?.nome ?? "",
        email: usuario?.email ?? "",
        senha: "",
        cargo: usuario?.cargo ?? "",
        perfil: perfilDoUser,
        ativo_sistema: usuario?.ativo_sistema ?? true,
        empresas_vinculadas: usuario?.empresas_vinculadas ?? [],
        unidades: usuario?.unidades ?? [],
        modulos_permitidos:
          usuario?.modulos_permitidos ?? [...TODOS_MODULOS],
        // Se o usuário já existe, respeita o que está no banco.
        // Pra criação, usa defaults por perfil.
        pode_criar:
          usuario?.pode_criar ?? defaultPerm(perfilDoUser, "criar"),
        pode_editar:
          usuario?.pode_editar ?? defaultPerm(perfilDoUser, "editar"),
        pode_excluir:
          usuario?.pode_excluir ?? defaultPerm(perfilDoUser, "excluir"),
        assinatura_url: usuario?.assinatura_url ?? null,
        mostrar_assinatura_imagem: usuario?.mostrar_assinatura_imagem ?? true,
        tipo_certificado: usuario?.tipo_certificado ?? null,
        certificado_pfx_path: usuario?.certificado_pfx_path ?? null,
        certificado_validade: usuario?.certificado_validade ?? null,
        certificado_titular: usuario?.certificado_titular ?? null,
        crp: usuario?.crp ?? null,
        crm: usuario?.crm ?? null,
        registro_mte: usuario?.registro_mte ?? null,
      });
    }
  }, [open, usuario]);

  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  // Limpa busca ao abrir/fechar modal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBuscaEmpresa(""); }, [open]);

  // Quando o admin troca o perfil, reaplica os defaults granulares (só se
  // for criação — em edição, mantém o que o admin já configurou pra não
  // perder ajustes manuais)
  function aplicarDefaultsPerfil(novoPerfil: PerfilUsuario) {
    setForm((f) => ({
      ...f,
      perfil: novoPerfil,
      ...(isEdit
        ? {}
        : {
            pode_criar: defaultPerm(novoPerfil, "criar"),
            pode_editar: defaultPerm(novoPerfil, "editar"),
            pode_excluir: defaultPerm(novoPerfil, "excluir"),
          }),
    }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      if (isEdit && usuario) {
        const emailAntigo = usuario.email.toLowerCase();
        const emailNovo = form.email.trim().toLowerCase();

        // 1) Se email mudou → chama RPC que sincroniza auth.users + identities
        if (emailNovo !== emailAntigo) {
          const { error: errEmail } = await supabase.rpc(
            "atualizar_email_admin" as never,
            {
              p_email_antigo: emailAntigo,
              p_email_novo: emailNovo,
            } as never
          );
          if (errEmail) {
            throw new Error(errEmail.message || "Falha ao atualizar e-mail");
          }
        }

        // 2) Se senha foi preenchida → chama RPC pra redefinir
        if (form.senha && form.senha.length > 0) {
          if (form.senha.length < 6) {
            throw new Error("A nova senha deve ter ao menos 6 caracteres");
          }
          const { error: errSenha } = await supabase.rpc(
            "redefinir_senha_admin" as never,
            {
              p_email: emailNovo,
              p_nova_senha: form.senha,
            } as never
          );
          if (errSenha) {
            throw new Error(errSenha.message || "Falha ao redefinir senha");
          }
        }

        // 3) Atualiza demais campos em public.usuarios
        const { error } = await supabase
          .from("usuarios")
          .update({
            nome: form.nome.trim(),
            cargo: form.cargo.trim() || null,
            perfil: form.perfil,
            ativo_sistema: form.ativo_sistema,
            empresas_vinculadas:
              form.perfil === "Tecnico" || form.perfil === "Cliente"
                ? form.empresas_vinculadas
                : [],
            unidades: form.unidades,
            modulos_permitidos: form.modulos_permitidos,
            pode_criar: form.pode_criar,
            pode_editar: form.pode_editar,
            pode_excluir: form.pode_excluir,
            assinatura_url: form.assinatura_url,
            mostrar_assinatura_imagem: form.mostrar_assinatura_imagem,
            tipo_certificado: form.tipo_certificado,
            certificado_pfx_path: form.certificado_pfx_path,
            crp: form.crp || null,
            crm: form.crm || null,
            registro_mte: form.registro_mte || null,
          } as never)
          .eq("id_usuario", usuario.id_usuario);
        if (error) throw error;
        return;
      }

      if (!form.senha || form.senha.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      // AUTH-01: criação via Edge Function service_role — a sessão do admin
      // nunca é substituída (sem signUp() client-side).
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "criar-usuario-admin",
        {
          body: {
            email: form.email.trim().toLowerCase(),
            senha: form.senha,
            id_usuario: gerarId("USR"),
            nome: form.nome.trim(),
            cargo: form.cargo.trim() || null,
            perfil: form.perfil,
            ativo_sistema: form.ativo_sistema,
            empresas_vinculadas:
              form.perfil === "Tecnico" || form.perfil === "Cliente"
                ? form.empresas_vinculadas
                : [],
            unidades: form.unidades,
            modulos_permitidos: form.modulos_permitidos,
            pode_criar: form.pode_criar,
            pode_editar: form.pode_editar,
            pode_excluir: form.pode_excluir,
            assinatura_url: form.assinatura_url,
            mostrar_assinatura_imagem: form.mostrar_assinatura_imagem,
            tipo_certificado: form.tipo_certificado,
            certificado_pfx_path: form.certificado_pfx_path,
            crp: form.crp || null,
            crm: form.crm || null,
            registro_mte: form.registro_mte || null,
          },
        }
      );
      if (fnErr || !(fnData as { ok?: boolean } | null)?.ok) {
        throw new Error(
          (fnData as { error?: string } | null)?.error ??
            fnErr?.message ??
            "Falha ao criar usuário"
        );
      }

      // E-mail de boas-vindas — não bloqueia se a Edge Function não estiver
      // deployada ou se o RESEND_API_KEY ainda não foi configurado.
      try {
        await supabase.functions.invoke("welcome-email", {
          body: {
            email: form.email.trim().toLowerCase(),
            nome: form.nome.trim(),
            perfil: form.perfil,
          },
        });
      } catch (e) {
        console.warn("welcome-email não enviado:", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(isEdit ? "Usuário atualizado" : "Usuário criado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUploadAssinatura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 3 MB.");
      return;
    }
    setUploadingAssinatura(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `assinaturas/assin_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      setForm((f) => ({ ...f, assinatura_url: pub.publicUrl }));
      toast.success("Assinatura enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setUploadingAssinatura(false);
      e.target.value = "";
    }
  }

  async function handleUploadPfx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5 MB.");
      return;
    }
    setUploadingPfx(true);
    try {
      // Upload pelo servidor (bucket privado `certificados` via service_role). O upload
      // direto do navegador dava 403 no self-host (cred do browser só escreve em `fotos`).
      const fd = new FormData();
      fd.append("file", file);
      if (form.certificado_pfx_path) fd.append("oldPath", form.certificado_pfx_path);
      const res = await fetch("/api/cert/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error || "Erro ao enviar certificado");
      setForm((f) => ({ ...f, certificado_pfx_path: data.path! }));
      toast.success("Certificado A1 enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar certificado");
    } finally {
      setUploadingPfx(false);
      e.target.value = "";
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    if (
      (form.perfil === "Tecnico" || form.perfil === "Visualizador") &&
      form.unidades.length === 0
    ) {
      toast.error("Selecione ao menos uma unidade para Técnico/Visualizador");
      return;
    }
    mutation.mutate();
  }

  function toggleEmpresa(id: string) {
    setForm((f) => ({
      ...f,
      empresas_vinculadas: f.empresas_vinculadas.includes(id)
        ? f.empresas_vinculadas.filter((x) => x !== id)
        : [...f.empresas_vinculadas, id],
    }));
  }

  function toggleUnidade(id: string) {
    setForm((f) => ({
      ...f,
      unidades: f.unidades.includes(id)
        ? f.unidades.filter((x) => x !== id)
        : [...f.unidades, id],
    }));
  }

  function toggleModulo(m: ModuloPermitido) {
    setForm((f) => ({
      ...f,
      modulos_permitidos: f.modulos_permitidos.includes(m)
        ? f.modulos_permitidos.filter((x) => x !== m)
        : [...f.modulos_permitidos, m],
    }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Usuário" : "Novo Usuário"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome *">
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="E-mail *">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
              required
            />
            {isEdit && form.email.trim().toLowerCase() !== usuario?.email.toLowerCase() && (
              <p className="mt-1 text-[11px] text-amber-warning">
                ⚠ Mudar o e-mail força o usuário a logar com o novo
              </p>
            )}
          </Field>
        </div>

        <Field
          label={
            isEdit ? "Nova senha (deixe vazio pra manter a atual)" : "Senha inicial *"
          }
        >
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              className={cn(inputCls, "pl-8")}
              placeholder={
                isEdit
                  ? "Vazio = senha atual permanece"
                  : "Mínimo 6 caracteres"
              }
              required={!isEdit}
              minLength={isEdit && form.senha.length === 0 ? undefined : 6}
            />
          </div>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Cargo">
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className={inputCls}
            />
          </Field>
          {/* Registro profissional — campo único, label/placeholder dinâmicos pelo cargo */}
          {(() => {
            const reg = detectRegistroTipo(form.cargo);
            const valor = form[reg.campo] ?? "";
            return (
              <Field label={reg.label}>
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setForm({
                      ...form,
                      crp: reg.campo === "crp" ? v : null,
                      crm: reg.campo === "crm" ? v : null,
                      registro_mte: reg.campo === "registro_mte" ? v : null,
                    });
                  }}
                  placeholder={reg.placeholder}
                  className={inputCls}
                />
              </Field>
            );
          })()}
          <Field label="Perfil">
            <select
              value={form.perfil}
              onChange={(e) =>
                aplicarDefaultsPerfil(e.target.value as PerfilUsuario)
              }
              className={inputCls}
            >
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Permissões granulares (V45+). Oculto para perfil Cliente. */}
        {form.perfil !== "Cliente" && <Field label="Permissões">
          <p className="mt-0.5 text-[11px] text-gray-500">
            O perfil define defaults. Admin contorna estes flags. Visualizador
            só pode criar/editar/excluir o que estiver marcado aqui.
          </p>
          <div className="mt-1 grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pode_criar}
                onChange={(e) =>
                  setForm({ ...form, pode_criar: e.target.checked })
                }
                disabled={form.perfil === "Admin"}
                className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary disabled:opacity-50"
              />
              <span className={form.perfil === "Admin" ? "text-gray-500" : ""}>
                Pode <strong>criar</strong>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pode_editar}
                onChange={(e) =>
                  setForm({ ...form, pode_editar: e.target.checked })
                }
                disabled={form.perfil === "Admin"}
                className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary disabled:opacity-50"
              />
              <span className={form.perfil === "Admin" ? "text-gray-500" : ""}>
                Pode <strong>editar</strong>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pode_excluir}
                onChange={(e) =>
                  setForm({ ...form, pode_excluir: e.target.checked })
                }
                disabled={form.perfil === "Admin"}
                className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary disabled:opacity-50"
              />
              <span className={form.perfil === "Admin" ? "text-gray-500" : ""}>
                Pode <strong>excluir</strong>
              </span>
            </label>
          </div>
        </Field>}

        {(form.perfil === "Tecnico" || form.perfil === "Cliente") && (
          <Field
            label={
              form.perfil === "Cliente"
                ? `Empresa do cliente — ${form.empresas_vinculadas.length === 0 ? "nenhuma selecionada" : form.empresas_vinculadas[0]}`
                : `Empresas vinculadas (vazio = todas) — ${form.empresas_vinculadas.length} selecionadas`
            }
          >
            <input
              type="text"
              value={buscaEmpresa}
              onChange={(e) => setBuscaEmpresa(e.target.value)}
              placeholder="Buscar empresa…"
              className="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-primary/40"
            />
            <div className="max-h-48 overflow-auto rounded-md border border-gray-200 bg-white p-2">
              {empresas.length === 0 ? (
                <p className="p-2 text-xs text-gray-500">
                  Nenhuma empresa cadastrada.
                </p>
              ) : (() => {
                const filtradas = empresas.filter((e) =>
                  e.nome_empresa.toLowerCase().includes(buscaEmpresa.toLowerCase())
                );
                if (filtradas.length === 0)
                  return <p className="p-2 text-xs text-gray-500">Nenhuma empresa encontrada.</p>;
                return filtradas.map((e) =>
                  form.perfil === "Cliente" ? (
                    <label
                      key={e.id_empresa}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="empresa_cliente"
                        checked={form.empresas_vinculadas[0] === e.id_empresa}
                        onChange={() => setForm({ ...form, empresas_vinculadas: [e.id_empresa] })}
                        className="border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                      />
                      <span className="text-sm text-gray-700">{e.nome_empresa}</span>
                    </label>
                  ) : (
                    <label
                      key={e.id_empresa}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.empresas_vinculadas.includes(e.id_empresa)}
                        onChange={() => toggleEmpresa(e.id_empresa)}
                        className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                      />
                      <span className="text-sm text-gray-700">{e.nome_empresa}</span>
                    </label>
                  )
                );
              })()}
            </div>
          </Field>
        )}

        {(form.perfil === "Tecnico" || form.perfil === "Visualizador") && (
          <Field
            label={`Unidades * — ${form.unidades.length === 0 ? "obrigatório (selecione ao menos uma)" : `${form.unidades.length} selecionada(s)`}`}
          >
            <p className="mb-2 text-xs text-gray-500">
              O usuário vê as empresas destas unidades. Obrigatório para
              Técnico/Visualizador. Cadastre em Configurações → Unidades.
            </p>
            <div className="max-h-48 overflow-auto rounded-md border border-gray-200 bg-white p-2">
              {unidades.length === 0 ? (
                <p className="p-2 text-xs text-gray-500">
                  Nenhuma unidade cadastrada.
                </p>
              ) : (
                unidades.map((u) => (
                  <label
                    key={u.id_unidade}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.unidades.includes(u.id_unidade)}
                      onChange={() => toggleUnidade(u.id_unidade)}
                      className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                    />
                    <span className="text-sm text-gray-700">{u.nome}</span>
                  </label>
                ))
              )}
            </div>
          </Field>
        )}

        {form.perfil !== "Cliente" && <Field
          label={`Acesso aos módulos — ${form.modulos_permitidos.length} de ${TODOS_MODULOS.length}`}
        >
          <div className="grid gap-2 rounded-md border border-gray-200 bg-white p-3 sm:grid-cols-2">
            {TODOS_MODULOS.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={form.modulos_permitidos.includes(m)}
                  onChange={() => toggleModulo(m)}
                  className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                />
                <span className="text-sm text-gray-700">
                  {ROTULO_MODULO[m]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Funções administrativas (gestão de usuários, configurações)
            permanecem acessíveis a qualquer Admin, mesmo sem acesso a esses
            módulos.
          </p>
        </Field>}

        {/* ── Assinatura digital ─────────────────────────────────── */}
        <Field label="Assinatura do Técnico">
          <p className="mt-0.5 text-[11px] text-gray-500">
            Imagem usada como rubrica em todas as páginas dos relatórios e como
            assinatura no bloco final. Recomendado: PNG transparente, fundo branco.
          </p>

          {/* Preview */}
          {form.assinatura_url ? (
            <div className="mt-2 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <StorageImg
                stored={form.assinatura_url}
                alt="Assinatura"
                className="max-h-14 max-w-[180px] object-contain"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, assinatura_url: null }))}
                className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="Remover assinatura"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs italic text-gray-400">
              Nenhuma assinatura cadastrada.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-verde-accent",
                uploadingAssinatura && "opacity-50 pointer-events-none"
              )}
            >
              <Upload className="size-4" />
              {uploadingAssinatura
                ? "Enviando..."
                : form.assinatura_url
                ? "Trocar imagem"
                : "Enviar imagem"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingAssinatura}
                onChange={handleUploadAssinatura}
                className="hidden"
              />
            </label>
          </div>

          {/* Flag: exibir imagem nos relatórios */}
          <label className="mt-3 flex cursor-pointer items-center gap-2.5">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={form.mostrar_assinatura_imagem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mostrar_assinatura_imagem: e.target.checked }))
                }
              />
              <div className={cn(
                "h-5 w-9 rounded-full transition-colors",
                form.mostrar_assinatura_imagem ? "bg-verde-primary" : "bg-gray-300"
              )} />
              <div className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                form.mostrar_assinatura_imagem ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <span className="text-xs text-gray-700">
              Exibir imagem de assinatura nos relatórios
            </span>
            <span className="text-[10px] text-gray-400">
              (desative para usar apenas o selo do certificado digital)
            </span>
          </label>
        </Field>

        {/* Certificado digital */}
        <Field label="Certificado Digital">
          <p className="mt-0.5 text-[11px] text-gray-500">
            Selecione o tipo de certificado ICP-Brasil do técnico. A seleção
            aparece como selo de identificação nos relatórios — não é necessário
            enviar nenhum arquivo aqui.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["A1", "A3", null] as const).map((tipo) => (
              <label
                key={String(tipo)}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:border-verde-primary"
              >
                <input
                  type="radio"
                  name="tipo_certificado"
                  checked={form.tipo_certificado === tipo}
                  onChange={() =>
                    setForm((f) => ({ ...f, tipo_certificado: tipo }))
                  }
                  className="text-verde-primary focus:ring-verde-primary/30"
                />
                {tipo === null ? (
                  <span className="text-gray-500">Nenhum</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-blue-500" />
                    <strong>Certificado {tipo}</strong>
                    <span className="text-xs text-gray-400">
                      {tipo === "A1" ? "ICP-Brasil · software" : "ICP-Brasil · token/hardware"}
                    </span>
                  </span>
                )}
              </label>
            ))}
          </div>

          {/* Upload do .pfx — só aparece quando A1 selecionado */}
          {form.tipo_certificado === "A1" && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                Arquivo do Certificado A1 (.pfx / .p12)
              </p>
              {form.certificado_pfx_path ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <BadgeCheck className="size-4" />
                    <span>Certificado cadastrado</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          certificado_pfx_path: null,
                          certificado_validade: null,
                          certificado_titular: null,
                        }))
                      }
                      className="ml-auto rounded p-0.5 text-gray-400 hover:text-red-500"
                      title="Remover certificado"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {(() => {
                    if (!form.certificado_validade)
                      return (
                        <p className="mt-1 text-xs text-gray-500">
                          Validade ainda não verificada.
                        </p>
                      );
                    const dt = new Date(form.certificado_validade);
                    const venceu = new Date() > dt;
                    return (
                      <p
                        className={cn(
                          "mt-1 text-xs font-medium",
                          venceu ? "text-red-600" : "text-green-700"
                        )}
                      >
                        {venceu ? "⚠ Vencido em " : "Válido até "}
                        {dt.toLocaleDateString("pt-BR")}
                        {form.certificado_titular ? ` — ${form.certificado_titular}` : ""}
                      </p>
                    );
                  })()}
                  {/* Verificar validade (lê o .pfx no servidor com a senha) */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      value={senhaVerif}
                      onChange={(e) => setSenhaVerif(e.target.value)}
                      placeholder="Senha do certificado"
                      autoComplete="off"
                      className="w-44 rounded-md border border-blue-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={verificarValidade}
                      disabled={verificandoCert}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {verificandoCert ? "Verificando…" : "Verificar validade"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-blue-600">Nenhum arquivo cadastrado</p>
              )}
              <label
                className={cn(
                  "mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700",
                  uploadingPfx && "pointer-events-none opacity-50"
                )}
              >
                <Upload className="size-4" />
                {uploadingPfx
                  ? "Enviando..."
                  : form.certificado_pfx_path
                  ? "Trocar arquivo"
                  : "Enviar .pfx / .p12"}
                <input
                  type="file"
                  accept=".pfx,.p12"
                  disabled={uploadingPfx}
                  onChange={handleUploadPfx}
                  className="hidden"
                />
              </label>
              <p className="mt-1.5 text-[10px] text-blue-500">
                O arquivo é armazenado em bucket privado e nunca fica público.
                A senha nunca é salva — será solicitada no momento da assinatura.
              </p>
            </div>
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ativo_sistema}
            onChange={(e) =>
              setForm({ ...form, ativo_sistema: e.target.checked })
            }
            className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
          />
          <ShieldCheck className="size-4 text-verde-primary" />
          Usuário ativo no sistema
        </label>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-xl bg-verde-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
