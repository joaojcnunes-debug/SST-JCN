import type { Metadata } from "next";
import PaginaLegal from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Termos de Serviço · SST JCN Consultoria" };

const CONTATO = "joaojcnunes@gmail.com";

export default function TermosPage() {
  return (
    <PaginaLegal titulo="Termos de Serviço" atualizado="23/10/2026">
      <p>
        Estes termos valem para quem usa o <b>SST JCN</b>, o sistema interno da JCN Consultoria para a gestão de Segurança
        e Saúde no Trabalho. Ao entrar no sistema, você concorda com eles.
      </p>

      <section>
        <h2>1. Acesso</h2>
        <ul>
          <li>O acesso é pessoal e liberado pela JCN Consultoria. Não compartilhe seu login e sua senha.</li>
          <li>Cada perfil vê só os módulos, as unidades e as empresas liberados para ele.</li>
          <li>A JCN Consultoria pode suspender um acesso em caso de uso indevido ou fim do vínculo.</li>
        </ul>
      </section>

      <section>
        <h2>2. Uso correto</h2>
        <ul>
          <li>Use o sistema apenas para as atividades de SST da JCN Consultoria e dos seus clientes.</li>
          <li>
            Os dados de empresas e trabalhadores são confidenciais: não copie, divulgue nem use essas informações fora do
            serviço.
          </li>
          <li>Você é responsável pelas informações que registra; as alterações ficam registradas com autor, data e hora.</li>
        </ul>
      </section>

      <section>
        <h2>3. Integrações opcionais</h2>
        <p>
          Recursos como a integração com o Google Agenda são opcionais e só funcionam depois da sua autorização. Eles seguem a{" "}
          <a href="/privacidade">Política de Privacidade</a> e podem ser desligados a qualquer momento.
        </p>
      </section>

      <section>
        <h2>4. Disponibilidade</h2>
        <p>
          O sistema pode passar por atualizações e paradas de manutenção. Os documentos gerados (laudos, relatórios e PDFs)
          devem ser conferidos pelo profissional responsável antes de serem entregues.
        </p>
      </section>

      <section>
        <h2>5. Alterações e contato</h2>
        <p>
          Estes termos podem ser atualizados; a data no topo indica a versão em vigor. Dúvidas:{" "}
          <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>
      </section>
    </PaginaLegal>
  );
}
