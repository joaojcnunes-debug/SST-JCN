// Modelo de gravação de um módulo (copie para a pasta de produção como rec-<tag>.js e troque as telas).
// Rodar (Git Bash):
//   MSYS_NO_PATHCONV=1 NODE_PATH=C:/Users/Usuario/ferramentas/pw/node_modules MODE=debug node rec-<tag>.js
// MODE=debug: só navega num registro de rascunho, não salva. MODE=final: cria e salva (empresa de teste!).
// Ver docs/treinamento-pipeline.md (Etapa 1).
const path = require('path');
const { iniciar } = require('C:/Users/Usuario/sst-jcn/scripts/treinamento/gravador.js');

const BASE = process.env.BASE_URL || 'https://painel-sst.chabra.com.br';
const FINAL = process.env.MODE === 'final';
const TAG = process.env.TAG || 'modulo-m1';
const CHROME = process.env.CHROME_PATH || 'C:/Users/Usuario/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

// Privacidade (Painel = produção): esconde a lista de empresas até o filtro da empresa de teste valer.
const PRIVACIDADE = () => {
  const st = document.createElement('style');
  st.textContent = 'html.__oculta ul.max-h-64{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(st);
};

(async () => {
  const g = await iniciar({
    tag: TAG, pasta: path.join(__dirname, '..', 'gravacao'), chrome: CHROME,
    estado: path.join(__dirname, 'state.json'),   // sessão exportada do login (segredo: apagar ao fim)
    extraInit: PRIVACIDADE,
  });
  const { p } = g;
  try {
    await p.goto(BASE + '/inspecoes');
    await p.getByRole('heading', { name: /Inspe/ }).first().waitFor();
    await g.sync();                                   // sempre logo depois da primeira página carregar

    // Um passo = uma tela/assunto. A fala de rascunho só estima quanto tempo a tela fica parada;
    // a fala de verdade é escrita depois, no roteiro.
    await g.passo('Lista de inspeções', { fala: 'Essa é a tela de Inspeções. Tudo que já foi feito aparece aqui.' });
    await g.clicar(p.getByRole('button', { name: 'Nova Inspeção' }), 'Nova Inspeção');

    await g.passo('Passo 1: empresa', { ms: 3000 });
    await g.clicar(p.getByRole('button', { name: /Selecione uma empresa/ }), 'abrir lista de empresas');
    await g.digitar(p.getByPlaceholder(/Buscar/), 'TESTE', 'buscar empresa');
    await g.clicar(p.getByRole('option', { name: /TESTE/ }).first(), 'escolher empresa');
    await g.print('01-empresa');
    if (FINAL) await g.clicar(p.getByRole('button', { name: 'Próximo' }), 'Próximo');
  } finally {
    await g.fim();                                    // grava <tag>.webm e eventos-<tag>.json
  }
})().catch((e) => { console.error('ERRO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
