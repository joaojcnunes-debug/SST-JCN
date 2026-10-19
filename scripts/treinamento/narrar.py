"""Etapa 3: gera a voz (edge-tts) e encaixa cada fala na linha do tempo do vídeo.

Uso: python narrar.py <pasta>/roteiro-<tag>.json

Como encaixa:
  - a tela é dividida em trechos RÍGIDOS (ações e qualquer movimento) e PARADOS (tela estática);
  - cada trecho de fala é preso a um evento (`em`). Com `ancora`, a palavra-âncora ("clica") começa
    no instante da ação; sem âncora, a fala começa 0,3 s depois do evento;
  - se a fala precisa de mais tempo antes do evento, o último trecho PARADO é congelado;
    se sobra silêncio, trechos PARADOS são encurtados. Trecho rígido nunca é cortado nem esticado.
Saídas na pasta do roteiro: voz/<hash>.mp3 (+ .json com o tempo de cada palavra),
sincronia-<tag>.json (lista de cortes, posição de cada voz, legendas) e relatorio-<tag>.txt.
Não gera vídeo (isso é o montar.py), então dá para ajustar o texto e rodar de novo em segundos.
Ver docs/treinamento-pipeline.md (Etapa 3).
"""
import asyncio, hashlib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import dur, ler, gravar, br, caminho

VOZ_PADRAO = 'pt-BR-FranciscaNeural'  # sempre esta (pedido do usuário)
GAP = 0.35          # respiro mínimo entre duas falas
GAP_INTERNO = 0.35  # entre trechos encadeados (sem `em`)
LEAD = 0.3          # fala sem âncora começa 0,3 s depois do evento
ANTECIPA = 0.1      # a palavra-âncora começa 0,1 s antes da ação
MAX_PAUSA = 1.0     # silêncio maior que isso entre falas → encurta tela parada
KEEP = 0.4          # tela parada nunca fica menor que isso
TAIL, FIM_MAX = 0.8, 1.6  # depois da última fala: mínimo e máximo de tela
MAX_CONGELA = 3.5   # congelar tela parada não aparece; acima disso o espectador nota a tela presa → reescrever
MAX_CONGELA_FIM = 6.0  # a última tela aguenta mais (fechamento)
MAX_SILENCIO = 2.5  # silêncio com tela se mexendo (não dá para cortar) → avisar
FOLGA_SEM_ANCORA = 1.5  # fala sem âncora pode atrasar até isso (na tela parada seguinte) em vez de congelar
WPS = 2.7           # palavras por segundo (só para sugerir quantas cortar)
LINHA, CUE = 42, 84 # legenda: 42 caracteres por linha, 2 linhas


# ── voz ─────────────────────────────────────────────────────────────
def falado(texto, pron):
    """Texto que vai para a voz: aplica o dicionário de pronúncia palavra a palavra."""
    out = []
    for tok in texto.replace('…', '...').split():
        m = re.match(r'^([^\w]*)(.*?)([^\w]*)$', tok)
        a, nucleo, z = m.groups()
        out.append(a + pron.get(nucleo, nucleo) + z)
    return out


def idioma_certo(voz):
    """O edge-tts manda todo pedido como xml:lang='en-US'. Voz multilíngue (Thalita) obedece e lê o começo
    da fala em inglês ("Achou a empresa?" saiu em outro idioma). Troca pelo idioma da voz ('pt-BR-…').
    (A tag <lang> o serviço do Edge recusa: "No audio was received".)"""
    import edge_tts.communicate as C
    lang = '-'.join(voz.split('-')[:2])
    if getattr(C.mkssml, '_lang', None) == lang:
        return
    def mkssml(tc, t):
        if isinstance(t, bytes): t = t.decode('utf-8')
        return (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{lang}'>"
                f"<voice name='{tc.voice}'><prosody pitch='{tc.pitch}' rate='{tc.rate}' volume='{tc.volume}'>{t}</prosody></voice></speak>")
    mkssml._lang = lang
    C.mkssml = mkssml


async def tts(texto, voz, ritmo, mp3):
    import edge_tts
    idioma_certo(voz)
    palavras = []
    for tentativa in range(4):
        try:
            c = edge_tts.Communicate(texto, voz, rate=ritmo, boundary='WordBoundary')
            palavras = []
            with open(mp3, 'wb') as f:
                async for ch in c.stream():
                    if ch['type'] == 'audio': f.write(ch['data'])
                    elif ch['type'] == 'WordBoundary':
                        palavras.append({'p': ch['text'], 'a': round(ch['offset'] / 1e7, 3), 'd': round(ch['duration'] / 1e7, 3)})
            return palavras
        except Exception as e:  # serviço on-line: tenta de novo
            if os.path.exists(mp3): os.remove(mp3)  # não deixa MP3 vazio no cache
            if tentativa == 3: raise SystemExit(f'edge-tts falhou: {e} (erro 403 persistente = edge-tts velho: rode instalar.sh)')
            await asyncio.sleep(2 + tentativa * 3)


def voz_de(texto_falado, voz, ritmo, pasta):
    os.makedirs(pasta, exist_ok=True)
    h = hashlib.sha1(f'{voz}|{ritmo}|lang2|{texto_falado}'.encode()).hexdigest()[:12]  # lang2 = SSML no idioma da voz
    mp3, js = os.path.join(pasta, h + '.mp3'), os.path.join(pasta, h + '.json')
    if not (os.path.exists(mp3) and os.path.exists(js)):
        pal = asyncio.run(tts(texto_falado, voz, ritmo, mp3))
        gravar(js, {'texto': texto_falado, 'palavras': pal, 'arquivo': dur(mp3)})
    info = ler(js)
    pal = info['palavras']
    return {'mp3': mp3, 'palavras': pal, 'ini': pal[0]['a'] if pal else 0.1,
            'fim': (pal[-1]['a'] + pal[-1]['d']) if pal else info['arquivo'], 'arquivo': info['arquivo']}


def tempo_dos_tokens(tokens_falados, palavras):
    """Início (no áudio) de cada token falado, alinhando as palavras do TTS pela posição no texto."""
    s = ' '.join(tokens_falados).lower(); pos, inicio_tok = [], []
    p = 0
    for tok in tokens_falados:
        inicio_tok.append(p); p += len(tok) + 1
    marcas, cur = [], 0
    for w in palavras:
        k = s.find(w['p'].lower(), cur)
        if k >= 0: marcas.append((k, w['a'])); cur = k + len(w['p'])
    out = []
    for c in inicio_tok:
        depois = [a for k, a in marcas if k >= c]
        out.append(depois[0] if depois else (marcas[-1][1] if marcas else 0))
    return out


def legendas(texto, t_tok, fim):
    """Divide o texto escrito em blocos de até 2 linhas e dá o tempo de cada um."""
    toks = texto.split(); blocos, atual = [], []
    for i, tok in enumerate(toks):
        cand = ' '.join(toks[j] for j in atual + [i])
        if atual and len(cand) > CUE:
            blocos.append(atual); atual = []
        atual.append(i)
        if re.search(r'[.?!…:;]$', tok) and len(' '.join(toks[j] for j in atual)) > 18:
            blocos.append(atual); atual = []
    if atual: blocos.append(atual)
    cues = []
    for n, b in enumerate(blocos):
        a = t_tok[b[0]]; z = t_tok[blocos[n + 1][0]] - 0.05 if n + 1 < len(blocos) else fim
        cues.append({'a': a, 'z': max(z, a + 0.8), 'texto': quebrar(' '.join(toks[j] for j in b))})
    return cues


def quebrar(t):
    if len(t) <= LINHA: return t
    meio, melhor = len(t) / 2, None
    for m in re.finditer(' ', t):
        if melhor is None or abs(m.start() - meio) < abs(melhor - meio): melhor = m.start()
    return t[:melhor] + '\n' + t[melhor + 1:]


# ── linha do tempo ─────────────────────────────────────────────────
def rigidos(eventos, movimento, total):
    iv = []
    for e in eventos:
        if e['tipo'] == 'passo': continue
        if e['tipo'] in ('digitar', 'movimento'): iv.append([e['ini'] - 0.1, e['fim'] + 0.2])
        else: iv.append([e['ini'] - 0.1, e['t'] + 0.35])  # cursor indo + clique; o resto vem do movimento medido
    iv = [[max(0, a), min(total, b)] for a, b in iv]
    iv += [list(m) for m in movimento]
    iv.sort(); out = []
    for a, b in iv:
        if out and a <= out[-1][1] + 0.05: out[-1][1] = max(out[-1][1], b)
        else: out.append([a, b])
    return out


def parados(rig, a, b):
    """Trechos parados dentro de [a, b]."""
    out, cur = [], a
    for x, y in rig:
        if y <= a or x >= b: continue
        if x > cur: out.append([cur, min(x, b)])
        cur = max(cur, y)
    if cur < b: out.append([cur, b])
    return [p for p in out if p[1] - p[0] > 0.04]


def editar(a, b, delta, rig):
    """Peças do trecho [a, b] da origem, esticado (delta > 0) ou encurtado (delta < 0) só na tela parada."""
    par = parados(rig, a, b); aviso = None
    if delta > 0.02:
        boas = [p for p in par if p[1] - p[0] >= 0.12]
        if boas: t = boas[-1][1] - 0.08
        else: t = max(a, b - 0.1); aviso = 'congelou durante movimento'
        return [('seg', a, t), ('frz', t, delta), ('seg', t, b)], aviso
    if delta < -0.02:
        corte = {}; falta = -delta
        for p in sorted(par, key=lambda p: p[0] - p[1]):
            cap = (p[1] - p[0]) - KEEP
            if cap <= 0 or falta <= 0: continue
            c = min(cap, falta); corte[tuple(p)] = c; falta -= c
        pecas, cur = [], a
        for p in par:
            c = corte.get(tuple(p))
            if not c: continue
            meio = (p[0] + p[1]) / 2
            pecas.append(('seg', cur, meio - c / 2)); cur = meio + c / 2
        pecas.append(('seg', cur, b))
        return pecas, aviso
    return [('seg', a, b)], aviso


def capacidade(rig, a, b):
    return sum(max(0, (p[1] - p[0]) - KEEP) for p in parados(rig, a, b))


def mapa(pecas):
    """Converte tempo da origem → tempo de saída usando a lista de peças."""
    def f(t):
        out = 0.0
        for tipo, x, y in pecas:
            if tipo == 'seg':
                if t <= y + 1e-6: return out + max(0.0, t - x)
                out += y - x
            else:
                out += y
        return out
    return f


def main():
    rp = sys.argv[1]; base = os.path.dirname(os.path.abspath(rp)); R = ler(rp)
    pron, voz, ritmo = R.get('pronuncia', {}), R.get('voz', 'pt-BR-FranciscaNeural'), R.get('ritmo', '+0%')
    if voz != VOZ_PADRAO:  # decisão do usuário (2026-10-19): sempre a Francisca, em todas as etapas
        raise SystemExit(f"roteiro com voz {voz}: o padrão é sempre {VOZ_PADRAO}. Corrija o campo 'voz' do roteiro.")
    pasta_voz = os.path.join(base, 'voz')
    video = caminho(base, R['video']); total = dur(video)
    ev = {e['id']: e for e in R['eventos']}
    rig = rigidos(R['eventos'], R.get('movimento', []), total)

    # trechos com fala → blocos (trecho sem `em` encadeia no anterior)
    trechos = [dict(t, id=t.get('id') or f'f{i:02d}') for i, t in enumerate(R['trechos'], 1) if t.get('fala', '').strip()]
    if R.get('fechamento', {}).get('fala', '').strip():
        trechos.append({'id': 'fechamento', 'fala': R['fechamento']['fala']})
    alertas, linhas = [], []
    for t in trechos:
        tok = falado(t['fala'], pron); v = voz_de(' '.join(tok), voz, ritmo, pasta_voz)
        t['_v'] = v; t['_tok'] = tok
        t['_ttok'] = tempo_dos_tokens(tok, v['palavras'])
        t['_fala'] = v['fim'] - v['ini']
        if t.get('em') and t['em'] not in ev: raise SystemExit(f"{t['id']}: evento {t['em']} não existe")
    blocos = []
    for t in trechos:
        if t.get('em') or not blocos: blocos.append([t])
        else: blocos[-1].append(t)

    pecas, cur, T, fim_voz, vozes = [], 0.0, 0.0, -GAP, []
    for bl in blocos:
        t0 = bl[0]; e = ev.get(t0.get('em')) or {'t': 0.0, 'tipo': 'passo', 'id': '-'}
        s = max(cur, e['t'])
        # w = quanto da fala vem antes do instante do evento
        w = -LEAD
        if t0.get('ancora'):
            alvo = t0['ancora'].lower()  # tokens escritos e falados são 1:1 (falado() troca palavra por palavra)
            idx = next((i for i, tk in enumerate(t0['fala'].split()) if re.sub(r'[^\w-]', '', tk.lower()).startswith(alvo)), None)
            if idx is None:
                alertas.append(f"{t0['id']}: âncora \"{t0['ancora']}\" não está na fala — fala ficou presa ao início do evento")
            else:
                w = t0['_ttok'][idx] - t0['_v']['ini'] + ANTECIPA
        N = s - cur; lo = fim_voz + GAP + w - T; hi = fim_voz + MAX_PAUSA + w - T
        xmin = N - capacidade(rig, cur, s)
        if not t0.get('ancora') and lo > N:  # sem âncora: atrasa a fala em vez de congelar a tela
            atraso = min(lo - N, FOLGA_SEM_ANCORA); w -= atraso; lo -= atraso; hi -= atraso
        x = N
        if x < lo: x = lo
        elif x > hi: x = max(hi, xmin, lo)
        delta = x - N
        p, aviso = editar(cur, s, delta, rig); pecas += p
        if delta > MAX_CONGELA:
            k = blocos.index(bl); ant = blocos[k - 1][-1] if k else None
            culpa = ant if ant and ant['_fala'] > t0['_fala'] else t0  # quem toma o tempo: em geral a fala anterior, mais longa
            alertas.append(f"{t0['id']}: congelou {br(delta)} s antes de {e['id']} — corte ~{int((delta - 0.8) * WPS) + 1} palavra(s) "
                           f"de {culpa['id']} ({len(culpa['fala'].split())} palavras)")
        if aviso:
            ant = blocos[blocos.index(bl) - 1][-1]['id'] if blocos.index(bl) else '-'
            alertas.append(f"{t0['id']}: {aviso} ({br(delta)} s): não há tela parada antes de {e['id']}. "
                           f"Encurte {ant}, ou encadeie {ant} no trecho anterior (tire o `em`) para ela ser dita antes da ação")
        T += x; cur = s
        ini = T - w
        if ini - fim_voz > MAX_SILENCIO and fim_voz > 0:
            alertas.append(f"{t0['id']}: {br(ini - fim_voz)} s sem fala antes (tela em movimento) — avalie uma fala curta no meio")
        for k, t in enumerate(bl):
            v = t['_v']
            if k: ini = fim_voz + GAP_INTERNO
            vozes.append({'id': t['id'], 'mp3': os.path.relpath(v['mp3'], base), 'arquivo_em': round(ini - v['ini'], 3),
                          'fala_de': round(ini, 3), 'fala_ate': round(ini + t['_fala'], 3),
                          'legendas': [{'a': round(c['a'] - v['ini'] + ini, 3), 'z': round(c['z'] - v['ini'] + ini, 3), 'texto': c['texto']}
                                       for c in legendas(t['fala'], t['_ttok'], v['fim'])]})
            linhas.append((t, e if k == 0 else None, delta if k == 0 else 0, ini))
            fim_voz = ini + t['_fala']
    # resto do vídeo depois do último evento
    N = total - cur; lo = fim_voz + TAIL - T; hi = fim_voz + FIM_MAX - T
    xmin = N - capacidade(rig, cur, total)
    x = N
    if x < lo: x = lo
    elif x > hi: x = max(hi, xmin, lo)
    if x - N > 0.02:
        pecas += [('seg', cur, total - 0.08), ('frz', total - 0.08, x - N + 0.08)]
        if x - N > MAX_CONGELA_FIM: alertas.append(f"final: congelou {br(x - N)} s na última tela — encurte a última fala ou o fechamento")
    else:
        p, _ = editar(cur, total, x - N, rig); pecas += p
    T += x
    pecas = [p for p in pecas if p[0] == 'frz' or p[2] - p[1] > 0.01]
    f = mapa(pecas)
    # a fala não pode começar antes da tela que ela descreve (troca de passo entre os dois eventos)
    marcos = sorted((e['t'], e['id']) for e in R['eventos'] if e['tipo'] in ('passo', 'pagina'))
    for v, (t, e, delta, ini) in zip(vozes, linhas):
        if not e: continue
        antes = [m for m in marcos if m[0] < e['t'] - 0.05 and f(m[0]) > ini + 0.3]
        if antes:
            alertas.append(f"{t['id']}: a fala começa {br(f(antes[-1][0]) - ini)} s antes da tela {antes[-1][1]} — encurte o que vem antes da âncora")

    vin = R.get('vinheta', {}).get('fala', '').strip()
    vinheta = None
    if vin:
        tok = falado(vin, pron); v = voz_de(' '.join(tok), voz, ritmo, pasta_voz)
        d = max(3.5, 0.5 + (v['fim'] - v['ini']) + 0.9)
        vinheta = {'dur': round(d, 2), 'mp3': os.path.relpath(v['mp3'], base), 'arquivo_em': round(0.5 - v['ini'], 3),
                   'legendas': [{'a': round(c['a'] - v['ini'] + 0.5, 3), 'z': round(c['z'] - v['ini'] + 0.5, 3), 'texto': c['texto']}
                                for c in legendas(vin, tempo_dos_tokens(tok, v['palavras']), v['fim'])]}
    gravar(os.path.join(base, f"sincronia-{R['tag']}.json"),
           {'tag': R['tag'], 'video': R['video'], 'duracao': round(T, 2), 'origem': round(total, 2),
            'pecas': [[a, round(b, 3), round(c, 3)] for a, b, c in pecas], 'vozes': vozes, 'vinheta': vinheta})

    # relatório
    rel = [f"{R['tag']} · origem {br(total)} s → narrado {br(T)} s (+ vinheta {br(vinheta['dur']) if vinheta else '0'} s) · voz {voz}", '']
    rel.append(f"{'trecho':10s} {'evento':6s} {'fala':>6s} {'pal':>4s} {'começa':>7s} {'tela':>8s}  texto")
    for t, e, delta, ini in linhas:
        aj = (f"+{br(delta)}" if delta > 0.05 else br(delta) if delta < -0.05 else '0') if e else ''
        rel.append(f"{t['id']:10s} {(e['id'] if e else '↳'):6s} {br(t['_fala']):>6s} {len(t['fala'].split()):>4d} {br(ini):>7s} {aj:>8s}  {t['fala'][:70]}")
    sil = max([b['fala_de'] - a['fala_ate'] for a, b in zip(vozes, vozes[1:])] or [0])
    rel += ['', f"maior silêncio entre falas: {br(sil)} s", '']
    rel += ['AJUSTAR:'] + [f'  - {a}' for a in alertas] if alertas else ['STATUS: OK — pode montar (montar.py).']
    txt = '\n'.join(rel)
    open(os.path.join(base, f"relatorio-{R['tag']}.txt"), 'w', encoding='utf-8-sig', newline='\r\n').write(txt + '\n')
    print(txt)


if __name__ == '__main__':
    main()
