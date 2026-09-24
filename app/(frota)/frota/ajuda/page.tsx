"use client";

import Link from "next/link";
import {
  Building2,
  Camera,
  Fuel,
  History,
  MapPin,
  Trash2,
  TriangleAlert,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";
import AjudaComAbas from "@/components/novidades/AjudaComAbas";

/**
 * Ajuda do módulo. Escrita para o condutor e para o gerente, não para quem
 * programou: explica o que o sistema espera e por quê, sem falar de tabela.
 */
function ConteudoAjudaFrotaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Como funciona a Frota</h1>
        <p className="text-sm text-gray-500">
          Cadastro do veículo, saída com fotos, e o histórico que fica.
        </p>
      </div>

      <Bloco icone={Truck} titulo="O cadastro do veículo acontece uma vez">
        <p>
          Placa, modelo, a base e o <strong>km de hoje</strong>. O km do cadastro é a referência de
          tudo que vem depois — por isso ele não pode ser alterado.
        </p>
        <p>
          Na hora do cadastro, escreva as <strong>avarias que já existem</strong>: o que já estava
          amassado, riscado ou trincado. É essa lista que aparece para o condutor em cada saída, e
          é ela que permite saber depois o que é dano novo e o que já era assim.
        </p>
      </Bloco>

      <Bloco icone={Camera} titulo="A saída pede quatro fotos, e não abre exceção">
        <p>
          Frente, lateral direita, traseira e lateral esquerda — na ordem da volta no carro. A saída
          <strong> não finaliza</strong> sem as quatro. Não é rigor da tela: o próprio banco recusa,
          então não existe caminho que passe por fora.
        </p>
        <p>
          O registro é salvo a cada passo. Se o sinal cair ou o navegador fechar no meio, as fotos
          já enviadas ficam e você continua de onde parou pela ficha do veículo.
        </p>
        <p>
          As fotos são reduzidas no próprio celular antes de subir. É o que faz a foto ir rápido no
          4G do pátio, e o que deixa a galeria abrir sem demora depois.
        </p>
      </Bloco>

      <Bloco icone={Undo2} titulo="A viagem só termina quando alguém registra a volta">
        <p>
          Toda saída fica marcada como <strong>na rua</strong> até que o retorno seja registrado. É
          isso que faz o painel saber quais carros estão fora, com quem e há quantos dias — e é a
          única informação que o sistema não consegue deduzir sozinho.
        </p>
        <p>
          O <strong>km da volta é opcional</strong>. Quem lança o retorno nem sempre é quem dirigiu,
          e é melhor a viagem fechar sem o número do que fechar com um número inventado: número
          chutado entra na conta de consumo como se fosse medição.
        </p>
        <p>
          Se o carro voltou ontem e você só está lançando hoje, corrija a data — ela vem preenchida
          com agora só por conveniência. Registrou errado? Dá para reabrir a viagem.
        </p>
      </Bloco>

      <Bloco icone={Building2} titulo="Mudar de base é diferente de viajar">
        <p>
          <strong>Viagem</strong> é ir ao cliente e voltar: a base do veículo não muda.{" "}
          <strong>Mudança de base</strong> é o carro passar a pertencer a outra unidade — ele some
          da lista de quem cuidava dele e aparece na de outra pessoa.
        </p>
        <p>
          A base de origem não é digitada: o sistema usa a base real em que o carro está. E o
          histórico antigo <strong>não muda</strong> — as saídas antigas aconteceram na base
          anterior e continuam registradas assim.
        </p>
      </Bloco>

      <Bloco icone={Wrench} titulo="Manutenção avisa da próxima">
        <p>
          Registre o que foi feito, a oficina e o valor. Se preencher a{" "}
          <strong>próxima revisão</strong> — por data, por quilometragem, ou as duas — o painel
          avisa pela que chegar primeiro.
        </p>
        <p>
          Registrar manutenção <strong>não muda</strong> a situação do veículo sozinho. Se o carro
          ficou parado, mude a situação para Em manutenção — o painel aponta quando as duas coisas
          discordam.
        </p>
      </Bloco>

      <Bloco icone={History} titulo="O histórico conta a vida do carro">
        <p>
          Na ficha do veículo, a aba <strong>Histórico</strong> junta tudo em ordem: cadastro,
          saídas, retornos, o percurso de cada viagem, abastecimentos, sinistros, manutenções e
          mudanças de base.
        </p>
        <p>
          O filtro <strong>&ldquo;só o que deu problema&rdquo;</strong> deixa na tela apenas o que
          quebrou, amassou ou precisou de conserto. É a visão para quando se quer decidir se vale a
          pena manter o veículo.
        </p>
      </Bloco>

      <Bloco icone={MapPin} titulo="O endereço vira rota, não alfinete">
        <p>
          Digite o CEP e o resto se completa. O botão do Google Maps abre <strong>já em modo de
          navegação</strong>, no aplicativo do celular quando ele está instalado.
        </p>
        <p>
          Se alguém compartilhou um pin com você, cole o link no campo próprio — ele tem preferência
          sobre o endereço digitado, porque quem mandou o pin tinha o lugar exato.
        </p>
        <p>
          Corrigir o endereço depois corrige o link automaticamente. O link nunca é guardado pronto.
        </p>
      </Bloco>

      <Bloco icone={Fuel} titulo="Abastecimento: nada é calculado">
        <p>
          Litros, valor por litro e valor total são três campos independentes. O sistema{" "}
          <strong>não soma nem sugere</strong> nada — o preço do litro varia de posto para posto, e
          uma conta automática só criaria divergência com o cupom.
        </p>
        <p>
          O comprovante aceita <strong>qualquer formato</strong>: foto, PDF ou outro. E aceita mais
          de um, porque no cartão-frota costuma vir o cupom da bomba e o comprovante da máquina.
        </p>
        <p>
          Se você informar o km do odômetro, ele atualiza o registro do veículo — desde que seja
          maior que o atual. O km de um veículo nunca volta atrás.
        </p>
      </Bloco>

      <Bloco icone={TriangleAlert} titulo="Sinistro tem situação, não só data">
        <p>
          Aberto, em análise, em reparo, encerrado ou negado. É o que transforma a aba em histórico
          útil, em vez de uma pilha de ocorrências sem desfecho.
        </p>
        <p>
          Marcar <strong>com vítima</strong> registra o fato, mas não abre Investigação de Acidente
          de Trabalho automaticamente. Abrir é decisão de quem conduz o caso.
        </p>
      </Bloco>

      <Bloco icone={Trash2} titulo="Nada é apagado de verdade">
        <p>
          Excluir uma saída, um sinistro, uma manutenção ou um abastecimento move o registro para a{" "}
          <strong>lixeira</strong>, com o retrato completo do que havia ali e o nome de quem
          excluiu. Dá para restaurar.
        </p>
        <p>
          <strong>Veículo com histórico não é excluído.</strong> Se o carro já tem saída,
          abastecimento, sinistro, manutenção ou mudança de base registrados, o sistema recusa e
          explica: é esse histórico que prova avaria, km rodado e custo. Para tirar o carro de
          operação, mude a situação para <strong>Vendido</strong> ou <strong>Inativo</strong> — ele
          sai do dia a dia e o histórico continua consultável.
        </p>
        <p>
          As fotos no armazenamento continuam lá justamente por isso — é o que permite a restauração
          reabrir as imagens.
        </p>
      </Bloco>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800">Não encontrou o veículo?</p>
        <p className="mt-1">
          A lista mostra só as bases às quais você tem acesso. Se o veículo está em outra base, fale
          com o TI para liberar. E se ele foi excluído, ele está na lixeira, não perdido.
        </p>
        <Link href="/frota" className="mt-3 inline-block font-medium text-blue-600 hover:underline">
          Voltar para a frota
        </Link>
      </div>
    </div>
  );
}

function Bloco({
  icone: Icone,
  titulo,
  children,
}: {
  icone: typeof Truck;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Icone className="size-4 text-blue-600" />
        {titulo}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

/**
 * A ajuda deste módulo ganhou a aba Atualizações (01/09). O conteúdo acima
 * continua exatamente como estava — quem monta as abas é o AjudaComAbas, e a
 * lista de novidades vive num componente só, compartilhado pelos 11 módulos.
 */
export default function AjudaFrotaPage() {
  return (
    <AjudaComAbas titulo="Guia da Frota">
      <ConteudoAjudaFrotaPage />
    </AjudaComAbas>
  );
}
