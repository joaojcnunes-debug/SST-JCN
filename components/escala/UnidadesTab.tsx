"use client";

import { useState } from "react";
import { AlertTriangle, Building2, Check, Loader2, RotateCcw } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  usePodeEditarEscala,
  useSalvarUnidadeConfig,
  useUnidadesDaEscala,
} from "@/lib/hooks/useEscalaCadastro";
import type { UnidadeDaEscala } from "@/lib/escala/tipos";

/**
 * Aba Unidades da configuração (Fase 3).
 *
 * O que se edita aqui é SÓ o que a escala precisa: cor, ordem, município e se a
 * unidade entra na escala. Nome e existência da unidade continuam vindo de
 * `public.unidades` — a mesma tabela que Frota, Inventário e Gestão Gerencial
 * usam. Esta tela nunca cria nem renomeia unidade; fazer isso aqui criaria um
 * segundo cadastro de unidade no painel.
 *
 * Unidade sem linha de config aparece marcada como "não configurada" em vez de
 * sumir: sumir faria a tela mentir sobre o que existe.
 */

/** Cor da marca. É o que a unidade herda enquanto ninguém escolher a dela. */
const COR_PADRAO = "#0ea5e9";

interface Rascunho {
  cor_hex: string;
  ordem: number;
  municipio: string;
  ativo: boolean;
}

function doServidor(u: UnidadeDaEscala): Rascunho {
  return {
    cor_hex: u.cor_hex,
    ordem: u.ordem,
    municipio: u.municipio ?? "",
    ativo: u.ativo,
  };
}

function mudou(a: Rascunho, b: Rascunho): boolean {
  return (
    a.cor_hex !== b.cor_hex ||
    a.ordem !== b.ordem ||
    a.municipio.trim() !== b.municipio.trim() ||
    a.ativo !== b.ativo
  );
}

export default function UnidadesTab() {
  const { data: unidades = [], isLoading } = useUnidadesDaEscala(false);
  const salvar = useSalvarUnidadeConfig();
  const podeEditar = usePodeEditarEscala();

  /**
   * Rascunho por unidade, e só das linhas que a pessoa tocou. Guardar TODAS as
   * linhas em estado no carregamento faria a tela sobrescrever, no primeiro
   * salvamento, o que outra pessoa tivesse gravado enquanto esta estava aberta.
   * Cada "Salvar" manda uma unidade só.
   */
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function editar(u: UnidadeDaEscala, campo: Partial<Rascunho>) {
    setRascunhos((r) => ({
      ...r,
      [u.id_unidade]: { ...(r[u.id_unidade] ?? doServidor(u)), ...campo },
    }));
  }

  function desfazer(id: string) {
    setRascunhos((r) => {
      const novo = { ...r };
      delete novo[id];
      return novo;
    });
  }

  async function gravar(u: UnidadeDaEscala) {
    const d = rascunhos[u.id_unidade];
    if (!d) return;
    setSalvandoId(u.id_unidade);
    try {
      await salvar.mutateAsync({
        id_unidade: u.id_unidade,
        cor_hex: d.cor_hex,
        ordem: d.ordem,
        municipio: d.municipio.trim() || null,
        ativo: d.ativo,
      });
      desfazer(u.id_unidade);
    } catch {
      // Erro já vira toast no `onError` do hook. O catch impede a rejeição solta
      // no handler do clique — e o rascunho FICA na tela, para a pessoa tentar
      // de novo sem redigitar.
    } finally {
      setSalvandoId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando unidades...
      </div>
    );
  }

  const naoConfiguradas = unidades.filter((u) => !u.configurada).length;
  const semMunicipio = unidades.filter((u) => u.ativo && !u.municipio).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        As unidades vêm do cadastro do painel.{" "}
        {podeEditar ? (
          <>
            Aqui você define a <strong>cor</strong> com que ela aparece na grade, a{" "}
            <strong>ordem</strong> de exibição e o <strong>município</strong>.
          </>
        ) : (
          <>
            A <strong>cor</strong> é como ela aparece na grade, a <strong>ordem</strong> é a
            de exibição e o <strong>município</strong> é o que liga o feriado municipal a
            ela.
          </>
        )}
      </p>

      {naoConfiguradas > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {naoConfiguradas === 1
              ? "1 unidade ainda não foi configurada"
              : `${naoConfiguradas} unidades ainda não foram configuradas`}{" "}
            e está usando a cor padrão.
            {podeEditar
              ? " Ajuste e salve cada uma."
              : " Quem configura é um Admin ou Técnico."}
          </span>
        </div>
      )}

      {semMunicipio > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>O município é o que liga o feriado municipal à unidade.</strong>{" "}
            {semMunicipio === 1
              ? "1 unidade ativa está"
              : `${semMunicipio} unidades ativas estão`}{" "}
            sem município: feriado municipal nunca vai bloquear o dia delas.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2">Unidade</th>
              <th className="w-28 px-3 py-2">Cor</th>
              <th className="w-24 px-3 py-2">Ordem</th>
              <th className="px-3 py-2">Município</th>
              <th className="w-24 px-3 py-2">Na escala</th>
              <th className="w-32 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {unidades.map((u) => {
              const servidor = doServidor(u);
              const d = rascunhos[u.id_unidade] ?? servidor;
              const sujo = mudou(d, servidor);
              const gravando = salvandoId === u.id_unidade;

              return (
                <tr key={u.id_unidade} className={cn(sujo && "bg-gray-50")}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: d.cor_hex }}
                      />
                      <span className="font-medium text-gray-900">{u.nome}</span>
                      {!u.configurada && <Badge variant="muted">não configurada</Badge>}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {podeEditar ? (
                        <input
                          type="color"
                          value={d.cor_hex}
                          onChange={(e) => editar(u, { cor_hex: e.target.value })}
                          className="size-7 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                          aria-label={`Cor de ${u.nome}`}
                        />
                      ) : (
                        <span
                          className="inline-block size-5 rounded border border-black/10"
                          style={{ backgroundColor: d.cor_hex }}
                        />
                      )}
                      <span className="font-mono text-[11px] text-gray-500">{d.cor_hex}</span>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    {podeEditar ? (
                      <input
                        type="number"
                        value={d.ordem}
                        onChange={(e) => editar(u, { ordem: Number(e.target.value) || 0 })}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm tabular-nums"
                        aria-label={`Ordem de ${u.nome}`}
                      />
                    ) : (
                      <span className="tabular-nums text-gray-600">{d.ordem}</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {podeEditar ? (
                      <input
                        type="text"
                        value={d.municipio}
                        onChange={(e) => editar(u, { municipio: e.target.value })}
                        placeholder="ex.: Teresópolis"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        aria-label={`Município de ${u.nome}`}
                      />
                    ) : (
                      <span className="text-gray-600">{d.municipio || "—"}</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {podeEditar ? (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={d.ativo}
                          onChange={(e) => editar(u, { ativo: e.target.checked })}
                          className="size-4 accent-[#0891B2]"
                        />
                        {d.ativo ? "Sim" : "Não"}
                      </label>
                    ) : (
                      <span className="text-xs text-gray-600">{d.ativo ? "Sim" : "Não"}</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {sujo && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => gravar(u)}
                          disabled={gravando}
                          className="inline-flex items-center gap-1 rounded bg-[#0891B2] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
                        >
                          {gravando ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => desfazer(u.id_unidade)}
                          disabled={gravando}
                          className="inline-flex items-center rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                          title="Desfazer"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {unidades.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                  <Building2 className="mx-auto mb-2 size-6 text-gray-300" />
                  Nenhuma unidade cadastrada no painel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        A cor padrão é <span className="font-mono">{COR_PADRAO}</span>, o verde da marca.
      </p>
    </div>
  );
}
