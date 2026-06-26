"use client";

import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import NaoConformidadesCliente from "@/components/portal-cliente/NaoConformidadesCliente";

export default function PortalNaoConformidadesPage() {
  return (
    <PortalClienteLayout>
      <NaoConformidadesCliente />
    </PortalClienteLayout>
  );
}
