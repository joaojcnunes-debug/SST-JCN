"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { detectRegistroTipo, getRegistroValue } from "@/lib/registro-profissional";

type Profissional = {
  id_usuario: string;
  nome: string;
  cargo: string | null;
  tipo_certificado: "A1" | "A3" | null;
  crp: string | null;
  crm: string | null;
  registro_mte: string | null;
};

/**
 * Select de profissional técnico. Carrega usuários ativos (exceto Visualizadores)
 * e ao selecionar notifica com nome + cargo + cert + registro profissional.
 * Pré-seleciona automaticamente quando `value` bate com um nome cadastrado.
 * Dispara `onMatchFound` quando a pré-seleção inicial é resolvida, permitindo
 * que o pai obtenha o cargo/registro do profissional já salvo no relatório.
 */
export default function ProfissionalSelect({
  value,
  onChange,
  onMatchFound,
  className,
  placeholder = "Selecione o profissional...",
}: {
  value: string;
  /** (nome, cargo, cert, registro) — registro é o valor do campo mapeado pelo cargo */
  onChange: (
    nome: string,
    cargo: string | null,
    cert: "A1" | "A3" | null,
    registro?: string | null
  ) => void;
  /** Dispara uma vez quando o profissional correspondente ao `value` inicial é encontrado */
  onMatchFound?: (profissional: {
    nome: string;
    cargo: string | null;
    cert: "A1" | "A3" | null;
    registro: string | null;
  }) => void;
  className?: string;
  placeholder?: string;
}) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [matchNotified, setMatchNotified] = useState(false);

  useEffect(() => {
    createSupabaseBrowserClient()
      .from("usuarios")
      .select("id_usuario, nome, cargo, tipo_certificado, crp, crm, registro_mte")
      .eq("ativo_sistema", true)
      .neq("perfil", "Visualizador")
      .order("nome")
      .then(({ data }) => { if (data) setProfissionais(data as Profissional[]); });
  }, []);

  // Pré-seleciona pelo nome salvo (match parcial + word-match)
  useEffect(() => {
    if (!value || profissionais.length === 0) { setSelectedId(""); return; }
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const wordMatch = (a: string, b: string) => {
      const words = norm(a).split(" ").filter((w) => w.length > 2);
      return words.length > 0 && words.every((w) => norm(b).includes(w));
    };
    const match = profissionais.find((p) => {
      const n = norm(p.nome);
      const v = norm(value);
      return n === v || v.includes(n) || n.includes(v) ||
        wordMatch(p.nome, value) || wordMatch(value, p.nome);
    });
    setSelectedId(match?.id_usuario ?? "");

    // Notifica o pai com os dados do profissional encontrado (apenas uma vez)
    if (match && !matchNotified && onMatchFound) {
      onMatchFound({
        nome: match.nome,
        cargo: match.cargo,
        cert: match.tipo_certificado,
        registro: getRegistroValue(match) || null,
      });
      setMatchNotified(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, profissionais]);

  const selected = profissionais.find((p) => p.id_usuario === selectedId);

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => {
          const p = profissionais.find((p) => p.id_usuario === e.target.value);
          setSelectedId(e.target.value);
          if (p) {
            const reg = detectRegistroTipo(p.cargo);
            const regValue = p[reg.campo] ?? p.crp ?? p.crm ?? p.registro_mte ?? null;
            onChange(p.nome, p.cargo, p.tipo_certificado ?? null, regValue);
          }
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
