"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORIAS_MODULO, ROTULO_MODULO, TODOS_MODULOS } from "@/lib/supabase/types";
import type { ModuloPermitido, PerfilUsuario } from "@/lib/supabase/types";
import {
  ACOES_MODULO,
  GERAL,
  MODULOS_SO_ACESSO,
  TODAS_AS_COLUNAS,
  marcarNaGrade,
  type ColunaGrade,
  type GradeModulos,
  type LinhaGrade,
} from "@/lib/acesso/permissoes-modulo";
import { TELAS_DO_MODULO, marcarTelas, telasDosModulos } from "@/lib/acesso/telas-modulo";
import { cn } from "@/lib/utils";

const ROTULO_COLUNA: Record<ColunaGrade, string> = {
  ver: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
};

const caixa =
  "size-4 rounded border-gray-300 text-marca-primary focus:ring-marca-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Acesso aos módulos no cadastro de usuário, no jeito do SGG (pedido de 09/11/2026): cada grupo abre e fecha, e
 * cada módulo tem Visualizar, Criar, Editar e Excluir. A caixa do nome marca ou tira as quatro; "Permitir todas" e
 * "Bloquear todas" valem para o grupo. "Empresas e Validades" (telas fora dos módulos) tem Criar/Editar/Excluir
 * próprios, para tirar ações dos módulos não tirar nada lá. As regras de marcação estão em
 * `lib/acesso/permissoes-modulo.ts`.
 *
 * Visualizar por tela (10/11/2026): a seta ao lado do módulo abre as telas dele (`lib/acesso/telas-modulo.ts`), cada
 * uma com o seu Visualizar. Criar, Editar e Excluir continuam do módulo (o banco confere por tabela). A última tela
 * liberada não se desmarca: para tirar todas, desmarque o Visualizar do módulo.
 *   `gestao`  o bloco de acesso à Gestão JCN (só para quem administra a Gestão), como último grupo
 *   `telasBloqueadas` / `onTelasChange`  as telas que a pessoa não vê (vazio = todas)
 */
export default function GradePermissoesModulos<T extends string>({
  perfil,
  modulos,
  grade,
  onChange,
  gestao,
  telasBloqueadas = [],
  onTelasChange,
}: {
  perfil: PerfilUsuario;
  modulos: T[];
  grade: GradeModulos;
  onChange: (modulos: T[], grade: GradeModulos) => void;
  gestao?: ReactNode;
  telasBloqueadas?: string[];
  onTelasChange?: (telas: string[]) => void;
}) {
  const [abertos, setAbertos] = useState<string[]>([]);
  const admin = perfil === "Admin";

  function marcar(alvo: readonly LinhaGrade[], colunas: readonly ColunaGrade[], valor: boolean) {
    const r = marcarNaGrade(modulos, grade, alvo, colunas, valor);
    onChange(r.modulos, r.grade);
    // Liberar o módulo (Visualizar ou tudo) libera as telas dele junto.
    if (valor && colunas.includes("ver") && onTelasChange) {
      onTelasChange(marcarTelas(telasBloqueadas, telasDosModulos(alvo.filter((l) => l !== GERAL)), true));
    }
  }
  const alternar = (id: string) =>
    setAbertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const ve = (m: ModuloPermitido) => (modulos as string[]).includes(m);
  // Admin cria, edita e exclui em todo módulo que vê (os hooks contornam a grade): as três aparecem marcadas.
  const tem = (m: ModuloPermitido, c: ColunaGrade) => (c === "ver" ? ve(m) : ve(m) && (admin || grade[m][c]));
  const soAcesso = (m: ModuloPermitido) => MODULOS_SO_ACESSO.includes(m);
  const telasDe = (m: ModuloPermitido) => TELAS_DO_MODULO[m] ?? [];
  const veTela = (m: ModuloPermitido, id: string) => ve(m) && (admin || !telasBloqueadas.includes(id));

  const botaoGrupo =
    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:bg-gray-100";

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="mr-auto text-[11px] text-gray-500">
          Visualizar dá a entrada no módulo; Criar, Editar e Excluir valem só dentro dele e marcam o Visualizar junto.
          A seta ao lado do módulo mostra as telas dele, cada uma com o seu Visualizar.
          {admin
            ? " Admin cria, edita e exclui em todo módulo que vê: para ele vale só o Visualizar."
            : perfil === "Visualizador"
              ? " Visualizador não cria documentos mesmo marcado: o banco só aceita criação de Admin e Técnico."
              : ""}
        </p>
        <button
          type="button"
          onClick={() => marcar([...TODOS_MODULOS, GERAL], TODAS_AS_COLUNAS, true)}
          className={cn(botaoGrupo, "text-marca-primary")}
        >
          <Check className="size-3.5" /> Permitir tudo
        </button>
        <button
          type="button"
          onClick={() => marcar([...TODOS_MODULOS, GERAL], TODAS_AS_COLUNAS, false)}
          className={cn(botaoGrupo, "text-red-600")}
        >
          <Ban className="size-3.5" /> Bloquear tudo
        </button>
      </div>

      {CATEGORIAS_MODULO.map((cat) => {
        const aberto = abertos.includes(cat.label);
        const comAcesso = cat.modulos.filter(ve).length;
        return (
          <section key={cat.label} className="rounded-md border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
              <button
                type="button"
                onClick={() => alternar(cat.label)}
                aria-expanded={aberto}
                className="mr-auto flex items-center gap-2 text-left text-sm font-semibold text-gray-800"
              >
                <ChevronDown className={cn("size-4 text-marca-primary transition-transform", !aberto && "-rotate-90")} />
                {cat.label}
                <span className="text-xs font-normal text-gray-500">
                  — {comAcesso} de {cat.modulos.length} com acesso
                </span>
              </button>
              <button
                type="button"
                onClick={() => marcar(cat.modulos, TODAS_AS_COLUNAS, true)}
                className={cn(botaoGrupo, "text-marca-primary")}
              >
                <Check className="size-3.5" /> Permitir todas
              </button>
              <button
                type="button"
                onClick={() => marcar(cat.modulos, TODAS_AS_COLUNAS, false)}
                className={cn(botaoGrupo, "text-red-600")}
              >
                <Ban className="size-3.5" /> Bloquear todas
              </button>
            </div>

            {aberto && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="bg-marca-primary text-xs font-semibold text-white">
                      <th className="px-3 py-2 text-left">Módulo</th>
                      {TODAS_AS_COLUNAS.map((c) => (
                        <th key={c} className="w-20 px-1 py-2 text-center">
                          {ROTULO_COLUNA[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.modulos.map((m) => {
                      const colunas = soAcesso(m) ? (["ver"] as ColunaGrade[]) : TODAS_AS_COLUNAS;
                      const marcadas = colunas.filter((c) => tem(m, c)).length;
                      const todas = marcadas === colunas.length;
                      const telas = telasDe(m);
                      const telasAbertas = abertos.includes(`tela:${m}`);
                      const telasVistas = telas.filter((x) => veTela(m, x.id)).length;
                      return (
                        <Fragment key={m}>
                        <tr className="border-t border-gray-100 even:bg-gray-50/70">
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              {telas.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => alternar(`tela:${m}`)}
                                  aria-expanded={telasAbertas}
                                  aria-label={`${telasAbertas ? "Fechar" : "Abrir"} as telas de ${ROTULO_MODULO[m]}`}
                                  title="Telas deste módulo"
                                  className="rounded p-0.5 text-marca-primary hover:bg-gray-100"
                                >
                                  <ChevronRight className={cn("size-3.5 transition-transform", telasAbertas && "rotate-90")} />
                                </button>
                              ) : (
                                <span className="w-[18px]" />
                              )}
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={todas}
                                  ref={(el) => {
                                    if (el) el.indeterminate = marcadas > 0 && !todas;
                                  }}
                                  onChange={() => marcar([m], TODAS_AS_COLUNAS, !todas)}
                                  className={caixa}
                                />
                                <span className="text-gray-800">{ROTULO_MODULO[m]}</span>
                                {telas.length > 1 && ve(m) && (
                                  <span className={cn("text-[11px]", telasVistas < telas.length ? "text-amber-700" : "text-gray-400")}>
                                    {telasVistas} de {telas.length} telas
                                  </span>
                                )}
                              </label>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Visualizar — ${ROTULO_MODULO[m]}`}
                              checked={ve(m)}
                              onChange={(e) => marcar([m], ["ver"], e.target.checked)}
                              className={caixa}
                            />
                          </td>
                          {ACOES_MODULO.map((a) => (
                            <td key={a} className="px-1 py-1.5 text-center">
                              {soAcesso(m) ? (
                                <span className="text-gray-300" title="Este módulo é só a entrada">
                                  —
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={`${ROTULO_COLUNA[a]} — ${ROTULO_MODULO[m]}`}
                                  checked={tem(m, a)}
                                  disabled={admin}
                                  onChange={(e) => marcar([m], [a], e.target.checked)}
                                  className={caixa}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                        {telasAbertas &&
                          telas.map((x) => {
                            const liberada = veTela(m, x.id);
                            // A última tela liberada fica: tirar todas é tirar o Visualizar do módulo.
                            const ultima = liberada && telasVistas === 1;
                            return (
                              <tr key={`${m}:${x.id}`} className="border-t border-gray-50 bg-marca-primary/[0.03] text-xs">
                                <td className="py-1 pl-12 pr-3 text-gray-600">
                                  {x.rotulo}
                                  {x.cardProprio && <span className="ml-1 text-[10px] text-gray-400">(cartão próprio no hub)</span>}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Visualizar — ${ROTULO_MODULO[m]} › ${x.rotulo}`}
                                    checked={liberada}
                                    disabled={!ve(m) || admin || ultima || !onTelasChange}
                                    title={
                                      admin
                                        ? "Admin vê todas as telas"
                                        : !ve(m)
                                          ? "Marque o Visualizar do módulo primeiro"
                                          : ultima
                                            ? "Para tirar todas as telas, desmarque o Visualizar do módulo"
                                            : undefined
                                    }
                                    onChange={(e) => onTelasChange?.(marcarTelas(telasBloqueadas, [x.id], e.target.checked))}
                                    className={caixa}
                                  />
                                </td>
                                <td colSpan={3} className="px-1 py-1 text-center text-[10px] text-gray-400">
                                  Criar, Editar e Excluir seguem o módulo
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {/* Telas fora dos módulos que consultam Criar/Editar/Excluir: todos veem, então não há Visualizar. */}
      {(() => {
        const marcadas = ACOES_MODULO.filter((a) => admin || grade[GERAL][a]).length;
        const todas = marcadas === ACOES_MODULO.length;
        return (
          <section className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="bg-gray-100 text-xs font-semibold text-gray-600">
                  <th className="px-3 py-2 text-left">Fora dos módulos</th>
                  {TODAS_AS_COLUNAS.map((c) => (
                    <th key={c} className="w-20 px-1 py-2 text-center">
                      {ROTULO_COLUNA[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    <label className={cn("flex items-center gap-2", !admin && "cursor-pointer")}>
                      <input
                        type="checkbox"
                        checked={todas}
                        disabled={admin}
                        ref={(el) => {
                          if (el) el.indeterminate = marcadas > 0 && !todas;
                        }}
                        onChange={() => marcar([GERAL], TODAS_AS_COLUNAS, !todas)}
                        className={caixa}
                      />
                      <span className="text-gray-800">Empresas e Validades</span>
                    </label>
                  </td>
                  <td className="px-1 py-1.5 text-center text-[11px] text-gray-400" title="Todos veem essas telas">
                    todos
                  </td>
                  {ACOES_MODULO.map((a) => (
                    <td key={a} className="px-1 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${ROTULO_COLUNA[a]} — Empresas e Validades`}
                        checked={admin || grade[GERAL][a]}
                        disabled={admin}
                        onChange={(e) => marcar([GERAL], [a], e.target.checked)}
                        className={caixa}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        );
      })()}

      {/* Uma caixa só (a entrada): fica sempre à vista, sem abrir e fechar. */}
      {gestao && <section className="rounded-md border border-gray-200 bg-white px-1 py-2">{gestao}</section>}
    </div>
  );
}
