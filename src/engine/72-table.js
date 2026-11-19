/* ============ Import de tableurs (Excel .xlsx, CSV) : colonnes, noms, lignes et hiérarchie repérés automatiquement ============
   Pas besoin d'en-têtes : s'il y en a, ils sont reconnus (« Désignation », « Du », « Au », « Nb jours »…) ; sinon les colonnes sont devinées
   d'après leur contenu (texte long = nom, dates = début / fin, petits entiers = durée…). La hiérarchie vient de la numérotation (1, 1.1…),
   d'une colonne « niveau », de l'indentation ou des lignes de section (nom seul). Si aucune date n'est trouvée, les tâches sont enchaînées. */

/* ---------- lecture d'un .xlsx (archive zip + XML), sans bibliothèque ---------- */
async function inflateRaw(bytes){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
async function unzip(buf){
  const u = new Uint8Array(buf), dv = new DataView(buf), out = {}; let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
  if (e < 0) throw new Error('archive illisible');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true), td = new TextDecoder();
  for (let k = 0; k < n; k++){
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    const ds = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u.subarray(ds, ds + csz);
    out[name] = td.decode(method === 0 ? raw : await inflateRaw(raw));
  }
  return out;
}
const colIdx = ref => { let n = 0; for (const c of /^[A-Z]+/i.exec(ref)[0].toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
async function readXlsx(buf){
  const u = new Uint8Array(buf, 0, 4);
  if (u[0] === 0xD0 && u[1] === 0xCF) throw new Error('ancien format .xls : enregistrez le classeur en .xlsx (Fichier → Enregistrer sous) ou en .csv, puis réimportez-le');
  if (u[0] !== 0x50 || u[1] !== 0x4B) throw new Error('ce fichier n\'est pas un classeur Excel .xlsx');
  if (typeof DecompressionStream === 'undefined') throw new Error('votre navigateur est trop ancien pour lire un .xlsx : enregistrez le classeur en .csv');
  const Z = await unzip(buf), X = s => new DOMParser().parseFromString(s, 'application/xml');
  if (!Z['xl/workbook.xml']) throw new Error('classeur Excel illisible');
  const wb = X(Z['xl/workbook.xml']), rels = {}; 
  if (Z['xl/_rels/workbook.xml.rels']) X(Z['xl/_rels/workbook.xml.rels']).querySelectorAll('Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const d1904 = wb.querySelector('workbookPr')?.getAttribute('date1904') === '1' || wb.querySelector('workbookPr')?.getAttribute('date1904') === 'true';
  const ss = Z['xl/sharedStrings.xml'] ? [...X(Z['xl/sharedStrings.xml']).querySelectorAll('si')].map(si => [...si.querySelectorAll('t')].filter(t => !t.closest('rPh')).map(t => t.textContent).join('')) : [];
  // styles : quels formats de cellule sont des dates ou des pourcentages
  const kind = [];
  if (Z['xl/styles.xml']){ const st = X(Z['xl/styles.xml']), fm = {}; st.querySelectorAll('numFmts > numFmt').forEach(f => { fm[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || ''; });
    st.querySelectorAll('cellXfs > xf').forEach(x => { const id = +x.getAttribute('numFmtId') || 0, code = (fm[id] || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
      kind.push(id === 9 || id === 10 || /%/.test(code) ? 'pc' : (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58) || (id > 163 && /[dmy]/i.test(code) && !/general/i.test(code)) ? 'dt' : ''); }); }
  const sheets = [];
  for (const sh of wb.querySelectorAll('sheets > sheet')){
    if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), tg = rels[rid]; if (!tg) continue;
    const xml = Z['xl/' + tg.replace(/^\/?(xl\/)?/, '')]; if (!xml) continue;
    const rows = [], doc = X(xml); let n = 0;
    for (const r of doc.querySelectorAll('sheetData > row')){
      if (r.getAttribute('hidden') === '1' && false) continue;
      if (++n > 6000) break;
      const ri = (+r.getAttribute('r') || n) - 1, row = rows[ri] = [];
      for (const c of r.children){
        if (c.tagName !== 'c') continue; const t = c.getAttribute('t'), v = c.querySelector('v')?.textContent, ci = colIdx(c.getAttribute('r') || 'A'); let val = '';
        if (t === 's') val = ss[+v] ?? ''; else if (t === 'inlineStr') val = [...c.querySelectorAll('t')].map(x => x.textContent).join(''); else if (t === 'str') val = v ?? '';
        else if (t === 'b') val = v === '1' ? 'oui' : 'non'; else if (t === 'e' || v == null) val = '';
        else { const f = parseFloat(v), k = kind[+c.getAttribute('s') || 0]; val = !Number.isFinite(f) ? v : k === 'dt' ? {dt:Math.floor(f) - (d1904 ? 24107 : 25569)} : k === 'pc' ? {pc:f * 100} : f; }
        row[ci] = val;
      }
    }
    sheets.push({name:sh.getAttribute('name') || '', rows:Array.from(rows, r => r || [])});
  }
  if (!sheets.length) throw new Error('classeur vide');
  return sheets;
}

/* ---------- reconnaissance des colonnes ---------- */
const nrm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();
const HDR = [
  ['pred', ['predecesseur', 'predecesseurs', 'predecessor', 'predecessors', 'antecedent', 'antecedents', 'dependance', 'dependances', 'dependency', 'depend', 'precedent', 'precedents', 'lien', 'liens', 'apres']],
  ['res', ['ressource', 'ressources', 'resource', 'resources', 'responsable', 'equipe', 'affecte', 'affectation', 'intervenant', 'intervenants', 'entreprise', 'acteur', 'assigne', 'pilote', 'sous traitant', 'qui']],
  ['note', ['note', 'notes', 'commentaire', 'commentaires', 'observation', 'observations', 'remarque', 'remarques', 'comment', 'comments']],
  ['p', ['avancement', '%', 'progress', 'realise', 'complete', 'completion', 'taux', 'pourcentage', 'pct']],
  ['dur', ['duree', 'duration', 'jours', 'jour', 'nb jours', 'nbj', 'delai', 'temps', 'dur']],
  ['start', ['debut', 'start', 'begin', 'du', 'demarrage', 'commencement', 'date debut', 'start date']],
  ['end', ['fin', 'end', 'finish', 'au', 'achevement', 'echeance', 'livraison', 'date fin', 'end date']],
  ['level', ['niveau', 'level', 'retrait', 'outline level']],
  ['type', ['type']],
  ['name', ['nom', 'tache', 'taches', 'task', 'tasks', 'designation', 'libelle', 'intitule', 'activite', 'activites', 'description', 'titre', 'operation', 'operations', 'ouvrage', 'poste', 'travaux', 'etape', 'phase', 'action', 'prestation', 'name', 'lot', 'objet']],
  ['wbs', ['id', 'n', 'no', 'num', 'numero', 'ref', 'reference', 'code', 'wbs', 'rang', 'item', 'ordre', 'outline number']],
];
function hdrField(h){
  if (typeof h !== 'string') return ''; const n = nrm(h); if (!n || n.length > 40) return '';
  const tk = n.split(' ');
  for (const [f, keys] of HDR) for (const k of keys) if (k.includes(' ') ? (' ' + n + ' ').includes(' ' + k + ' ') : (tk.includes(k) || (k.length >= 7 && n.startsWith(k)))) return f;
  return tk.includes('date') ? 'date' : '';
}
const MON = {jan:1, fev:2, mar:3, apr:4, avr:4, may:5, mai:5, jun:6, jul:7, aug:8, aou:8, sep:9, oct:10, nov:11, dec:12};
/* valeur de cellule → jour (nombre) ou NaN ; serial : accepte un nombre brut de type « date Excel » */
function cellDay(v, serial){
  if (v && typeof v === 'object' && 'dt' in v) return v.dt >= 25000 - 25569 ? v.dt : NaN;
  if (typeof v === 'number') return serial && v >= 30000 && v <= 60000 ? Math.floor(v) - 25569 : NaN;
  let s = String(v ?? '').trim(); if (!s || s.length > 40) return NaN; let m;
  s = s.replace(/^(lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)[a-zé]*\.?,?\s+(?=\d)/i, '');
  const mk = (y, mo, d) => { y = +y < 100 ? 2000 + +y : +y; if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return NaN; return isoToDay(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`); };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return mk(m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})(?!\d)/.exec(s))) return mk(m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})(?:er)?[\s-]+([a-zéû]+)\.?[\s-]+(\d{2,4})/i.exec(s))){ const mo = MON[nrm(m[2]).slice(0, 3)]; if (mo) return mk(m[3], mo, +m[1]); }
  return NaN;
}
const cellText = v => v == null ? '' : typeof v === 'object' ? ('dt' in v ? dayToIso(v.dt) : v.pc + '%') : String(v);
const isNum = v => typeof v === 'number' || (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()));

/* ---------- construction du planning ---------- */
function smartTable(rows, name){
  rows = rows.filter(r => r && r.some(c => cellText(c).trim()));
  if (rows.length < 2) throw new Error('tableau vide');
  const width = Math.max(...rows.slice(0, 300).map(r => r.length));
  // 1. ligne d'en-têtes : celle qui reconnaît le plus de champs différents (dans les 40 premières lignes)
  let hi = -1, hbest = 1, map = {};
  rows.slice(0, 40).forEach((r, i) => { const m = {}; r.forEach((c, ci) => { const f = hdrField(c); if (!f) return; if (!(f in m)) m[f] = ci; else if (f === 'wbs' && !('wbs2' in m)) m.wbs2 = ci; }); const k = Object.keys(m).filter(x => x !== 'wbs2').length, sc = k + ('name' in m ? 1 : 0);
    if (sc > hbest && (k >= 2 || (k === 1 && i === 0 && 'name' in m && r.filter(c => cellText(c).trim()).length === 1)) && (('name' in m) || sc >= 3)){ hbest = sc; hi = i; map = m; } });
  const data = rows.slice(hi + 1), info = [];
  if (map.date != null && map.start == null) map.start = map.date; delete map.date;
  // deux colonnes de numérotation (ex. « ID » et « N° ») : celle qui contient des points (1.2.3) est le WBS, l'autre sert aux références des liens
  if (map.wbs2 != null){ const dots = c => data.filter(r => /^\d+\.\d+/.test(cellText(r[c]).trim())).length; if (dots(map.wbs2) > dots(map.wbs)){ const t = map.wbs; map.wbs = map.wbs2; map.wbs2 = t; } }
  const col = f => map[f] ?? -1;
  // 2. colonnes devinées d'après le contenu
  const taken = () => new Set(Object.values(map));
  const stats = c => { const v = data.map(r => r[c]).filter(x => cellText(x).trim() !== ''); const n = v.length || 1;
    return {n:v.length, text:v.filter(x => typeof x === 'string' && !isNum(x) && Number.isNaN(cellDay(x))).length / n, len:v.reduce((a, x) => a + cellText(x).length, 0) / n,
      date:v.filter(x => !Number.isNaN(cellDay(x, hi >= 0 && (c === map.start || c === map.end)))).length / n, int:v.filter(x => isNum(x) && Math.abs(+String(x).replace(',', '.')) <= 3000).length / n,
      wbs:(() => { const w = v.map(x => cellText(x).trim()); const ok = w.filter(x => /^\d+(\.\d+)*\.?$/.test(x)).length / n, dot = w.filter(x => /^\d+\.\d+/.test(x)).length / n, seq = w.length > 2 ? w.slice(1).filter((x, i) => +x === +w[i] + 1).length / (w.length - 1) : 0; return ok >= .8 && (dot >= .3 || seq >= .8) ? ok : 0; })(), pc:v.filter(x => x && typeof x === 'object' && 'pc' in x).length / n}; };
  const S = Array.from({length:width}, (_, c) => stats(c));
  if (col('name') < 0){ let b = -1, bs = 0; for (let c = 0; c < width; c++){ if (taken().has(c)) continue; const s = S[c]; const sc = s.text > .5 && s.wbs < .6 ? s.n * Math.min(60, s.len) : 0; if (sc > bs){ bs = sc; b = c; } } if (b < 0) throw new Error('aucune colonne de noms de tâches trouvée'); map.name = b; }
  if (col('start') < 0 || col('end') < 0){ const dc = []; for (let c = 0; c < width; c++) if (!taken().has(c) && S[c].date >= .6 && S[c].n >= 2) dc.push(c);
    if (col('start') < 0 && dc.length) map.start = dc.shift(); if (col('end') < 0 && dc.length && (col('start') < 0 || dc[0] > col('start'))) map.end = dc.shift(); }
  if (hi < 0){
    if (col('wbs') < 0){ for (let c = 0; c < width; c++) if (!taken().has(c) && S[c].wbs >= .8 && S[c].n >= 3){ map.wbs = c; break; } }
    if (col('dur') < 0){ for (let c = 0; c < width; c++) if (!taken().has(c) && S[c].int >= .7 && S[c].n >= 2 && S[c].date < .3 && S[c].wbs < .8){ map.dur = c; break; } }
    if (col('p') < 0){ for (let c = 0; c < width; c++) if (!taken().has(c) && S[c].pc >= .6){ map.p = c; break; } }
  }
  const L = {name:'Nom', start:'Début', end:'Fin', dur:'Durée', p:'Avancement', wbs:'N°', level:'Niveau', pred:'Prédécesseurs', res:'Ressources', note:'Notes', type:'Type'};
  Object.keys(L).forEach(f => { if (col(f) >= 0) info.push(L[f]); });
  // 3. lignes → tâches
  const st = blankState(name), byKey = {}, byRow = {}, byId = {}, pend = [], rmap = {}, T = [];
  const g = (r, f) => col(f) >= 0 ? r[col(f)] : undefined, gs = (r, f) => cellText(g(r, f)).trim();
  const pcCol = col('p') >= 0 ? data.map(r => g(r, 'p')).filter(x => isNum(x) || (x && typeof x === 'object')) : [], pctFrac = pcCol.length && pcCol.every(x => (x && typeof x === 'object') || Math.abs(+String(x).replace(',', '.')) <= 1);
  data.forEach((r, i) => {
    const raw = cellText(g(r, 'name')).replace(/ /g, ' '), nm = raw.replace(/^[\s\-–—•·>*]+/, '').trim(); if (!nm || /^(total|sous.?total|somme)\b/i.test(nm)) return;
    const ind = raw.length - raw.replace(/^[\s \-–—•·>*]+/, '').length;
    const sd = cellDay(g(r, 'start'), true), ed = cellDay(g(r, 'end'), true), dv = g(r, 'dur'); let d = NaN;
    if (dv != null && dv !== ''){ d = typeof dv === 'number' ? Math.round(dv) : isNum(dv) ? Math.round(+String(dv).replace(',', '.')) : parseDur(String(dv)); if (typeof dv === 'number' && dv > 0 && dv < 1) d = 1; }
    const pv = g(r, 'p'); let p = pv && typeof pv === 'object' && 'pc' in pv ? pv.pc : isNum(pv) ? +String(pv).replace(',', '.') * (pctFrac ? 100 : 1) : /^\d+([.,]\d+)?\s*%$/.test(String(pv || '').trim()) ? parseFloat(String(pv).replace(',', '.')) : 0;
    const ty = gs(r, 'type').toLowerCase(), ms = /jalon|milestone/.test(ty) || /^(jalon|milestone|[◆♦])/i.test(nm) || (d === 0 && (!Number.isNaN(sd) || !Number.isNaN(ed)));
    const w = gs(r, 'wbs').replace(/\.$/, ''), lv = col('level') >= 0 ? Math.max(0, Math.round(+String(g(r, 'level')).replace(',', '.') || 1) - 1) : null;
    T.push({row:i, id:uid(), name:nm.slice(0, 120), sd, ed, d, p:clamp(Math.round(p) || 0, 0, 100), ms, w, lv, ind, pred:gs(r, 'pred'), res:gs(r, 'res'), note:gs(r, 'note'), par:'', hasVal:!Number.isNaN(sd) || !Number.isNaN(ed) || Number.isFinite(d)});
  });
  if (!T.length) throw new Error('aucune tâche trouvée dans ce tableau');
  // 4. hiérarchie : numérotation, colonne niveau, indentation, lignes de section
  const wset = new Set(T.map(t => t.w)), wbsOK = col('wbs') >= 0 && T.every(t => /^\d+(\.\d+)*$/.test(t.w)) && wset.size === T.length && T.some(t => t.w.includes('.'));
  let how = '';
  if (wbsOK){ T.forEach(t => { t.L = t.w.split('.').length - 1; }); how = 'numérotation'; }
  else if (col('level') >= 0 && T.some(t => t.lv > 0)){ T.forEach(t => { t.L = t.lv || 0; }); how = 'niveaux'; }
  else if (new Set(T.map(t => t.ind)).size > 1){ const lv = [...new Set(T.map(t => t.ind))].sort((a, b) => a - b); T.forEach(t => { t.L = lv.indexOf(t.ind); }); how = 'indentation'; }
  else { const sec = T.filter(t => !t.hasVal); if (sec.length && T.length - sec.length >= 2 && sec.length < T.length / 2){ T.forEach(t => { t.L = t.hasVal ? 1 : 0; }); how = 'sections'; } else T.forEach(t => { t.L = 0; }); }
  const stack = []; T.forEach(t => { while (stack.length && stack[stack.length - 1].L >= t.L) stack.pop(); t.par = stack.length ? stack[stack.length - 1].id : ''; stack.push(t); });
  if (how) info.push('hiérarchie : ' + how);
  // 5. dates, durées, début du projet
  const known = T.flatMap(t => [t.sd, t.ed]).filter(Number.isFinite), noDates = !known.length;
  if (known.length) st.start = dayToIso(Math.min(...known));
  CAL.build(st.cal, isoToDay(st.start));
  T.forEach(t => {
    const grp = T.some(k => k.par === t.id), els = {id:t.id, name:t.name, s:'', d:1, ms:t.ms, p:t.p, par:t.par, deps:[], res:[], col:'', prio:'normal', note:t.note, c:false};
    if (grp) els.s = st.start;
    else if (t.ms){ els.d = 0; els.s = dayToIso(Number.isFinite(t.sd) ? t.sd : Number.isFinite(t.ed) ? t.ed : isoToDay(st.start)); }
    else {
      let d = t.d;
      if (!(d > 0)){ if (Number.isFinite(t.sd) && Number.isFinite(t.ed)) d = Math.max(1, CAL.count(t.sd, t.ed)); else d = 5; }
      els.d = d; els.s = Number.isFinite(t.sd) ? dayToIso(t.sd) : Number.isFinite(t.ed) ? dayToIso(CAL.toD(Math.max(0, CAL.toW(t.ed + 1) - d))) : st.start;
    }
    st.els.push(els); byKey[t.w] = t.id; byRow[String(t.row + 1)] = t.id;
  });
  // 6. liens (colonne prédécesseurs) puis ressources
  const anc = id => { const o = []; let x = T.find(k => k.id === id)?.par; while (x){ o.push(x); x = T.find(k => k.id === x)?.par; } return o; };
  const byNum = {}; T.forEach((t, i) => { byNum[String(i + 1)] = t.id; });
  [col('wbs'), map.wbs2 ?? -1].filter(c => c >= 0).forEach(idc => T.forEach(t => { const v = cellText(data[t.row][idc]).trim(); if (v && !(v in byId)) byId[v] = t.id; }));
  T.forEach((t, i) => { if (col('pred') >= 0 && t.pred) t.pred.split(/[,;\s]+/).filter(Boolean).forEach(x => {
    const m = /^(\d+(?:\.\d+)*)\s*-?\s*(FS|SS|FF|SF|FD|DD|DF|DS)?\s*([+-]\s*\d+)?/i.exec(x); if (!m) return; const pid = [byId[m[1]], byKey[m[1]], byNum[m[1]], byRow[m[1]]].find(q => q && q !== t.id && !T.some(k => k.par === q) && !anc(t.id).includes(q)); if (!pid) return;
    const ty = ({FD:'FS', DD:'SS', DF:'SF', DS:'SF'})[(m[2] || '').toUpperCase()] || (m[2] || 'FS').toUpperCase(); const e = st.els.find(q => q.id === t.id); if (!e.deps.some(q => q.id === pid)) e.deps.push({id:pid, t:ty, lag:m[3] ? +m[3].replace(/\s/g, '') : 0}); });
    if (col('res') >= 0 && t.res) t.res.split(/[,;/]/).map(x => x.trim()).filter(Boolean).forEach(x => { const m = /^(.*?)(?:\s*\((\d+)\s*%\))?$/.exec(x), nmR = m[1].trim(); if (!nmR) return; let rid = rmap[nmR.toLowerCase()];
      if (!rid){ rid = rmap[nmR.toLowerCase()] = 'r' + uid().slice(1); st.res.push({id:rid, name:nmR, role:'', col:COLORS[(st.res.length + 1) % COLORS.length][0], rate:0, cap:100}); } st.els.find(q => q.id === t.id).res.push({id:rid, u:+(m[2] || 100)}); }); });
  // aucune date ni lien trouvés : les tâches s'enchaînent dans l'ordre du tableau
  if (noDates && col('pred') < 0){ let prev = ''; st.els.forEach(e => { if (st.els.some(k => k.par === e.id)) return; if (prev) e.deps.push({id:prev, t:'FS', lag:0}); prev = e.id; }); info.push('tâches enchaînées (aucune date trouvée)'); }
  const out = migrate(st);
  // garde-fou : des liens en boucle (colonne prédécesseurs ambiguë) sont retirés plutôt que d'importer un planning incohérent
  { const keep = [C, PROJ, CYCLE, state]; try { state = out; schedule(); if (CYCLE){ out.els.forEach(e => { e.deps = []; }); info.push('liens ignorés (ils formaient une boucle)'); } } catch(e){} finally { [C, PROJ, CYCLE, state] = keep; } }
  out.importInfo = info.join(', '); return out;
}
/* classeur : on prend la feuille qui ressemble le plus à un planning */
function fromWorkbook(sheets, name){
  let best = null, bs = -1, err = null;
  for (const sh of sheets){ try { const s = smartTable(sh.rows, name); const sc = s.els.length + (s.importInfo.includes('Début') || s.importInfo.includes('Durée') ? 1000 : 0); if (sc > bs){ bs = sc; best = s; best.importInfo = (sheets.length > 1 ? `feuille « ${sh.name} » · ` : '') + best.importInfo; } } catch(e){ err = e; } }
  if (!best) throw err || new Error('aucun planning reconnu dans ce classeur');
  return best;
}
