"use client";

import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import DashboardCliente from "@/components/portal-cliente/DashboardCliente";

export default function PortalInicioPage() {
  return (
    <PortalClienteLayout>
      <DashboardCliente />
    </PortalClienteLayout>
  );
}
