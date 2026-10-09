// Gravador comum dos treinamentos (Playwright headless, 1600×900).
// Registra cada passo e cada ação com o tempo (eventos-<tag>.json) para o planejar.py.
// Ver docs/treinamento-pipeline.md (Etapa 1).
//
// Uso no rec-<tag>.js:
//   const { iniciar } = require('<repo>/scripts/treinamento/gravador.js');
//   const g = await iniciar({ tag: 'insp-m1', pasta: OUT, estado: 'state.json', chrome: process.env.CHROME_PATH });
//   await g.p.goto(BASE + '/inspecoes'); await g.sync();
//   await g.passo('Lista de inspeções', { fala: 'rascunho da fala, só para estimar a espera' });
//   await g.clicar(g.p.getByRole('button', { name: 'Nova Inspeção' }), 'Nova Inspeção');
//   await g.fim();
// playwright-core vem de C:/Users/Usuario/ferramentas/pw (NODE_PATH aponta para lá).
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright-core'); } catch { return require('C:/Users/Usuario/ferramentas/pw/node_modules/playwright-core'); }
})();

const CURSOR_E_LEGENDA = () => {
  const mk = () => {
    if (document.getElementById('__cur')) return;
    const d = document.createElement('div');
    d.id = '__cur';
    d.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,.5);border:2px solid #b91c1c;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:left .3s,top .3s,width .15s,height .15s';
    document.body.appendChild(d);
    document.addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { d.style.width = '40px'; d.style.height = '40px'; setTimeout(() => { d.style.width = '22px'; d.style.height = '22px'; }, 260); }, true);
    const c = document.createElement('div');
    c.id = '__cap';
    c.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);max-width:80%;background:rgba(18,55,42,.95);color:#F5F7F2;font:600 22px/1.35 Arial,sans-serif;padding:12px 22px;border-radius:12px;border-left:6px solid #F0B866;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none;z-index:2147483646;display:none;text-align:left';
    document.body.appendChild(c);
    const saved = sessionStorage.getItem('__capText');
    if (saved) { c.textContent = saved; c.style.display = 'block'; }
    window.__cap = (t) => { sessionStorage.setItem('__capText', t || ''); c.textContent = t || ''; c.style.display = t ? 'block' : 'none'; };
    // Capa de privacidade: cobre a página inteira enquanto uma lista pode mostrar clientes reais.
    const cob = document.createElement('div');
    cob.id = '__cob';
    cob.style.cssText = 'position:fixed;inset:0;background:#12372A;color:#F5F7F2;font:700 40px Arial,sans-serif;display:none;align-items:center;justify-content:center;z-index:2147483645;pointer-events:none';
    document.body.appendChild(cob);
    if (sessionStorage.getItem('__cob')) { cob.textContent = sessionStorage.getItem('__cob'); cob.style.display = 'flex'; }
    window.__cobre = (t) => { if (t) { sessionStorage.setItem('__cob', t); cob.textContent = t; cob.style.display = 'flex'; } else { sessionStorage.removeItem('__cob'); cob.style.display = 'none'; } };
    // Máscara de privacidade: esconde SÓ a lista (seletor) e desenha uma caixa no lugar dela, para o
    // espectador continuar vendo o campo de busca e a digitação. O CSS fica num <style> dentro do body.
    const mb = document.createElement('div');
    mb.id = '__mskbox';
    mb.style.cssText = 'position:fixed;display:none;background:#12372A;color:#F5F7F2;font:600 15px Arial,sans-serif;align-items:center;justify-content:center;border-radius:8px;z-index:2147483644;pointer-events:none';
    document.body.appendChild(mb);
    const seguir = () => {
      const sel = window.__mskSel; const el = sel && document.querySelector(sel);
      const r = el && el.getBoundingClientRect();
      if (r && r.width > 4 && r.height > 4) {
        Object.assign(mb.style, { display: 'flex', left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
      } else mb.style.display = 'none';
      requestAnimationFrame(seguir);
    };
    requestAnimationFrame(seguir);
    window.__mascara = (sel, texto) => {
      document.getElementById('__msk')?.remove();
      window.__mskSel = sel || null;
      if (!sel) { mb.style.display = 'none'; return; }
      const st = document.createElement('style'); st.id = '__msk';
      st.textContent = sel + '{visibility:hidden!important}';
      document.body.appendChild(st);
      mb.textContent = texto || 'Filtrando…';
    };
    window.__flash = () => {
      const f = document.createElement('div');
      f.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:2147483647;pointer-events:none';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 400);
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
};

async function iniciar(o) {
  // A página é desenhada em 1280×720 e o planejar.py amplia o vídeo para 1600×900: tudo ~25% maior,
  // legível no celular/projetor. Os prints saem em 1600×900 nítidos (deviceScaleFactor).
  const VW = o.vw || 1280, VH = o.vh || 720, ESC = 1600 / VW;
  const FAIXA = Math.round(175 / ESC); // faixa de baixo reservada à legenda (em px da página)
  const pasta = o.pasta; fs.mkdirSync(pasta, { recursive: true });
  const prints = path.join(pasta, 'prints'); fs.mkdirSync(prints, { recursive: true });
  const tmpVideo = path.join(pasta, '.video-' + o.tag);
  const browser = await chromium.launch({ headless: true, executablePath: o.chrome || undefined });
  const ctx = await browser.newContext({
    storageState: o.estado || undefined,
    viewport: { width: VW, height: VH },
    deviceScaleFactor: ESC,
    locale: 'pt-BR',
    recordVideo: { dir: tmpVideo, size: { width: VW, height: VH } }, // o planejar.py amplia para 1600×900
  });
  await ctx.addInitScript(CURSOR_E_LEGENDA);
  if (o.extraInit) await ctx.addInitScript(o.extraInit); // ex.: esconder listas com clientes reais
  const p = await ctx.newPage();
  p.setDefaultTimeout(o.timeout || 30000);
  const T0 = Date.now();
  const agora = () => +((Date.now() - T0) / 1000).toFixed(3);
  const ev = [];
  let sync = null, n = 0, privacidadeFalhou = false;
  const w = (ms) => p.waitForTimeout(ms);
  const legenda = async (t) => { if (o.legendaNaTela) await p.evaluate((t) => window.__cap && window.__cap(t), t).catch(() => {}); };
  const reg = (tipo, rotulo, ini, t, fim) => { const e = { id: 'e' + String(++n).padStart(2, '0'), tipo, rotulo, ini, t, fim }; ev.push(e); return e; };

  const g = {
    p, ctx, w,
    // Quadro magenta de 0,4 s: o planejar.py acha no vídeo e acerta o relógio (sem OFF empírico).
    async sync() {
      // Treinamento é SEMPRE gravado no Painel SST (file:// só para testar o próprio gravador).
      const u = new URL(p.url());
      if (u.protocol !== 'file:' && u.hostname !== 'painel-sst.chabra.com.br') throw new Error('gravação fora do Painel SST: ' + u.hostname);
      await p.evaluate(() => window.__flash && window.__flash()); sync = agora(); await w(900);
    },
    // Começo de um passo (troca de assunto). A tela fica parada `ms` (ou o tempo estimado da fala).
    async passo(rotulo, opt = {}) {
      await legenda(rotulo);
      const t = agora(); reg('passo', rotulo, t, t, t);
      const pal = opt.fala ? opt.fala.split(/\s+/).length : 0;
      await w(Math.max(opt.ms || 2500, Math.round(pal / 2.6 * 1000) + 600));
    },
    // Ação genérica: `fn` faz a ação. `t` = momento da ação (o verbo da fala cai aqui).
    async acao(rotulo, fn, tipo = 'acao', depois = 600) {
      const ini = agora(); await fn(); const t = g._t || ini; g._t = null;
      await w(depois); return reg(tipo, rotulo, ini, t, agora());
    },
    // Clique com o cursor chegando antes (o espectador vê para onde vai).
    async clicar(loc, rotulo, depois = 700) {
      return g.acao(rotulo, async () => {
        await g.seguro(loc); await loc.hover(); await w(450);
        g._t = agora(); await loc.click();
      }, 'clique', depois);
    },
    async digitar(loc, txt, rotulo, atraso = 35) {
      return g.acao(rotulo || 'digitar', async () => {
        await g.seguro(loc); await loc.hover(); await w(350);
        g._t = agora(); await loc.click(); await loc.pressSequentially(txt, { delay: atraso });
      }, 'digitar', 400);
    },
    async escolher(loc, opcao, rotulo) {
      return g.acao(rotulo || 'escolher', async () => {
        await g.seguro(loc); await loc.hover(); await w(350);
        g._t = agora(); await loc.selectOption(opcao);
      }, 'escolher', 600);
    },
    // Passa o cursor por cima sem clicar (ex.: apontar cada opção enquanto a fala cita).
    async apontar(loc, rotulo, depois = 900) {
      // t = quando o cursor CHEGA (a transição do cursor leva 0,3 s)
      return g.acao(rotulo || 'apontar', async () => { await g.seguro(loc); await loc.hover(); await w(350); g._t = agora(); }, 'apontar', depois);
    },
    // Zona segura: rola até o alvo ficar inteiro na tela e ACIMA da faixa da legenda (embaixo).
    // Se não há mais o que rolar (último botão da página), põe um espaçador no fim e rola.
    async seguro(loc) {
      await loc.scrollIntoViewIfNeeded();
      const h = await loc.elementHandle();
      const dy = await h.evaluate((el, [lim, topo]) => {
        const r = el.getBoundingClientRect();
        let dy = 0;
        if (r.bottom > lim) dy = r.bottom - lim + 24; else if (r.top < topo) dy = r.top - topo;
        if (Math.abs(dy) < 3) return 0;
        let sc = el.parentElement;
        while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
        sc = sc || document.scrollingElement;
        const falta = dy - (sc.scrollHeight - sc.clientHeight - sc.scrollTop);
        if (dy > 0 && falta > 0) {
          let e = document.getElementById('__espaco');
          if (!e) { e = document.createElement('div'); e.id = '__espaco'; (sc === document.scrollingElement ? document.body : sc).appendChild(e); }
          e.style.height = (parseFloat(e.style.height || '0') + falta + 40) + 'px';
        }
        sc.scrollBy({ top: dy, behavior: 'smooth' });
        return dy;
      }, [VH - FAIXA, 70]);
      if (dy) await w(700);
      const b = await loc.boundingBox();
      if (b && b.y + b.height > VH - FAIXA + 2) console.log(`AVISO: alvo continua sob a faixa da legenda (${Math.round(b.y + b.height)} > ${VH - FAIXA})`);
    },
    // Rola a página até o elemento (a página rola no documento, não num contêiner).
    async foco(loc, off = 90, rotulo = 'rolar') {
      return g.acao(rotulo, async () => {
        g._t = agora();
        await loc.evaluate((e, off) => { const y = e.getBoundingClientRect().top + window.scrollY - off; window.scrollTo({ top: y, behavior: 'smooth' }); }, off);
        await w(900);
      }, 'rolar', 300);
    },
    // Privacidade (Painel = produção): cubra ANTES de abrir qualquer lista que mostre empresas/pessoas,
    // filtre até sobrar só o registro de teste, confira e só então descubra. Aborta se a capa não estiver no topo.
    async cobrir(texto = 'Buscando a empresa de teste…') {
      await p.evaluate((t) => window.__cobre(t), texto);
      // elementFromPoint ignora pointer-events:none: liga só durante a conferência
      const ok = await p.evaluate(() => {
        const c = document.getElementById('__cob'); if (!c) return false;
        c.style.pointerEvents = 'auto';
        const W = innerWidth, H = innerHeight;
        const r = [[W / 2, H / 2], [20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]].every(([x, y]) => document.elementFromPoint(x, y) === c);
        c.style.pointerEvents = 'none'; return r;
      });
      if (!ok) throw new Error('capa de privacidade não cobriu a tela: gravação abortada');
    },
    async descobrir(depois = 500) { await p.evaluate(() => window.__cobre('')); await w(depois); },
    // Privacidade só na lista (preferível à capa): chame ANTES de abrir a lista. Esconde `sel` e desenha
    // uma caixa no lugar; o campo de busca e a digitação continuam visíveis.
    async mascarar(sel, texto = 'Filtrando a empresa de teste…') { await p.evaluate(([s, t]) => window.__mascara(s, t), [sel, texto]); },
    // Depois que a lista abriu: confere que TUDO que casa com `sel` está invisível. Senão aborta
    // (o vídeo desta gravação não pode ser usado).
    async conferirMascara(sel) {
      await p.locator(sel).first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
      const ok = await p.evaluate((s) => {
        const els = [...document.querySelectorAll(s)];
        const todos = els.flatMap((e) => [e, ...e.querySelectorAll('*')]); // um item com visibility:visible escaparia
        return els.length > 0 && todos.every((e) => getComputedStyle(e).visibility === 'hidden');
      }, sel);
      if (!ok) { privacidadeFalhou = true; throw new Error('máscara de privacidade não escondeu a lista: gravação descartada'); }
    },
    async desmascarar(depois = 500) { await p.evaluate(() => window.__mascara(null)); await w(depois); },
    // Print sem legenda e sem cursor.
    async print(nome) {
      await p.evaluate(() => { for (const id of ['__cap', '__cur']) { const e = document.getElementById(id); if (e) { e.dataset.v = e.style.visibility; e.style.visibility = 'hidden'; } } });
      await p.screenshot({ path: path.join(prints, nome + '.png') });
      await p.evaluate(() => { for (const id of ['__cap', '__cur']) { const e = document.getElementById(id); if (e) e.style.visibility = e.dataset.v || ''; } });
    },
    async fim() {
      await legenda('');
      await w(1200);
      const total = agora();
      const v = p.video();
      await ctx.close(); await browser.close();
      const webm = path.join(pasta, o.tag + '.webm');
      if (v && !privacidadeFalhou) fs.copyFileSync(await v.path(), webm);
      fs.rmSync(tmpVideo, { recursive: true, force: true }); // falha de privacidade: o vídeo é apagado, não salvo
      if (privacidadeFalhou) console.log('PRIVACIDADE: vídeo apagado. Corrija o seletor da máscara e grave de novo.');
      const out = path.join(pasta, 'eventos-' + o.tag + '.json');
      fs.writeFileSync(out, JSON.stringify({ tag: o.tag, video: path.basename(webm), sync, total, privacidadeFalhou, eventos: ev }, null, 1));
      console.log('VIDEO', webm); console.log('EVENTOS', out);
      if (sync === null) console.log('AVISO: g.sync() não foi chamado; o planejar.py vai usar OFF=0,55 s.');
    },
  };
  return g;
}

module.exports = { iniciar };
