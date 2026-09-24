"use client";

import ModuleTopbar from "./ModuleTopbar";

// Casca fina das rotas que nao tem layout de modulo proprio. A barra monta a
// trilha sozinha a partir do pathname, entao aqui nao ha nada a calcular.
export default function Topbar() {
  return <ModuleTopbar />;
}
