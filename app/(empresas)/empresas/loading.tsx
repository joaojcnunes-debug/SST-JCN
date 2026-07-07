import { EmpresaListaSkeleton } from "@/components/empresas/EmpresaSkeletons";

// Fallback de navegação (Suspense de rota): a transição aterrissa neste skeleton
// estrutural enquanto o segmento carrega.
export default function Loading() {
  return <EmpresaListaSkeleton />;
}
