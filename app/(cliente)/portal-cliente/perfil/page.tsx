"use client";

import { useState } from "react";
import { Loader2, Save, User } from "lucide-react";
import toast from "react-hot-toast";
import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function PerfilCliente() {
  const user = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);
  const [nome, setNome] = useState(user?.nome ?? "");
  const [cargo, setCargo] = useState(user?.cargo ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSalvando(true);
    try {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from("usuarios") as any)
        .update({ nome: nome.trim(), cargo: cargo.trim() || null })
        .eq("id_usuario", user.id_usuario);
      if (error) throw error;
      setUser({ ...user, nome: nome.trim(), cargo: cargo.trim() || null });
      toast.success("Perfil atualizado.");
    } catch {
      toast.error("Erro ao salvar perfil.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="mt-1 text-sm text-gray-500">Informações da sua conta</p>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex size-14 items-center justify-center rounded-full bg-teal-100">
          <User className="size-7 text-teal-700" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.nome}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <p className="text-xs text-gray-400">{user?.perfil}</p>
        </div>
      </div>

      <form onSubmit={salvar} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cargo</label>
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-400"
          />
          <p className="mt-1 text-xs text-gray-400">O e-mail não pode ser alterado aqui.</p>
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </button>
      </form>
    </div>
  );
}

export default function PortalPerfilPage() {
  return (
    <PortalClienteLayout>
      <PerfilCliente />
    </PortalClienteLayout>
  );
}
