"use client";

import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import PendenciasCliente from "@/components/portal-cliente/PendenciasCliente";

export default function PortalPendenciasPage() {
  return (
    <PortalClienteLayout>
      <PendenciasCliente />
    </PortalClienteLayout>
  );
}
