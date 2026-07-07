import { EmpresaDetalheSkeleton } from "@/components/empresas/EmpresaSkeletons";

// Fallback de navegação (Suspense de rota): a transição aterrissa neste skeleton
// estrutural enquanto o detalhe da empresa carrega.
export default function Loading() {
  return <EmpresaDetalheSkeleton />;
}
