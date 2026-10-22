"use client";

import { useMemo } from "react";
import { Network } from "lucide-react";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import SelectBusca, { type OpcaoSelectBusca } from "@/components/ui/SelectBusca";

/** Opção que não é um grupo ("Não pertence a um grupo", "Todos os grupos"…). */
export interface OpcaoFixaGrupo {
  value: string;
  label: string;
}

const ICONE_GRUPO = <Network className="size-3.5 shrink-0 text-indigo-500" />;

/**
 * Lista de grupos de empresas COM DIGITAÇÃO NO CAMPO (SelectBusca). O `<select>`
 * nativo obrigava a rolar a lista inteira até achar o grupo (07/10: "cansativa
 * e burocrática"). Mostra quantas empresas cada grupo tem e, com `onCriar`,
 * oferece criar o grupo com o nome digitado quando ele não existe.
 */
export default function GrupoSelect({
  value,
  onChange,
  inicio = [],
  fim = [],
  onCriar,
  criando = false,
  className,
  botaoClassName,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Opções fixas antes dos grupos (ex.: "Não pertence a um grupo"). */
  inicio?: OpcaoFixaGrupo[];
  /** Opções fixas depois dos grupos (ex.: "Sem grupo"). */
  fim?: OpcaoFixaGrupo[];
  /** Quando informado, a busca sem resultado exato oferece "Criar grupo «…»". */
  onCriar?: (nome: string) => void;
  criando?: boolean;
  className?: string;
  /** Classes do campo (borda, raio, padding). */
  botaoClassName?: string;
  title?: string;
}) {
  const { grupos, membrosPorGrupo } = useGruposEmpresas();

  const opcoes = useMemo<OpcaoSelectBusca[]>(() => {
    const qtd = (id: string) => membrosPorGrupo.get(id)?.length ?? 0;
    return [
      ...inicio.map((o) => ({ ...o, fixa: true })),
      ...grupos.map((g) => ({
        value: g.id_grupo,
        label: g.nome,
        buscaExtra: [g.descricao],
        icone: ICONE_GRUPO,
        detalhe: `${qtd(g.id_grupo)} ${qtd(g.id_grupo) === 1 ? "empresa" : "empresas"}`,
      })),
      ...fim.map((o) => ({ ...o, fixa: true })),
    ];
  }, [grupos, membrosPorGrupo, inicio, fim]);

  return (
    <SelectBusca
      value={value}
      onChange={onChange}
      opcoes={opcoes}
      placeholderBusca="Digite o nome do grupo…"
      vazio="Nenhum grupo encontrado"
      onCriar={onCriar}
      rotuloCriar="Criar grupo"
      criando={criando}
      className={className}
      campoClassName={botaoClassName}
      title={title}
      ariaLabel={title ?? "Grupo de empresas"}
    />
  );
}
