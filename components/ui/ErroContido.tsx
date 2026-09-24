"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Cerca em volta de um bloco da tela: se ele estourar em runtime, o resto da
 * página continua de pé.
 *
 * POR QUE ISTO EXISTE. O projeto não tinha NENHUM error boundary e nenhum
 * `error.tsx` — conferido em `components/`, `app/` e `lib/`. Numa página em que
 * vários blocos são renderizados lado a lado, isso significa que uma exceção em
 * qualquer um deles apaga a página inteira, levando junto os blocos que estavam
 * funcionando. A tela de movimentação é exatamente esse caso: Entrada,
 * Transferir e o histórico de transferências estão em uso hoje, com 119
 * equipamentos e 4 transferências reais atrás deles.
 *
 * ⚠️ E O DEPLOY NÃO PEGA ISSO. O healthcheck é `/api/health`; ele responde 200
 * com a página em branco, o rollback automático não dispara e o deploy fica
 * verde. É a mesma assinatura do incidente de 17/07–08/08, em que três rotas de
 * visão ficaram mortas por três semanas sem ninguém perceber.
 *
 * Só contém erro de RENDER. Erro dentro de `useQuery` já é tratado pelo próprio
 * react-query e não chega aqui.
 */

type Props = { titulo: string; children: React.ReactNode };
type State = { erro: Error | null };

export default class ErroContido extends React.Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    // Sem serviço de telemetria no projeto: o console é o que existe, e é o
    // que o operador consegue abrir quando alguém liga reclamando.
    console.error(`[ErroContido] ${this.props.titulo}`, erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {this.props.titulo} não pôde ser exibido
        </p>
        <p className="mt-1 text-sm text-amber-800">
          O resto da tela continua funcionando. Avise a TI com o horário — o detalhe do erro
          está no console do navegador.
        </p>
        <p className="mt-2 font-mono text-xs text-amber-700">{this.state.erro.message}</p>
      </div>
    );
  }
}
