import { cn } from "@/lib/utils";

interface AvisoBuscaAproximadaProps {
  /** `aproximado` devolvido por `buscar()` / `buscarEmpresas()`. */
  aproximado: boolean;
  /** O que a pessoa digitou (vai entre aspas no aviso). */
  busca: string;
  /** Quantos itens estão sendo mostrados. */
  total: number;
  /** Versão de uma linha, para dentro de dropdown. */
  compacto?: boolean;
  className?: string;
}

/**
 * Faixa âmbar que acompanha a busca tolerante (`lib/busca/texto.ts`): quando
 * nada bate por inteiro, a lista mostra os mais parecidos — e esta faixa avisa,
 * para ninguém tomar "parecido" por "achado". Não renderiza nada fora desse caso.
 */
export default function AvisoBuscaAproximada({
  aproximado,
  busca,
  total,
  compacto,
  className,
}: AvisoBuscaAproximadaProps) {
  if (!aproximado || total === 0) return null;
  if (compacto) {
    return (
      <p className={cn("border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-700", className)}>
        Nenhum bate exatamente — mostrando os mais parecidos
      </p>
    );
  }
  return (
    <div className={cn("rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800", className)}>
      Nada bate exatamente com &ldquo;{busca.trim()}&rdquo; — mostrando {total === 1 ? "o mais parecido" : `os ${total} mais parecidos`}.
    </div>
  );
}
