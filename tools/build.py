#!/usr/bin/env python3
"""Assemble ARCHIPHASE en un seul fichier HTML à partir des sources de src/.

  src/parts/head.html            titre, polices
  src/css/*.css                  styles (ordre : CSS_ORDER)
  src/parts/body.html            structure de la page (intro, compte, planning, accueil)
  src/js/auth.js + cloud.js + auth-end.js   compte Studio Prism, cloud, accueil (script classique, une seule IIFE)
  src/js/intro.js                intro animée (barres de Gantt qui dévoilent le logo)
  src/engine/*.js                moteur de planification (Gantt, ressources, PERT, imports/exports ; module ES, fichiers concaténés dans l'ordre alphabétique)

Sorties :
  index.html                     site en ligne (GitHub Pages) : Firebase branché, scripts préchargés
  dist/archiphase-demo.html       démo autonome (comptes et cloud dans le navigateur), utilisée pour l'aperçu Claude
Usage : python3 tools/build.py
"""
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / 'src'
CSS_ORDER = ['app.css', 'splash.css', 'auth.css', 'home.css', 'brand.css', 'ctx.css', 'gantt.css']
FB = '10.12.2'
CONFIG = '''const FIREBASE_CONFIG = {
  // Projet Firebase de Studio Prism : le même que le site (js/firebase.js du dépôt Studio-Prism). Configuration publique par conception.
  apiKey: "AIzaSyAAD5rrHuVh6_PC2_45L3y9F7zWe5ACW6E",
  authDomain: "archivision-studioprism.firebaseapp.com",
  projectId: "archivision-studioprism",
  storageBucket: "archivision-studioprism.firebasestorage.app",
  messagingSenderId: "226072216517",
  appId: "1:226072216517:web:0aeef645a4f1481fe801ac"
};'''
def rd(p): return (S / p).read_text(encoding='utf-8')
def assemble(engine_dir='engine', css=CSS_ORDER, body='parts/body.html', cloud='js/cloud.js'):
    engine = ''.join(f'/* ==== {f.name} ==== */\n' + f.read_text(encoding='utf-8') + '\n' for f in sorted((S / engine_dir).glob('*.js')))
    return (rd('parts/head.html') + '<style>\n' + ''.join(rd('css/' + c) for c in css) + '</style>\n' + rd(body).replace('<!--INTRO-->', '<script>\n' + rd('js/intro.js') + '</script>')
            + '<script>\n' + rd('js/auth.js') + rd(cloud) + rd('js/auth-end.js') + '</script>\n'
            + '<script type="module">\n' + engine + '</script>\n')
HEAD = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">'
        '<meta name="description" content="ARCHIPHASE · Studio Prism : planification et phasage de projets : diagramme de Gantt, ressources, PERT, chemin critique, compatible GanttProject et MS Project.">'
        '<meta name="theme-color" content="#0D1E45"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg"><link rel="icon" type="image/png" sizes="64x64" href="assets/icon-64.png"><link rel="apple-touch-icon" href="assets/icon-180.png"><link rel="manifest" href="manifest.webmanifest">'
        '<link rel="preconnect" href="https://www.gstatic.com" crossorigin>'
        '<link rel="preconnect" href="https://firestore.googleapis.com">'
        '<link rel="preconnect" href="https://identitytoolkit.googleapis.com">'
        '<link rel="preconnect" href="https://securetoken.googleapis.com">'
        ''
        + ''.join(f'<link rel="preload" as="script" href="https://www.gstatic.com/firebasejs/{FB}/firebase-{n}-compat.js">' for n in ('app', 'auth', 'firestore')) +
        '<style>[hidden]{display:none!important}html{overflow:hidden;overscroll-behavior:none}body{overflow:hidden;overscroll-behavior:none}*{overscroll-behavior-x:contain}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0}</style></head><body>\n')
# ---- référencement et informations légales (ajouté le 19/11/2026, voir README) ----
SEO_URL = 'https://archiphase.studio-prism.com/'
SEO_TITLE = 'ARCHIPHASE — Planning Gantt en ligne, ressources et PERT · Studio Prism'
SEO_IMG = 'assets/icon-512.png'
SEO_CAT = 'BusinessApplication'
SP_LEGAL = 'https://studio-prism.com/'
def _spseo(live):
    import json as _j, re as _re, html as _h
    m = _re.search(r'<meta name="description" content="([^"]*)"', live); desc = _h.unescape(m.group(1)) if m else ''
    e = lambda s: _h.escape(s, quote=True)
    ld = {'@context': 'https://schema.org', '@type': 'SoftwareApplication', 'name': SEO_TITLE.split(' — ')[0], 'url': SEO_URL, 'description': desc,
          'applicationCategory': SEO_CAT, 'operatingSystem': 'Web (navigateur) : Windows, macOS, Linux, Android, iOS', 'inLanguage': 'fr-FR',
          'image': SEO_URL + SEO_IMG, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
          'publisher': {'@type': 'Organization', 'name': 'Studio Prism', 'url': SP_LEGAL}}
    tags = (f'<link rel="canonical" href="{SEO_URL}"><meta property="og:type" content="website"><meta property="og:site_name" content="Studio Prism">'
            f'<meta property="og:title" content="{e(SEO_TITLE)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{SEO_URL}">'
            f'<meta property="og:image" content="{SEO_URL}{SEO_IMG}"><meta property="og:locale" content="fr_FR"><meta name="twitter:card" content="summary">'
            '<script type="application/ld+json">' + _j.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    live = _re.sub(r'<title>[^<]*</title>', '<title>' + e(SEO_TITLE) + '</title>', live, count=1)
    live = live.replace('</head>', tags + '</head>', 1)
    nav = ('<nav class="sp-legal" aria-label="Informations légales"><a href="' + SP_LEGAL + 'mentions-legales" target="_blank" rel="noopener">Mentions légales</a>'
           '<a href="' + SP_LEGAL + 'confidentialite" target="_blank" rel="noopener">Confidentialité</a><a href="' + SP_LEGAL + 'conditions-utilisation" target="_blank" rel="noopener">CGU</a>'
           '<a href="' + SP_LEGAL + 'cgv" target="_blank" rel="noopener">CGV</a><a href="' + SP_LEGAL + 'cookies" target="_blank" rel="noopener">Cookies</a></nav>'
           '<style>.sp-legal{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;flex-wrap:wrap;justify-content:center;gap:2px 14px;'
           'width:max-content;max-width:calc(100% - 16px);box-sizing:border-box;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.9);color:#3a4256;box-shadow:0 1px 4px rgba(0,0,0,.12);font:12px/1.5 Inter,system-ui,sans-serif}.sp-legal a{color:inherit;opacity:.85;text-decoration:none}.sp-legal a:hover,.sp-legal a:focus-visible{opacity:1;text-decoration:underline}</style>'
           '<script>(function(){var a=document.getElementById("auth"),n=document.querySelector(".sp-legal");if(a&&n)a.appendChild(n);else if(n)n.remove()})()</script>')
    i = live.rfind('</body>')
    return live[:i] + nav + live[i:] if i > 0 else live + nav
def _spdemo(s):
    return s.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex,follow">', 1) if '<meta charset="utf-8">' in s[:300] else '<meta name="robots" content="noindex,follow">' + s

def main(argv):
    demo = assemble()
    assert demo.count('const FIREBASE_CONFIG = null;') == 1 and f"FIREBASE_VERSION = '{FB}'" in demo
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'archiphase-demo.html').write_text(_spdemo('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"><base href="../">' + demo), encoding='utf-8')
    live = HEAD + demo.replace('const FIREBASE_CONFIG = null;', CONFIG).replace('<title>ARCHIPHASE</title>', '<title>ARCHIPHASE · Studio Prism</title>', 1) + '<script>if (\'serviceWorker\' in navigator) addEventListener(\'load\', () => navigator.serviceWorker.register(\'sw.js\').catch(() => {}));</script></body></html>\n'
    (ROOT / 'index.html').write_text(_spseo(live), encoding='utf-8')
    print('index.html', len(live), 'octets · dist/archiphase-demo.html', len(demo), 'octets')
if __name__ == '__main__': main(sys.argv[1:])
