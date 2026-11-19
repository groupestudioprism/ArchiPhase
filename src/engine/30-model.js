/* ============ Modèle : projet, tâches, ressources, historique ============
   state.els   : tâches dans l'ordre d'affichage (parcours en profondeur de l'arborescence) — nom « els » commun au cloud des apps Archi
     {id, name, s (début souhaité, AAAA-MM-JJ), d (durée en jours ouvrés, 0 = jalon), du (unité d'affichage : j, s, m, a), ms (jalon), p (avancement %), par (tâche parente),
      deps:[{id, t:'FS'|'SS'|'FF'|'SF', lag}], res:[{id, u (%)}], col, prio, note, c (replié)}
   state.res   : ressources {id, name, role, col, rate (€/jour), cap (%)}
   state.cal   : {week:[dim…sam], hol (fériés français), off:[{from, to, name}], on:[AAAA-MM-JJ]}
   state.base  : référence {at, t:{id:[début, fin]}} */
const COLORS = [['teal', '#139AA6', '#0E7F96'], ['bleu', '#2F6FD0', '#1F56A8'], ['vert', '#22B488', '#178F69'], ['lime', '#7CB342', '#5E8F2C'], ['ambre', '#E9A23B', '#C47F1A'], ['orange', '#F07A2E', '#C85D17'], ['rouge', '#E0524F', '#B83A37'], ['violet', '#8B6CD9', '#6A4FBA'], ['gris', '#7D8A9C', '#5E6A7B']];
const COLOR = Object.fromEntries(COLORS.map(c => [c[0], c]));
const LINKS = {FS:'Fin → Début', SS:'Début → Début', FF:'Fin → Fin', SF:'Début → Fin'};
const PRIOS = {low:'Basse', normal:'Normale', high:'Haute', crit:'Critique'};
let state = null, quiet = false;
const hist = [], redoS = [];
let sel = new Set(), selLink = null, focusId = null;
function blankState(name = 'Nouveau projet'){
  const t = todayDay(), start = t + ((8 - dow(t)) % 7 || 7);   // lundi prochain
  return {v:1, name, start:dayToIso(start), els:[], res:[], cal:{week:[0, 1, 1, 1, 1, 1, 0], hol:true, off:[], on:[]}, base:null,
    meta:{client:'', manager:'', desc:''}, view:{zoom:'week', crit:false, base:false, tw:0}};
}
function migrate(s){
  const b = blankState(s?.name || 'Projet');
  const st = {...b, ...(s || {}), cal:{...b.cal, ...(s?.cal || {})}, meta:{...b.meta, ...(s?.meta || {})}, view:{...b.view, ...(s?.view || {})}};
  st.els = (Array.isArray(st.els) ? st.els : []).filter(t => t && t.id).map(t => ({id:String(t.id), name:String(t.name ?? 'Tâche'), s:t.s || st.start, d:Math.max(0, Math.round(+t.d || 0)), ms:!!t.ms || +t.d === 0,
    p:clamp(Math.round(+t.p || 0), 0, 100), par:t.par ? String(t.par) : '', deps:(t.deps || []).filter(x => x && x.id).map(x => ({id:String(x.id), t:LINKS[x.t] ? x.t : 'FS', lag:Math.round(+x.lag || 0)})),
    res:(t.res || []).filter(x => x && x.id).map(x => ({id:String(x.id), u:clamp(Math.round(+x.u || 100), 1, 1000)})), col:COLOR[t.col] ? t.col : '', prio:PRIOS[t.prio] ? t.prio : 'normal', note:String(t.note || ''), c:!!t.c, du:['j', 's', 'm', 'a'].includes(t.du) ? t.du : ''}));
  const ids = new Set(st.els.map(t => t.id));
  st.els.forEach(t => { if (!ids.has(t.par) || t.par === t.id) t.par = ''; t.deps = t.deps.filter(x => ids.has(x.id) && x.id !== t.id); if (t.ms) t.d = 0; });
  st.res = (Array.isArray(st.res) ? st.res : []).filter(r => r && r.id).map(r => ({id:String(r.id), name:String(r.name || 'Ressource'), role:String(r.role || ''), col:COLOR[r.col] ? r.col : 'bleu', rate:Math.max(0, +r.rate || 0), cap:clamp(+r.cap || 100, 1, 10000)}));
  const rids = new Set(st.res.map(r => r.id)); st.els.forEach(t => t.res = t.res.filter(x => rids.has(x.id)));
  if (!Number.isFinite(isoToDay(st.start))) st.start = b.start;
  if (!['day', 'week', 'month', 'quarter'].includes(st.view.zoom)) st.view.zoom = 'week';
  normOrder(st); return st;
}
/* ---------- arborescence ---------- */
const byId = id => state.els.find(t => t.id === id);
const kids = (id, st = state) => st.els.filter(t => t.par === id);
const isSum = t => state.els.some(x => x.par === t.id);
function ancestors(t){ const a = []; let p = t.par ? byId(t.par) : null; while (p && a.length < 64){ a.push(p); p = p.par ? byId(p.par) : null; } return a; }
function subtree(t){ const out = [t]; for (let i = 0; i < out.length; i++) out.push(...kids(out[i].id)); return out; }
function normOrder(st = state){   // remet els dans l'ordre d'un parcours en profondeur, en gardant l'ordre relatif des frères
  const ids = new Set(st.els.map(t => t.id)), out = [], seen = new Set();
  const walk = p => st.els.filter(t => (t.par || '') === p && !seen.has(t.id)).forEach(t => { seen.add(t.id); out.push(t); walk(t.id); });
  st.els.forEach(t => { if (t.par && !ids.has(t.par)) t.par = ''; });
  // cycles de parenté (fichiers importés abîmés) : on les casse
  st.els.forEach(t => { const path = new Set([t.id]); let p = t.par; while (p){ if (path.has(p)){ t.par = ''; break; } path.add(p); p = st.els.find(x => x.id === p)?.par || ''; } });
  walk(''); st.els.forEach(t => { if (!seen.has(t.id)){ t.par = ''; out.push(t); } }); st.els = out;
}
function visibleRows(){ const out = []; const hidden = new Set(); state.els.forEach(t => { if (t.par && (hidden.has(t.par) || byId(t.par)?.c)) { hidden.add(t.id); return; } out.push(t); }); return out; }
function level(t){ return ancestors(t).length; }
function wbs(){ const m = {}, cnt = {}; state.els.forEach(t => { const p = t.par || ''; cnt[p] = (cnt[p] || 0) + 1; m[t.id] = (p ? m[p] + '.' : '') + cnt[p]; }); return m; }
/* ---------- historique ---------- */
function snap(){ return JSON.stringify(state); }
function edit(fn, opt = {}){
  const before = snap();
  try { fn(); } catch(e){ console.warn(e); state = JSON.parse(before); toast('Action impossible : ' + (e.message || e)); return; }
  normOrder(); const after = snap(); if (after === before) { refresh(); return; }
  hist.push(before); if (hist.length > 120) hist.shift(); redoS.length = 0;
  refresh(); save(); if (!opt.keepPanel) renderPanel();
}
function undo(){ if (!hist.length) return; redoS.push(snap()); state = JSON.parse(hist.pop()); afterHist(); }
function redo(){ if (!redoS.length) return; hist.push(snap()); state = JSON.parse(redoS.pop()); afterHist(); }
function afterHist(){ sel = new Set([...sel].filter(id => byId(id))); selLink = null; refresh(); renderPanel(); save(); }
function syncUndo(){ $('#undo').disabled = !hist.length; $('#redo').disabled = !redoS.length; }
function save(){ syncUndo(); try { if (!window.APCloudActive) localStorage.setItem('archiphase.v1', JSON.stringify(state)); } catch(e){} if (!quiet) window.dispatchEvent(new Event('ap:changed')); }
/* ---------- création de tâches ---------- */
function newTask(o = {}){ return {id:uid(), name:'Nouvelle tâche', s:state.start, d:5, ms:false, p:0, par:'', deps:[], res:[], col:'', prio:'normal', note:'', c:false, ...o}; }
/* projet construit à partir d'une liste compacte : [niveau, nom, durée (0 = jalon), lien ('' = suit la tâche précédente, '-' = en parallèle, 'SS+2'…), ressources] */
function buildRows(name, rows, startIso, res = [], extra = {}){
  const st = blankState(name); if (startIso) st.start = startIso; st.res = res.map(r => ({col:'bleu', role:'', rate:0, cap:100, ...r}));
  const stack = [], last = {leaf:null};
  rows.forEach(([lv, nm, d, lk = '', rs = [], col = '']) => {
    const t = {id:uid(), name:nm, s:st.start, d:d || 0, ms:d === 0, p:0, par:lv > 0 ? stack[lv - 1]?.id || '' : '', deps:[], res:rs.map(r => typeof r === 'string' ? {id:r, u:100} : {id:r[0], u:r[1]}), col, prio:'normal', note:'', c:false};
    stack[lv] = t; stack.length = lv + 1;
    const isGroup = d === null;
    if (isGroup){ t.d = 1; t.ms = false; }
    else if (last.leaf && lk !== '-'){ const m = /^(FS|SS|FF|SF)?([+-]\d+)?$/.exec(lk) || []; t.deps.push({id:last.leaf.id, t:m[1] || 'FS', lag:+(m[2] || 0)}); }
    st.els.push(t); if (!isGroup) last.leaf = t;
  });
  Object.assign(st, extra); return st;
}
function sample(){
  const R = [{id:'r1', name:'Chef de chantier', role:'Encadrement', col:'violet', rate:520, cap:100}, {id:'r2', name:'Équipe canalisation', role:'3 compagnons', col:'teal', rate:1450, cap:100},
    {id:'r3', name:'Pelle 20 t + chauffeur', role:'Matériel', col:'ambre', rate:980, cap:100}, {id:'r4', name:'Équipe voirie', role:'4 compagnons', col:'vert', rate:1650, cap:100},
    {id:'r5', name:'Géomètre', role:'Topographie, récolement', col:'bleu', rate:750, cap:100}, {id:'r6', name:'Sous-traitant enrobés', role:'Finisseur + compacteurs', col:'orange', rate:3900, cap:100}];
  const t = todayDay(), mon = t - ((dow(t) + 6) % 7) - 14;   // commencé il y a deux semaines : l'avancement et la ligne « aujourd'hui » parlent tout de suite
  const st = buildRows('Exemple · Réseaux EU / EP — Rue des Tilleuls', [
    [0, 'Préparation du chantier', null],
    [1, 'Ordre de service', 0, '-', ['r1']],
    [1, 'DT-DICT et marquage-piquetage', 5, '', ['r5']],
    [1, 'Constat d\'huissier et état des lieux', 1, '', ['r1']],
    [1, 'Installation de chantier, arrêté de circulation', 2, '', [['r1', 50], 'r2']],
    [0, 'Réseau d\'eaux usées (EU)', null],
    [1, 'Terrassement en tranchée blindée', 8, '', ['r3', ['r2', 50]], 'teal'],
    [1, 'Pose du collecteur PVC Ø200 CR8', 10, 'SS+2', ['r2'], 'teal'],
    [1, 'Regards de visite Ø1000', 6, 'SS+3', [['r2', 50]], 'teal'],
    [1, 'Branchements particuliers (12 u)', 5, '', ['r2', ['r3', 50]], 'teal'],
    [1, 'Essais d\'étanchéité et inspection caméra', 2, '', [['r5', 50]], 'teal'],
    [1, 'Réception du réseau EU', 0, '', ['r1']],
    [0, 'Réseau d\'eaux pluviales (EP)', null],
    [1, 'Terrassement EP', 6, '-', ['r3'], 'bleu'],
    [1, 'Pose canalisation béton Ø400', 8, 'SS+2', ['r2'], 'bleu'],
    [1, 'Avaloirs, grilles et raccordements', 4, '', [['r2', 50]], 'bleu'],
    [1, 'Essais EP', 1, '', [['r5', 50]], 'bleu'],
    [0, 'Réfection de voirie', null],
    [1, 'Remblaiement et compactage des tranchées', 5, '', ['r4', 'r3'], 'vert'],
    [1, 'Essais de compactage (pénétromètre)', 1, '', [['r5', 50]], 'vert'],
    [1, 'Bordures T2 et caniveaux CC1', 6, '', ['r4'], 'vert'],
    [1, 'Couche de base en grave-bitume', 2, '', ['r6'], 'vert'],
    [1, 'Enrobés BBSG 0/10', 2, '', ['r6'], 'vert'],
    [1, 'Signalisation horizontale', 1, '', [['r4', 50]], 'vert'],
    [0, 'Réception des travaux', null],
    [1, 'Opérations préalables à la réception (OPR)', 1, '', ['r1']],
    [1, 'Levée des réserves', 5, '', [['r4', 50]]],
    [1, 'DOE et plans de récolement', 5, 'SS', ['r5']],
    [1, 'Réception des travaux', 0, '', ['r1']],
  ], dayToIso(mon), R, {meta:{client:'Commune de Saint-Lô', manager:'Conducteur de travaux', desc:'Mise en séparatif du réseau d\'assainissement et réfection complète de la chaussée (320 ml).'}, isSample:true});
  // l'EP démarre quand l'EU a libéré la pelle ; la voirie attend les deux réseaux
  const f = n => st.els.find(t => t.name === n);
  f('Terrassement EP').deps.push({id:f('Terrassement en tranchée blindée').id, t:'FS', lag:0});
  f('Remblaiement et compactage des tranchées').deps.push({id:f('Réception du réseau EU').id, t:'FS', lag:0});
  // avancement : préparation faite, EU en cours
  ['Ordre de service', 'DT-DICT et marquage-piquetage', 'Constat d\'huissier et état des lieux', 'Installation de chantier, arrêté de circulation'].forEach(n => f(n).p = 100);
  f('Terrassement en tranchée blindée').p = 60; f('Pose du collecteur PVC Ø200 CR8').p = 25;
  const s = migrate(st); s.isSample = true; return s;
}
const TEMPLATES = {
  vrd:{t:'Réseaux EU / EP et voirie', s:'Préparation, réseaux, voirie, réception', make:() => { const s = sample(); s.isSample = false; s.name = 'Réseaux EU / EP et voirie'; s.els.forEach(t => t.p = 0); s.start = blankState().start; s.els.forEach(t => t.s = s.start); s.meta = {client:'', manager:'', desc:''}; return s; }},
  aep:{t:'Renouvellement de conduite AEP', s:'Conduite provisoire, pose, essais, désinfection', make:() => migrate(buildRows('Renouvellement de conduite AEP', [
    [0, 'Préparation', null], [1, 'DT-DICT, piquetage', 4], [1, 'Information des abonnés', 2, '-'], [1, 'Pose de la conduite provisoire et branchements', 4],
    [0, 'Travaux', null], [1, 'Terrassement', 10], [1, 'Pose fonte DN150 et pièces spéciales', 10, 'SS+2'], [1, 'Reprise des branchements', 6, 'SS+4'], [1, 'Épreuve hydraulique', 1], [1, 'Désinfection et analyses ARS', 3], [1, 'Mise en service', 0],
    [0, 'Finitions', null], [1, 'Dépose de la conduite provisoire', 2], [1, 'Réfection des tranchées', 5], [1, 'Plans de récolement', 3, 'SS'], [1, 'Réception', 0]], blankState().start))},
  batiment:{t:'Maison individuelle', s:'Gros œuvre, clos-couvert, second œuvre', make:() => migrate(buildRows('Construction d\'une maison individuelle', [
    [0, 'Études et autorisations', null], [1, 'Esquisse et avant-projet', 10], [1, 'Permis de construire (instruction)', 40], [1, 'Permis obtenu', 0],
    [0, 'Gros œuvre', null], [1, 'Terrassement et fondations', 8], [1, 'Soubassement et dalle', 6], [1, 'Élévation des murs', 15], [1, 'Planchers et chaînages', 6],
    [0, 'Clos et couvert', null], [1, 'Charpente', 5], [1, 'Couverture', 6], [1, 'Menuiseries extérieures', 4], [1, 'Hors d\'eau, hors d\'air', 0],
    [0, 'Second œuvre', null], [1, 'Plomberie et électricité (réseaux)', 10], [1, 'Isolation et cloisons', 12, 'SS+3'], [1, 'Chapes', 3], [1, 'Carrelage et sols', 8], [1, 'Peintures', 10], [1, 'Finitions plomberie et électricité', 4],
    [0, 'Livraison', null], [1, 'Nettoyage et réception', 2], [1, 'Remise des clés', 0]], blankState().start))},
  bim:{t:'Projet BIM (maquette numérique)', s:'Convention BIM, maquettes, synthèse, DOE numérique', make:() => migrate(buildRows('Projet BIM', [
    [0, 'Cadrage', null], [1, 'Cahier des charges BIM', 5], [1, 'Convention BIM et protocole d\'échange', 5], [1, 'Gabarits et nomenclatures', 3],
    [0, 'Maquettes', null], [1, 'Relevé et nuage de points', 5, '-'], [1, 'Maquette architecture (ARCHIPLAN)', 15], [1, 'Maquette réseaux (VRD)', 12, 'SS+5'], [1, 'Maquette structure', 12, 'SS+5'],
    [0, 'Coordination', null], [1, 'Synthèse et détection de conflits', 5], [1, 'Revue de projet en réalité augmentée (ArchiVision)', 1], [1, 'Corrections', 5], [1, 'Maquette de synthèse validée', 0],
    [0, 'Livrables', null], [1, 'Exports IFC et plans', 3], [1, 'DOE numérique', 5], [1, 'Livraison', 0]], blankState().start))},
  logiciel:{t:'Projet logiciel', s:'Cadrage, sprints, recette, mise en production', make:() => migrate(buildRows('Projet logiciel', [
    [0, 'Cadrage', null], [1, 'Expression du besoin', 5], [1, 'Maquettes et parcours', 5], [1, 'Validation du périmètre', 0],
    [0, 'Développement', null], [1, 'Sprint 1', 10], [1, 'Sprint 2', 10], [1, 'Sprint 3', 10], [1, 'Version bêta', 0],
    [0, 'Recette', null], [1, 'Tests et corrections', 10], [1, 'Recette utilisateurs', 5, 'SS+5'], [1, 'Mise en production', 0]], blankState().start))},
};
