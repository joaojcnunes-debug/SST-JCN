"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useMovimentacoesParaExport,
  type EquipamentoCatalogo,
} from "@/lib/hooks/useEquipamentosEstoque";
import { useEquipamentosComColaboradorParaExport } from "@/lib/hooks/useEquipamentosEntregas";
import { ROTULO_TIPO, type RegistroMov, type TipoRegistro } from "@/lib/equipamentos/registro";
import {
  baixarEquipamentosXlsx,
  type LinhaComColaborador,
  type LinhaMovimentacao,
  type LinhaRegistro,
  type LinhaSaldo,
} from "@/lib/equipamentos/exportar-xlsx";

/**
 * Botão "Exportar" da área de Movimentação — Fase 8 do briefing.
 *
 * ⚠️ O ARQUIVO NÃO É UMA CÓPIA DA TELA, e isso é decisão, não descuido. A aba
 * "Registro" é a lista que estava na tela, com a busca e os filtros que a
 * pessoa escolheu — essa sim é cópia. As outras abas respondem o que a tela não
 * responde: o saldo de cada base, o extrato CRU (que a tela corta nos 300
 * lançamentos mais recentes) e com quem está cada aparelho. Quando os números
 * das abas não batem, a aba "Sobre" diz por quê — que é a diferença entre um
 * arquivo explicado e um arquivo em silêncio.
 *
 * O QUE O FILTRO DA TELA FAZ AQUI: a base recorta as quatro abas; o tipo de
 * registro recorta o Registro e o extrato (não existe "saldo de nota fiscal");
 * a busca e o período recortam só o Registro, que é a aba espelho. O recorte
 * inteiro vai escrito na aba Sobre e a base, no nome do arquivo.
 *
 * ⚠️ As duas buscas do clique (`enabled: false` + `refetch`) são o mesmo padrão
 * do botão do inventário: ninguém paga o extrato inteiro por abrir a tela.
 */
export default function BotaoExportarEquipamentosXlsx({
  catalogo,
  saldo,
  bases,
  baseFiltro,
  tipoFiltro,
  registro,
  filtroBusca,
  periodo,
}: {
  catalogo: EquipamentoCatalogo[];
  /** `${id_unidade}|${id_catalogo}` → saldo. */
  saldo: Map<string, number> | undefined;
  bases: { id_unidade: string; nome: string }[];
  baseFiltro: string;
  /** `TipoRegistro` ou "TODOS". Os valores batem com `MovOrigem` de propósito. */
  tipoFiltro: string;
  /** A lista única, já filtrada e buscada — é ela que vira a aba "Registro". */
  registro: RegistroMov[];
  filtroBusca: string;
  periodo: { de: string; ate: string };
}) {
  const [ocupado, setOcupado] = useState(false);
  const { refetch: buscarMovs } = useMovimentacoesParaExport();
  const { refetch: buscarPosse } = useEquipamentosComColaboradorParaExport();

  const nomeDaBase = new Map(bases.map((u) => [u.id_unidade, u.nome]));
  const basesDoRecorte =
    baseFiltro === "TODAS" ? bases : bases.filter((u) => u.id_unidade === baseFiltro);

  async function exportar() {
    setOcupado(true);
    try {
      const [movs, posse] = await Promise.all([buscarMovs(), buscarPosse()]);
      if (!movs.data) throw new Error("Não foi possível carregar o extrato.");

      // ── Registro: o que está na tela, linha por linha, sem retraduzir nada.
      const linhasRegistro: LinhaRegistro[] = registro.map((r) => ({
        quando: r.quando,
        registradoEm: r.registradoEm,
        tipo: ROTULO_TIPO[r.tipo],
        // Os itens entram no texto da célula: é o que faz o Ctrl+F do Excel
        // achar "teclado" na retirada que entregou o teclado.
        itens: r.itens
          .map((i) => (i.quantidade && i.quantidade > 1 ? `${i.quantidade}× ${i.nome}` : i.nome))
          .join("; "),
        quantidade: r.quantidade,
        sinal: r.sinal,
        base: r.base,
        baseDestino: r.baseDestino,
        pessoa: r.pessoa,
        responsavel: r.responsavel,
        situacao: r.situacao?.rotulo ?? null,
        assinado: r.assinado,
        motivo: r.motivo,
        observacao: r.observacao,
        patrimonio: r.itens.map((i) => i.numeroPatrimonio).filter(Boolean).join("; ") || null,
        serie: r.itens.map((i) => i.numeroSerie).filter(Boolean).join("; ") || null,
        lancamentos: r.lancamentos,
        codigo: r.idOriginal,
      }));

      // ── Saldo: só material por quantidade, e só o que não está zerado.
      // Item zerado numa base em que ele nunca entrou é ruído: a tela também
      // não mostra (`q !== 0`), e a planilha teria uma linha por combinação de
      // base × catálogo, a maioria em branco.
      const itemPorId = new Map(catalogo.map((c) => [c.id_catalogo, c]));
      const linhasSaldo: LinhaSaldo[] = [];
      for (const u of basesDoRecorte) {
        for (const c of catalogo) {
          if (c.controla_individual) continue;
          const q = saldo?.get(`${u.id_unidade}|${c.id_catalogo}`) ?? 0;
          if (q === 0) continue;
          linhasSaldo.push({
            nomeBase: u.nome,
            item: c.nome,
            tipo: c.tipo,
            unidadeMedida: c.unidade_medida,
            quantidade: q,
            estoqueMinimo: Number(c.estoque_minimo ?? 0),
          });
        }
      }

      // ── Movimentações: os MESMOS filtros de base e tipo, sobre o extrato
      // completo. Busca e período não entram aqui de propósito — esta aba é o
      // razão do estoque, e um razão com buraco no meio não fecha conta.
      const linhasMovs: LinhaMovimentacao[] = movs.data
        .filter((m) => {
          if (baseFiltro !== "TODAS" && m.id_unidade !== baseFiltro) return false;
          if (tipoFiltro !== "TODOS" && m.origem !== tipoFiltro) return false;
          return true;
        })
        .map((m) => ({
          criadoEm: m.criado_em,
          // Base apagada não deixa a linha sumir do relatório: o lançamento
          // aconteceu, e some da planilha é pior do que aparecer sem nome.
          nomeBase: nomeDaBase.get(m.id_unidade) ?? m.id_unidade,
          item: itemPorId.get(m.id_catalogo)?.nome ?? m.id_catalogo,
          tipo: m.tipo,
          quantidade: Number(m.quantidade),
          origem: ROTULO_TIPO[m.origem as TipoRegistro] ?? m.origem,
          motivo: m.motivo,
          responsavel: m.responsavel,
          criadoPor: m.criado_por,
        }));

      // ── Com quem está: recortado pela base, sem filtro de tipo (posse não
      // tem tipo de registro). Se a view falhar por permissão, a aba sai vazia
      // em vez de derrubar a exportação inteira — as outras ainda servem.
      const linhasPosse: LinhaComColaborador[] = (posse.data ?? [])
        .filter((e) => baseFiltro === "TODAS" || e.id_unidade === baseFiltro)
        .map((e) => ({
          colaborador: e.colaborador_nome,
          matricula: e.matricula,
          cargo: e.cargo,
          nomeBase: nomeDaBase.get(e.id_unidade) ?? e.id_unidade,
          equipamento: e.equipamento_nome,
          numeroSerie: e.numero_serie,
          numeroPatrimonio: e.numero_patrimonio,
          status: e.status,
          entregueEm: e.entregue_em,
        }));

      if (
        linhasRegistro.length === 0 &&
        linhasSaldo.length === 0 &&
        linhasMovs.length === 0 &&
        linhasPosse.length === 0
      ) {
        toast.error("Nada para exportar com os filtros atuais.");
        return;
      }

      const nomeBaseFiltro =
        baseFiltro === "TODAS" ? null : (nomeDaBase.get(baseFiltro) ?? baseFiltro);
      const partes = [
        nomeBaseFiltro ? `Base: ${nomeBaseFiltro}` : "Todas as bases",
        tipoFiltro === "TODOS"
          ? null
          : `Tipo: ${ROTULO_TIPO[tipoFiltro as TipoRegistro] ?? tipoFiltro}`,
        periodo.de || periodo.ate
          ? `Período: ${periodo.de ? fmt(periodo.de) : "início"} a ${periodo.ate ? fmt(periodo.ate) : "hoje"}`
          : null,
        filtroBusca.trim() ? `Busca: "${filtroBusca.trim()}"` : null,
      ].filter(Boolean);

      baixarEquipamentosXlsx(
        {
          registro: linhasRegistro,
          saldo: linhasSaldo,
          movimentacoes: linhasMovs,
          comColaborador: linhasPosse,
          filtroDescrito: partes.join(" · "),
        },
        nomeBaseFiltro ?? undefined,
      );
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={ocupado}
      title="Baixa a planilha: o registro da tela, o saldo, o extrato e com quem está cada aparelho"
      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {ocupado ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="size-4" />
      )}
      {ocupado ? "Gerando…" : "Exportar"}
    </button>
  );
}

/** aaaa-mm-dd → dd/mm/aaaa, só para a frase do recorte. */
function fmt(d: string): string {
  const [a, m, dia] = d.split("-");
  return dia ? `${dia}/${m}/${a}` : d;
}
