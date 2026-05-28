"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Profissional = {
  id_usuario: string;
  nome: string;
  cargo: string | null;
  tipo_certificado: "A1" | "A3" | null;
  crp: string | null;
};

/**
 * Select de profissional técnico. Carrega usuários ativos (exceto Visualizadores)
 * e ao selecionar notifica com nome + cargo + tipo_certificado + crp.
 * Pré-seleciona automaticamente quando `value` bate com um nome cadastrado
 * (comparação parcial bidirecional, insensível a maiúsculas e espaços extras).
 */
export default function ProfissionalSelect({
  value,
  onChange,
  className,
  placeholder = "Selecione o profissional...",
}: {
  /** Nome atual salvo (string livre vinda do banco). */
  value: string;
  /** Chamado ao selecionar: (nome, cargo, tipo_certificado, crp). */
  onChange: (nome: string, cargo: string | null, cert: "A1" | "A3" | null, crp?: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    createSupabaseBrowserClient()
      .from("usuarios")
      .select("id_usuario, nome, cargo, tipo_certificado, crp")
      .eq("ativo_sistema", true)
      .neq("perfil", "Visualizador")
      .order("nome")
      .then(({ data }) => { if (data) setProfissionais(data as Profissional[]); });
  }, []);

  // Pré-seleciona pelo nome salvo (match parcial bidirecional)
  useEffect(() => {
    if (!value || profissionais.length === 0) { setSelectedId(""); return; }
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const saved = norm(value);
    const wordMatch = (a: string, b: string) => {
      const words = norm(a).split(" ").filter((w) => w.length > 2);
      return words.length > 0 && words.every((w) => norm(b).includes(w));
    };
    const match = profissionais.find((p) => {
      const n = norm(p.nome);
      return n === saved || saved.includes(n) || n.includes(saved) ||
        wordMatch(p.nome, value) || wordMatch(value, p.nome);
    });
    setSelectedId(match?.id_usuario ?? "");
  }, [value, profissionais]);

  const selected = profissionais.find((p) => p.id_usuario === selectedId);

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => {
          const p = profissionais.find((p) => p.id_usuario === e.target.value);
          setSelectedId(e.target.value);
          if (p) onChange(p.nome, p.cargo, p.tipo_certificado ?? null, p.crp ?? null);
        }}
        className={cn(
          "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20",
          className
        )}
      >
        <option value="">{placeholder}</option>
        {profissionais.map((p) => (
          <option key={p.id_usuario} value={p.id_usuario}>
            {p.nome}{p.tipo_certificado ? ` · Cert. ${p.tipo_certificado}` : ""}
          </option>
        ))}
      </select>
      {selected?.tipo_certificado && (
        <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          {selected.tipo_certificado}
        </span>
      )}
    </div>
  );
}
