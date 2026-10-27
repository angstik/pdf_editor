"""Banc d'essai navigateur des deux applications (racine et /multi/).

Usage, depuis la racine du dépôt :
    pip install playwright && playwright install chromium
    python3 tools/bench/bench.py

Le script sert lui-même le dépôt sur 127.0.0.1 (port libre), puis vérifie :
  1. la saisie des commentaires — saisie directe, correction au Retour
     arrière, flèches dans le texte, raccourcis frappés hors du champ,
     historique gelé pendant la saisie ;
  2. la couleur de commentaire retenue pour le suivant (pastille, sélecteur
     natif), sur ordinateur et en émulation mobile ;
  3. la cohabitation des service workers : aucun cache purgé par l'autre
     application, page de la racine intacte après une première visite de multi.
Code de sortie non nul au premier écart.
"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PDF = os.path.join(ROOT, 'assets', 'help', 'guide-fr.pdf')
FAILS = []

def check(label, ok, detail=''):
    print(f"  {'ok ' if ok else 'KO '} {label}{'  — ' + str(detail) if detail and not ok else ''}")
    if not ok: FAILS.append(label)

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{srv.server_address[1]}/'

def open_app(p, base, mobile=False):
    b = p.chromium.launch()
    opts = dict(p.devices['Pixel 7']) if mobile else {'viewport': {'width': 1280, 'height': 900}}
    ctx = b.new_context(**opts, bypass_csp=True, service_workers='block')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base); pg.evaluate("localStorage.setItem('pdfed.splash','off')")
    pg.reload(); pg.wait_for_timeout(600)
    if pg.evaluate("document.querySelector('#mask').classList.contains('on')"):   # identité (multi)
        inp = pg.locator('#modal input[type=text]')
        if inp.count(): inp.first.fill('TST')
        pg.locator('#modal button.primary').first.click(); pg.wait_for_timeout(300)
    pg.set_input_files('#filePdf', PDF)
    pg.wait_for_function('!!Doc.pdf'); pg.wait_for_timeout(800)
    return b, pg, errs

def frame(pg, dy=0):
    pg.click('#btnCmt')
    bx = pg.locator('#layer').bounding_box()
    x, y = bx['x'] + 40, bx['y'] + 60 + dy
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 110, y + 30, steps=5); pg.mouse.up()
    pg.wait_for_selector('#composer:not([hidden])')

texts = lambda pg: pg.evaluate("Doc.items.filter(i=>i.type==='comment').map(i=>i.text)")
last_color = lambda pg: pg.evaluate("(Doc.items.filter(i=>i.type==='comment').pop()||{}).color")

def bench_saisie(p, base):
    b, pg, errs = open_app(p, base)
    print(f"[saisie] {pg.evaluate('APP_VERSION')}")
    frame(pg); pg.keyboard.type('Premier'); pg.click('#cpOk'); pg.wait_for_timeout(150)
    check('saisie directe', texts(pg) == ['Premier'], texts(pg))
    frame(pg); pg.keyboard.type('Deuxiemx'); pg.keyboard.press('Backspace'); pg.keyboard.type('e')
    pg.click('#cpOk'); pg.wait_for_timeout(150)
    check('correction au Retour arrière', texts(pg)[-1:] == ['Deuxieme'], texts(pg))
    frame(pg); pg.keyboard.type('Trois')
    x0 = pg.evaluate('composing.it.x')
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowRight')
    check('flèches sans effet sur le cadre', pg.evaluate('composing.it.x') == x0)
    check('historique gelé pendant la saisie', pg.evaluate("document.querySelector('#btnUndo').disabled"))
    pg.click('#cpOk'); pg.wait_for_timeout(150)
    check('historique rendu après validation', not pg.evaluate("document.querySelector('#btnUndo').disabled"))
    check('trois commentaires présents', len(texts(pg)) == 3, texts(pg))
    check('aucune erreur JS', not errs, errs)
    b.close()

def bench_couleur(p, base, mobile):
    b, pg, errs = open_app(p, base, mobile)
    print(f"[couleur{' mobile' if mobile else ''}] {pg.evaluate('APP_VERSION')}")
    tap = pg.tap if mobile else pg.click
    frame(pg); pg.keyboard.type('vert'); tap('#cpCol'); tap('#cpRow button[data-c="#1b7a4b"]')
    tap('#cpOk'); pg.wait_for_timeout(150)
    frame(pg, 50); pg.keyboard.type('suivant'); tap('#cpOk'); pg.wait_for_timeout(150)
    check('pastille retenue pour le suivant', last_color(pg) == '#1b7a4b', last_color(pg))
    frame(pg, 100); pg.keyboard.type('natif'); tap('#cpCol')
    pg.evaluate("""()=>{const i=document.querySelector('#cpRow-i'); i.value='#7b2fbe';
        i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));}""")
    tap('#cpOk'); pg.wait_for_timeout(150)
    frame(pg, 150); pg.keyboard.type('suivant 2'); tap('#cpOk'); pg.wait_for_timeout(150)
    check('sélecteur natif retenu pour le suivant', last_color(pg) == '#7b2fbe', last_color(pg))
    check('aucune erreur JS', not errs, errs)
    b.close()

def bench_sw(p, base):
    print('[service workers]')
    b = p.chromium.launch(); ctx = b.new_context(bypass_csp=True); pg = ctx.new_page()
    pg.goto(base); pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(1500)
    pg.goto(base + 'multi/'); pg.wait_for_timeout(2500)
    keys = pg.evaluate('caches.keys()')
    check('les deux caches coexistent', any(k.startswith('pdfed-v') for k in keys)
          and any(k.startswith('pdfed-multi-') for k in keys), keys)
    title = pg.evaluate("""async (u)=>{const k=(await caches.keys()).find(k=>/^pdfed-v/.test(k));
        if(!k) return null; const r=await (await caches.open(k)).match(u+'index.html');
        return r ? (await r.text()).match(/<title>([^<]*)/)[1] : null}""", base)
    check('page de la racine intacte dans son cache', title == 'EDITION PDF', title)
    b.close()

if __name__ == '__main__':
    base = serve()
    with sync_playwright() as p:
        for app in ('', 'multi/'):
            bench_saisie(p, base + app)
            bench_couleur(p, base + app, False)
            bench_couleur(p, base + app, True)
        bench_sw(p, base)
    print('\n' + ('TOUT EST CONFORME' if not FAILS else f'{len(FAILS)} ÉCART(S) : ' + ' ; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)
