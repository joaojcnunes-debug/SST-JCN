"use client";

import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import SolicitacoesCliente from "@/components/portal-cliente/SolicitacoesCliente";

export default function PortalSolicitacoesPage() {
  return (
    <PortalClienteLayout>
      <SolicitacoesCliente />
    </PortalClienteLayout>
  );
}
