import type { Metadata } from "next";
import PaginaLegal from "@/components/legal/PaginaLegal";

export const metadata: Metadata = { title: "Política de Privacidade · SST JCN Consultoria" };

const CONTATO = "joaojcnunes@gmail.com";

export default function PrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="23/10/2026">
      <p>
        O <b>SST JCN</b> é o sistema interno da JCN Consultoria para a gestão de Segurança e Saúde no Trabalho dos seus
        clientes. Esta política explica quais dados o sistema trata, para quê, e como você pode pedir acesso, correção ou
        exclusão, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <section>
        <h2>1. Quem usa o sistema</h2>
        <p>
          O acesso é restrito a pessoas cadastradas pela JCN Consultoria (equipe interna e, quando liberado, clientes),
          com login e senha. Não há cadastro aberto ao público.
        </p>
      </section>

      <section>
        <h2>2. Dados tratados</h2>
        <ul>
          <li>Dados de cadastro de quem usa: nome, e-mail, perfil de acesso e unidade.</li>
          <li>
            Dados dos trabalhos de SST: empresas atendidas, inspeções, laudos, avaliações e documentos, inclusive dados de
            trabalhadores das empresas clientes quando necessários ao serviço contratado.
          </li>
          <li>Registros técnicos de uso (data, hora e autor das alterações), para segurança e auditoria.</li>
        </ul>
      </section>

      <section>
        <h2>3. Integração com o Google Agenda</h2>
        <p>
          A integração é opcional e só é ativada quando a própria pessoa clica em <b>Conectar</b> no módulo Gestão e
          autoriza o acesso na tela do Google. Com essa autorização, o sistema:
        </p>
        <ul>
          <li>
            cria, atualiza e remove na sua agenda os eventos das tarefas da Gestão em que você é responsável ou seguidor
            (permissão <code>calendar.events</code>);
          </li>
          <li>
            lê os eventos que você mesmo cria na sua agenda principal, a partir da conexão, para transformá-los em tarefas no
            seu Meu Quadro, com os convidados internos como responsáveis;
          </li>
          <li>
            lê o nome e a foto do seu perfil Google (permissão <code>userinfo.profile</code>), para mostrar a foto no lugar
            das iniciais dentro do sistema.
          </li>
        </ul>
        <p>
          O token de acesso fica guardado <b>cifrado</b> no banco de dados do sistema e nunca é exibido. Os dados do Google
          são usados só para essas funções: não são vendidos, não são usados para publicidade, não são repassados a
          terceiros e não são usados para treinar modelos de inteligência artificial. O uso de informações recebidas das
          APIs do Google segue a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>
        <p>
          Você pode desligar a integração a qualquer momento pelo botão <b>Desconectar</b> (Gestão › Meu Espaço › Google
          Agenda), que apaga o token e o vínculo da sua conta, ou revogando o acesso em{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section>
        <h2>4. Onde os dados ficam</h2>
        <p>
          Os dados ficam em serviços de nuvem contratados pela JCN Consultoria (banco de dados e hospedagem do sistema), com
          acesso protegido por login e regras de permissão por perfil e unidade. Avisos por e-mail, quando ativados, são
          enviados por um serviço de envio de e-mail.
        </p>
      </section>

      <section>
        <h2>5. Por quanto tempo</h2>
        <p>
          Os registros de SST são mantidos pelo prazo exigido pelas normas de segurança e saúde no trabalho e pelos
          contratos com os clientes. Os dados da integração com o Google são apagados quando você desconecta a conta.
        </p>
      </section>

      <section>
        <h2>6. Seus direitos</h2>
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção ou exclusão dos seus dados, e tirar dúvidas sobre esta
          política, pelo e-mail <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>
      </section>
    </PaginaLegal>
  );
}
