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
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { usePagination } from "@/lib/hooks/usePagination";
import { cn, gerarId } from "@/lib/utils";
import type {
  ModuloPermitido,
  PerfilUsuario,
  Usuario,
} from "@/lib/supabase/types";
import { ROTULO_MODULO, TODOS_MODULOS } from "@/lib/supabase/types";

const PERFIS: PerfilUsuario[] = ["Admin", "Tecnico", "Visualizador"];

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
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
        >
          <Plus className="size-4" />
          Novo Usuário
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={5} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">E-mail</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cargo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Perfil</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pag.pageItems.map((u) => (
                  <tr key={u.id_usuario} className="hover:bg-gray-50">
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
                          className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <ToggleAtivo usuario={u} />
                        {currentUser?.email !== u.email && (
                          <button
                            type="button"
                            onClick={() => setConfirmDel(u)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
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
        "rounded p-1.5 hover:bg-amber-50 disabled:opacity-50",
        usuario.ativo_sistema
          ? "text-gray-500 hover:text-amber-warning"
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

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    cargo: "",
    perfil: "Tecnico" as PerfilUsuario,
    ativo_sistema: true,
    empresas_vinculadas: [] as string[],
    modulos_permitidos: [...TODOS_MODULOS] as ModuloPermitido[],
    // V45: permissões granulares — Admin contorna estes flags, mas a UI
    // mantém eles marcados pra clareza.
    pode_criar: true,
    pode_editar: true,
    pode_excluir: false,
  });

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
      });
    }
  }, [open, usuario]);

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
              form.perfil === "Tecnico" ? form.empresas_vinculadas : [],
            modulos_permitidos: form.modulos_permitidos,
            pode_criar: form.pode_criar,
            pode_editar: form.pode_editar,
            pode_excluir: form.pode_excluir,
          } as never)
          .eq("id_usuario", usuario.id_usuario);
        if (error) throw error;
        return;
      }

      // Criação: usa signUp() oficial do Supabase Auth.
      //
      // Pré-requisito: "Confirm email" deve estar DESABILITADO no projeto
      // (Authentication → Providers → Email → "Confirm email" off). Com
      // isso, signUp cria o usuário JÁ CONFIRMADO sem disparar e-mail —
      // sem rate limit do SMTP free tier.
      //
      // Por que essa abordagem em vez de RPC direto em auth.users:
      // o schema interno de auth.users/identities muda entre versões do
      // Supabase Auth, e o login (signInWithPassword) requer registros
      // exatos. Usar signUp passa pelo endpoint oficial que sempre cria
      // tudo certo.
      if (!form.senha || form.senha.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const emailNorm = form.email.trim().toLowerCase();

      // Salva sessão atual pra restaurar (signUp pode trocar a sessão ativa).
      const { data: { session: sessaoAdmin } } = await supabase.auth.getSession();

      const { error: errAuth } = await supabase.auth.signUp({
        email: emailNorm,
        password: form.senha,
      });
      if (errAuth) {
        // Restaura sessão antes de propagar o erro.
        if (sessaoAdmin) {
          await supabase.auth.setSession({
            access_token: sessaoAdmin.access_token,
            refresh_token: sessaoAdmin.refresh_token,
          });
        }
        throw new Error(
          errAuth.message ===
          "User already registered"
            ? "E-mail já cadastrado"
            : errAuth.message
        );
      }

      // Restaura sessão do Admin (signUp logou como o novo usuário).
      if (sessaoAdmin) {
        await supabase.auth.setSession({
          access_token: sessaoAdmin.access_token,
          refresh_token: sessaoAdmin.refresh_token,
        });
      }

      // Insere o registro em public.usuarios.
      const insertRow = {
        id_usuario: gerarId("USR"),
        nome: form.nome.trim(),
        email: emailNorm,
        cargo: form.cargo.trim() || null,
        perfil: form.perfil,
        ativo_sistema: form.ativo_sistema,
        empresas_vinculadas:
          form.perfil === "Tecnico" ? form.empresas_vinculadas : [],
        modulos_permitidos: form.modulos_permitidos,
        pode_criar: form.pode_criar,
        pode_editar: form.pode_editar,
        pode_excluir: form.pode_excluir,
      };
      const { error: errInsert } = await supabase
        .from("usuarios")
        .insert(insertRow as never);
      if (errInsert) {
        throw new Error(
          `Usuário criado no Auth mas falhou ao salvar perfil: ${errInsert.message}`
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
            senha: form.senha,
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
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

        {/* Permissões granulares (V45+). Admin tem tudo por padrão (e
            contorna esses flags no código) — mas o checkbox aparece pra
            clareza visual. Visualizador começa sem nada; admin pode
            habilitar individualmente. */}
        <Field label="Permissões">
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
        </Field>

        {form.perfil === "Tecnico" && (
          <Field
            label={`Empresas vinculadas (vazio = todas) — ${form.empresas_vinculadas.length} selecionadas`}
          >
            <div className="max-h-48 overflow-auto rounded-md border border-gray-200 bg-white p-2">
              {empresas.length === 0 ? (
                <p className="p-2 text-xs text-gray-500">
                  Nenhuma empresa cadastrada.
                </p>
              ) : (
                empresas.map((e) => (
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
                ))
              )}
            </div>
          </Field>
        )}

        <Field
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

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";

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
