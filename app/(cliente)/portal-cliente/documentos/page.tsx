"use client";

import PortalClienteLayout from "@/components/portal-cliente/PortalClienteLayout";
import DocumentosCliente from "@/components/portal-cliente/DocumentosCliente";

export default function PortalDocumentosPage() {
  return (
    <PortalClienteLayout>
      <DocumentosCliente />
    </PortalClienteLayout>
  );
}
