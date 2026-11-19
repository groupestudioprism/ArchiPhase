/* ============ ARCHIPHASE · assemblage : vues, commandes, menus, clavier, pont avec le compte et le cloud ============ */
function refresh(){
  schedule();
  if (mode === 'gantt') renderGantt(); else if (mode === 'res') renderRes(); else renderPert();
  syncUndo();
  $$('.gbar [data-tog]').forEach(b => b.setAttribute('aria-pressed', String(!!state.view[b.dataset.tog])));
  const one = [...sel].filter(id => byId(id));
  $$('.gbar [data-cmd="addSub"],.gbar [data-cmd="outdent"],.gbar [data-cmd="indent"],.gbar [data-cmd="up"],.gbar [data-cmd="down"],.gbar [data-cmd="del"]').forEach(b => b.disabled = !one.length && !(b.dataset.cmd === 'del' && selLink));
  $$('.gbar [data-cmd="link"]').forEach(b => b.disabled = one.length < 2);
  $$('.gbar [data-cmd="unlink"]').forEach(b => b.disabled = !one.length && !selLink);
}
function setMode(m){ mode = m; $$('.modes [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); $('#ganttView').hidden = m !== 'gantt'; $('#resView').hidden = m !== 'res'; $('#pertView').hidden = m !== 'pert'; refresh(); }
const selected = () => state.els.filter(t => sel.has(t.id));
const topSel = () => { const s = selected(); return s.filter(t => !ancestors(t).some(a => sel.has(a.id))); };
function insertAfter(ref, t){ const sub = subtree(ref), last = sub[sub.length - 1], i = state.els.indexOf(last); state.els.splice(i + 1, 0, t); }
function cmd(k){
  if (state.view.ro && !['today', 'fit'].includes(k)) return toast('Ce projet vous est partagé en lecture seule.');
  const s = selected(), f = s[s.length - 1];
  if (k === 'add' || k === 'addMs'){
    const ms = k === 'addMs'; let t;
    edit(() => { const d0 = f ? C[f.id].de + 1 : (state.els.length ? PROJ.end + 1 : isoToDay(state.start));
      t = newTask({name:ms ? 'Nouveau jalon' : 'Nouvelle tâche', ms, d:ms ? 0 : 5, s:dayToIso(f ? d0 : d0), par:f ? f.par : ''});
      if (f) insertAfter(f, t); else state.els.push(t); });
    if (t){ sel = new Set([t.id]); focusId = t.id; refresh(); renderPanel(); requestAnimationFrame(() => { const row = $(`.grow[data-id="${t.id}"]`); row?.scrollIntoView({block:'nearest'}); const cell = row?.querySelector('.c-name'); if (cell && mode === 'gantt') inlineEdit(t.id, 'name', cell); }); }
    return;
  }
  if (k === 'addSub'){ if (!f) return; let t; edit(() => { t = newTask({par:f.id, s:dayToIso(C[f.id].ds)}); const sub = subtree(f); state.els.splice(state.els.indexOf(sub[sub.length - 1]) + 1, 0, t); f.c = false; });
    if (t){ sel = new Set([t.id]); refresh(); renderPanel(); requestAnimationFrame(() => { const cell = $(`.grow[data-id="${t.id}"] .c-name`); if (cell) inlineEdit(t.id, 'name', cell); }); } return; }
  if (k === 'indent') return edit(() => topSel().forEach(t => { const sib = state.els.filter(x => x.par === t.par), i = sib.indexOf(t); if (i > 0){ const p = sib[i - 1]; t.par = p.id; p.c = false; if (p.ms){ p.ms = false; p.d = 1; } } }));
  if (k === 'outdent') return edit(() => topSel().reverse().forEach(t => { if (!t.par) return; const p = byId(t.par), blk = subtree(t); state.els = state.els.filter(x => !blk.includes(x)); const pe = subtree(p), i = state.els.indexOf(pe[pe.length - 1]); state.els.splice(i + 1, 0, ...blk); t.par = p.par; }));
  if (k === 'up' || k === 'down') return edit(() => { const L = topSel(); (k === 'down' ? L.reverse() : L).forEach(t => { const sib = state.els.filter(x => x.par === t.par), i = sib.indexOf(t), j = k === 'up' ? i - 1 : i + 1; if (j < 0 || j >= sib.length) return;
    const blk = subtree(t), other = subtree(sib[j]); state.els = state.els.filter(x => !blk.includes(x)); if (k === 'up') state.els.splice(state.els.indexOf(other[0]), 0, ...blk); else state.els.splice(state.els.indexOf(other[other.length - 1]) + 1, 0, ...blk); }); });
  if (k === 'link'){ if (s.length < 2) return toast('Sélectionnez au moins deux tâches (Ctrl + clic), ou tirez le rond au bout d\'une barre vers la tâche suivante.');
    return edit(() => { for (let i = 1; i < s.length; i++){ const a = s[i - 1], b = s[i]; if (subtree(a).includes(b) || subtree(b).includes(a)) continue; if (!b.deps.some(L => L.id === a.id)) b.deps.push({id:a.id, t:'FS', lag:0}); } schedule(); if (CYCLE) throw new Error('ces liens créeraient une boucle'); }); }
  if (k === 'unlink') return edit(() => { if (selLink){ const t = byId(selLink.to); t.deps = t.deps.filter(L => L.id !== selLink.from); selLink = null; return; } const ids = new Set(s.map(t => t.id)); if (s.length === 1) s[0].deps = []; else s.forEach(t => t.deps = t.deps.filter(L => !ids.has(L.id))); });
  if (k === 'del'){ if (selLink) return cmd('unlink'); if (!s.length) return; const all = new Set(s.flatMap(subtree).map(t => t.id)); if (all.size > 3 && !confirm(`Supprimer ${all.size} tâches ?`)) return;
    return edit(() => { state.els = state.els.filter(t => !all.has(t.id)); state.els.forEach(t => t.deps = t.deps.filter(L => !all.has(L.id))); sel.clear(); }); }
  if (k === 'dup'){ if (!f) return; const map = {}, blk = subtree(f).map(t => { const c = JSON.parse(JSON.stringify(t)); map[t.id] = c.id = uid(); return c; }); blk.forEach(c => { if (map[c.par]) c.par = map[c.par]; c.deps = c.deps.map(L => ({...L, id:map[L.id] || L.id})); }); blk[0].name += ' (copie)';
    edit(() => { const last = subtree(f).pop(); state.els.splice(state.els.indexOf(last) + 1, 0, ...blk); }); sel = new Set([blk[0].id]); refresh(); renderPanel(); return; }
  if (k === 'today') return scrollToDay(todayDay() - 7);
  if (k === 'fit') return fitAll();
}
/* menu contextuel (clic droit, appui long) */
function ctxMenu(x, y){
  const m = $('#ctxMenu'), s = selected(), one = s.length === 1 ? s[0] : null;
  m.innerHTML = `${one ? `<div class="lbl">${esc(one.name)}</div><button data-c="edit"><b>Modifier…</b><span>Dates, durée, liens, ressources</span></button>` : `<div class="lbl">${s.length} tâches</div>`}
    <button data-c="add"><b>Insérer une tâche après</b></button><button data-c="addSub"${one ? '' : ' disabled'}><b>Ajouter une sous-tâche</b></button><button data-c="addMs"><b>Insérer un jalon</b></button><hr>
    <button data-c="indent"><b>Descendre d'un niveau</b><span>Devient sous-tâche de la tâche au-dessus</span></button><button data-c="outdent"><b>Remonter d'un niveau</b></button>
    ${s.length > 1 ? '<button data-c="link"><b>Lier dans l\'ordre</b><span>Chaque tâche suit la précédente</span></button>' : ''}<button data-c="unlink"><b>Retirer les liens</b></button>
    ${one && !C[one.id].sum ? `<div class="mrow">${[0, 25, 50, 75, 100].map(p => `<button data-cp="${p}" class="${one.p === p ? 'on' : ''}">${p} %</button>`).join('')}</div>` : ''}
    <button data-c="dup"${one ? '' : ' disabled'}><b>Dupliquer</b></button><button data-c="del" class="danger"><b>Supprimer</b></button>`;
  popAt(m, x, y);
  m.onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; m.hidden = true; if (b.dataset.cp) return edit(() => s.forEach(t => { if (!C[t.id].sum) t.p = +b.dataset.cp; })); if (b.dataset.c === 'edit') return openTaskEdit(one.id); cmd(b.dataset.c); };
}
/* modèles de projet */
function tplDialog(){
  const card = engDlg(`<div class="ed-h"><h3>Partir d'un modèle</h3><button class="ib ghost" data-x aria-label="Fermer">✕</button></div><div class="tpls">${Object.entries(TEMPLATES).map(([k, v]) => `<button class="tpl" data-tpl="${k}"><b>${esc(v.t)}</b><span>${esc(v.s)}</span></button>`).join('')}<button class="tpl" data-tpl="blank"><b>Planning vide</b><span>Tout construire soi-même</span></button></div><p class="pnote">Le modèle remplace le planning ouvert (annulable avec Ctrl+Z). Il commence lundi prochain : changez la date de début dans l'onglet Projet.</p>`, 'tpl');
  card.onclick = e => { const b = e.target.closest('[data-tpl]'); if (!b) return; closeEng(); const k = b.dataset.tpl, nm = state.name;
    edit(() => { const s = k === 'blank' ? blankState(nm) : TEMPLATES[k].make(); s.name = nm; s.isSample = false; s.view = {...s.view, zoom:'week'}; state = migrate(s); }); sel.clear(); renderPanel(); requestAnimationFrame(() => scrollToDay(PROJ.start - 3)); };
}
function helpDialog(){
  engDlg(`<div class="ed-h"><h3>Raccourcis et aide</h3><button class="ib ghost" data-x aria-label="Fermer">✕</button></div><div class="help">
    <h4>Souris et doigt</h4><ul><li><b>Glisser une barre</b> : déplacer la tâche (les tâches liées suivent).</li><li><b>Bord droit d'une barre</b> : changer la durée.</li><li><b>Petit triangle sous la barre</b> : avancement.</li><li><b>Rond au bout d'une barre</b> : tirer vers une autre tâche pour les lier (fin → début).</li><li><b>Clic sur une flèche</b> : modifier le type de lien ou le décalage.</li><li><b>Double-clic</b> sur une cellule : la modifier ; sur une barre : ouvrir la fiche.</li><li><b>Clic droit / appui long</b> : menu de la tâche.</li></ul>
    <h4>Clavier</h4><ul class="kb"><li><kbd>Inser</kbd> nouvelle tâche</li><li><kbd>Maj</kbd>+<kbd>Inser</kbd> sous-tâche</li><li><kbd>J</kbd> jalon</li><li><kbd>Tab</kbd> / <kbd>Maj</kbd>+<kbd>Tab</kbd> niveau</li><li><kbd>Alt</kbd>+<kbd>↑</kbd><kbd>↓</kbd> déplacer</li><li><kbd>↑</kbd><kbd>↓</kbd> sélection</li><li><kbd>F2</kbd> renommer</li><li><kbd>L</kbd> lier</li><li><kbd>Suppr</kbd> supprimer</li><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd> annuler / rétablir</li><li><kbd>Ctrl</kbd>+<kbd>D</kbd> dupliquer</li><li><kbd>T</kbd> aujourd'hui</li></ul>
    <h4>Palette de commandes</h4><p>Ctrl+K (ou la loupe) : cherchez une tâche pour la retrouver, lancez une action, ou tapez « Pose bordures 2 sem » pour créer une tâche avec sa durée (j, sem, mois, an). Menu Fichier : « Niveler les ressources » résout les surcharges, « Rattraper les retards » replanifie à partir d'aujourd'hui.</p><h4>Liens</h4><p>FD : fin → début (le plus courant) · DD : début → début · FF : fin → fin · DF : début → fin. Un décalage négatif permet un chevauchement (ex. FD −2 : la tâche démarre 2 jours avant la fin de la précédente).</p>
    <h4>Compatibilité</h4><p>Importez et exportez les fichiers GanttProject (.gan) et MS Project (.xml). Les fichiers .mpp se convertissent depuis MS Project : Fichier → Enregistrer sous → XML.</p></div>`, 'help');
}
/* ---------- boutons, menus, clavier ---------- */
function bindUI(){
  $('.modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
  $('.gbar').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cmd) cmd(b.dataset.cmd); if (b.dataset.tog){ const k = b.dataset.tog; if (k === 'base' && !state.base){ toast('Aucune référence : enregistrez-la depuis le menu Fichier ou l\'onglet Projet.'); return; } state.view[k] = !state.view[k]; refresh(); save(); } });
  $('#vp').addEventListener('click', e => { const b = e.target.closest('[data-cmd],[data-fact]'); if (!b) return; if (b.dataset.cmd) cmd(b.dataset.cmd); if (b.dataset.fact === 'tpl') tplDialog(); if (b.dataset.fact === 'addres') addRes(); });
  $('#zoomSel').addEventListener('change', e => { const gw = $('#ganttView .gw') || $('#resView .gw'), mid = gw ? D(gw.scrollLeft + (gw.clientWidth - cols().tw) / 2) : PROJ.start; state.view.zoom = e.target.value; refresh(); save(); requestAnimationFrame(() => { const g = $('#ganttView .gw:not([hidden])') || gw; if (g) g.scrollLeft = Math.max(0, X(mid) - (g.clientWidth - cols().tw) / 2); }); });
  $('#undo').onclick = undo; $('#redo').onclick = redo;
  $('#fileBtn').addEventListener('click', e => { e.stopPropagation(); const m = $('#fileMenu'); m.hidden ? popMenu(m, e.currentTarget) : m.hidden = true; });
  $('#exportBtn').addEventListener('click', e => { e.stopPropagation(); const m = $('#exportMenu'); m.querySelector('.lock').hidden = !(window.SPAccess && window.SPAccess.level !== 'pending' && !window.SPAccess.canExport); m.hidden ? popMenu(m, e.currentTarget) : m.hidden = true; });
  $('#fileMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; $('#fileMenu').hidden = true; const k = b.dataset.act;
    ({home:() => $('#homeBtn').click(), new:() => window.APHome ? window.APHome.newProject() : window.APModel.load(blankState()), open:() => $('#fileIn').click(), tpl:tplDialog, baseline:setBaseline, baseclear:clearBaseline,
      sample:() => { if (window.APCloudActive && !confirm('Remplacer le planning ouvert par l\'exemple ? (annulable avec Ctrl+Z)')) return; edit(() => { const nm = state.name; state = sample(); if (window.APCloudActive){ state.name = nm; state.isSample = false; } }); requestAnimationFrame(() => scrollToDay(todayDay() - 10)); }, help:helpDialog, level:levelResources, catchup:catchUp, palette:openPalette})[k]?.(); });
  $('#exportMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; $('#exportMenu').hidden = true; doExport(b.dataset.act); });
  $('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const s = parseFile(f.name, r.result); const nm = state.name; edit(() => { state = s; if (window.APCloudActive) state.name = nm; }); sel.clear(); renderPanel(); toast(`${s.els.length} tâches importées depuis ${f.name}.`); requestAnimationFrame(() => fitAll()); } catch(x){ toast('Import impossible : ' + (x.message || x), 6000); } };
    r.readAsText(f); });
  $('#panelBtn').addEventListener('click', () => openPanel(!$('#panel').classList.contains('open')));
  $('#scrim').addEventListener('click', () => openPanel(false));
  $('.sheethead').addEventListener('click', () => openPanel(false));
  isNarrow.addEventListener('change', () => refresh());
  addEventListener('resize', () => { clearTimeout(bindUI.rt); bindUI.rt = setTimeout(refresh, 120); });
  document.addEventListener('keydown', e => {
    if (!$('#engDlg').hidden){ if (e.key === 'Escape') closeEng(); return; }
    if ($('#app').hidden || !$('#auth').hidden || !$('#home').hidden || !$('#apDlg').hidden) return;
    if (e.target.closest && e.target.closest('input,select,textarea,[contenteditable]')) return;
    const k = e.key, ctl = e.ctrlKey || e.metaKey;
    if (ctl && k.toLowerCase() === 'z' && !e.shiftKey){ e.preventDefault(); undo(); return; }
    if (ctl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))){ e.preventDefault(); redo(); return; }
    if (ctl && k.toLowerCase() === 'd'){ e.preventDefault(); cmd('dup'); return; }
    if (ctl && k.toLowerCase() === 'a'){ e.preventDefault(); sel = new Set(state.els.map(t => t.id)); refresh(); renderPanel(); return; }
    if (k === 'Insert' || (k === 'Enter' && !sel.size)){ e.preventDefault(); cmd(e.shiftKey ? 'addSub' : 'add'); return; }
    if (k === 'Tab'){ e.preventDefault(); cmd(e.shiftKey ? 'outdent' : 'indent'); return; }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')){ e.preventDefault(); cmd(k === 'ArrowUp' ? 'up' : 'down'); return; }
    if (k === 'ArrowUp' || k === 'ArrowDown'){ const rows = visibleRows(), i = rows.findIndex(t => t.id === focusId), j = clamp((i < 0 ? 0 : i) + (k === 'ArrowUp' ? -1 : 1), 0, rows.length - 1); if (rows[j]){ e.preventDefault(); pick(rows[j].id, e.shiftKey ? {shiftKey:true} : {}); focusId = rows[j].id; revealRow(rows[j].id); $(`.grow[data-id="${rows[j].id}"]`)?.scrollIntoView({block:'nearest'}); } return; }
    if (k === 'Delete' || k === 'Backspace'){ e.preventDefault(); cmd('del'); return; }
    if (k === 'F2' && focusId){ e.preventDefault(); const c = $(`.grow[data-id="${focusId}"] .c-name`); if (c) inlineEdit(focusId, 'name', c); return; }
    if (k === 'Enter' && focusId){ e.preventDefault(); openTaskEdit(focusId); return; }
    if (k === 'Escape'){ sel.clear(); selLink = null; refresh(); renderPanel(); return; }
    if (ctl || e.altKey) return;
    if (k === 'j' || k === 'J') cmd('addMs'); else if (k === 'l' || k === 'L') cmd('link'); else if (k === 't' || k === 'T') cmd('today');
    else if (k === '1') setMode('gantt'); else if (k === '2') setMode('res'); else if (k === '3') setMode('pert');
  });
}
/* ---------- thème ---------- */
function setTheme(t){ document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; try { localStorage.setItem('aph.theme', document.documentElement.dataset.theme); } catch(e){} if (state) refresh(); }
window.APTheme = setTheme;
/* ---------- démarrage ---------- */
(() => {
  let s = null; try { s = JSON.parse(localStorage.getItem('archiphase.v1') || 'null'); } catch(e){}
  state = s && Array.isArray(s.els) ? migrate(s) : blankState();
  bindUI(); bindPanel(); bindTools(); setTab('task'); refresh(); renderPanel();
})();
/* résumé du projet pour la carte de l'accueil (< 800 caractères) */
function projInfo(){ try {
  const leaves = state.els.filter(t => !C[t.id].sum), cur = leaves.filter(t => { const r = C[t.id], td = todayDay(); return r.ds <= td && td <= r.de; }).map(t => t.name).slice(0, 3);
  return JSON.stringify({v:1, from:dayToIso(PROJ.start), to:dayToIso(PROJ.end), p:PROJ.p, n:leaves.filter(t => !t.ms).length, ms:leaves.filter(t => t.ms).length, late:leaves.filter(behind).length, cur, next:(state.els.filter(t => t.ms && C[t.id].ds >= todayDay()).sort((a, b) => C[a.id].ds - C[b.id].ds)[0] || {}).name || ''}).slice(0, 790);
} catch(e){ return ''; } }
window.APModel = { info:projInfo,
  get:() => JSON.stringify(state),
  name:() => state.name,
  sample:() => sample(),
  parseFile:(name, text) => JSON.parse(JSON.stringify(parseFile(name, text))),
  load(s){
    quiet = true;
    try { state = migrate(s); hist.length = 0; redoS.length = 0; sel = new Set(); selLink = null; focusId = null; $('#zoomSel').value = state.view.zoom;
      state.view.ro = false; $('#ganttView').innerHTML = ''; $('#resView').innerHTML = ''; refresh(); renderPanel(); $('#projName').textContent = state.name; }
    finally { quiet = false; }
    requestAnimationFrame(() => scrollToDay(Math.max(PROJ.start, Math.min(todayDay(), PROJ.end)) - 7, true));
  },
  thumb,
  setUserLib(lib){},
};
window.dispatchEvent(new Event('ap:ready'));
window.__apReady = true;
(() => { const sp = document.getElementById('splash'); if (!sp) return; if (window.__spHide){ window.__spHide(); return; } setTimeout(() => { sp.classList.add('done'); setTimeout(() => sp.remove(), 600); }, 2600); })();
/* ---------- bouton Réglages (module commun Studio Prism) ---------- */
PrismSettings.init({
  app:'ARCHIPHASE',
  theme:{get:() => document.documentElement.dataset.theme || 'light', set:t => setTheme(t)},
  scaleSel:'.top, .gbar, .ap-side, .panel, .menu',
  onResize:() => { window.dispatchEvent(new Event('resize')); },
  sections:[
    {title:'Planning', fields:[
      {type:'seg', label:'Échelle de temps par défaut', options:[['day', 'Jours'], ['week', 'Semaines'], ['month', 'Mois'], ['quarter', 'Trimestres']], get:() => state.view.zoom, set:v => { state.view.zoom = v; $('#zoomSel').value = v; refresh(); save(); }},
      {type:'switch', label:'Afficher le chemin critique', get:() => !!state.view.crit, set:v => { state.view.crit = v; refresh(); save(); }},
      {type:'switch', label:'Comparer à la référence', sub:'Barre grise sous chaque tâche : dates du planning de référence', get:() => !!state.view.base, set:v => { state.view.base = v && !!state.base; refresh(); save(); }}]}],
  shortcuts:() => [['Inser', 'Nouvelle tâche'], ['Maj+Inser', 'Sous-tâche'], ['J', 'Jalon'], ['Tab', 'Descendre d\'un niveau'], ['Maj+Tab', 'Remonter d\'un niveau'], ['Alt+↑ / ↓', 'Déplacer la tâche'], ['F2', 'Renommer'], ['L', 'Lier les tâches sélectionnées'], ['Suppr', 'Supprimer'], ['Ctrl+D', 'Dupliquer'], ['Ctrl+Z', 'Annuler'], ['Ctrl+Y', 'Rétablir'], ['T', 'Aller à aujourd\'hui'], ['1 · 2 · 3', 'Gantt · Ressources · PERT']],
});
/* accès de diagnostic (console, tests automatiques) */
window.APHDebug = {toGan, toMsp, toCsv, toIcs, ganttSVG, get state(){ return state; }, set state(s){ state = s; }, get C(){ return C; }, get PROJ(){ return PROJ; }, refresh, schedule};
