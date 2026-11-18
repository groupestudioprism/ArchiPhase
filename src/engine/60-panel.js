/* ============ Panneau de droite : Tâche · Projet · Ressources · Calendrier ============ */
let tab = 'task';
function setTab(k){ tab = k; $$('#panel .tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === k))); }
function openPanel(on = true){ $('#panel').classList.toggle('open', on); $('#scrim').classList.toggle('on', on && isNarrow.matches); }
function openTaskEdit(id){ sel = new Set([id]); focusId = id; setTab('task'); refresh(); renderPanel(); openPanel(true); setTimeout(() => $('#tpName')?.focus(), 60); }
const fld = (lab, html, cls = '') => `<label class="pf ${cls}"><span>${lab}</span>${html}</label>`;
const swatches = (cur, attr) => `<div class="sws">${COLORS.map(c => `<button type="button" class="sw${cur === c[0] ? ' on' : ''}" ${attr}="${c[0]}" style="--c:${c[1]}" title="${c[0]}" aria-label="Couleur ${c[0]}"></button>`).join('')}</div>`;
function renderPanel(){
  const b = $('#pbody'); if (!b || !state) return;
  const ro = !!state.view.ro;
  b.innerHTML = tab === 'task' ? taskPanel() : tab === 'project' ? projectPanel() : tab === 'res' ? resPanel() : calPanel();
  b.querySelectorAll('input,select,textarea,button[data-pa]').forEach(x => { if (ro && !x.closest('.pinfo')) x.disabled = true; });
}
function taskPanel(){
  if (selLink){ const t = byId(selLink.to), p = byId(selLink.from), L = t?.deps.find(x => x.id === selLink.from); if (L) return `<div class="ph"><small>Lien</small><h3>${esc(p.name)} → ${esc(t.name)}</h3></div>
    ${fld('Type de lien', `<select data-pl="t">${Object.entries(LINKS).map(([k, v]) => `<option value="${k}"${L.t === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`)}
    ${fld('Décalage (jours ouvrés, négatif = chevauchement)', `<input type="number" step="1" data-pl="lag" value="${L.lag}">`)}
    <p class="pnote">${{FS:'La tâche suivante commence après la fin de la précédente.', SS:'Les deux tâches peuvent commencer ensemble (décalage possible).', FF:'Les deux tâches finissent ensemble (décalage possible).', SF:'La tâche suivante finit quand la précédente commence.'}[L.t]}</p>
    <button class="pbtn danger" data-pa="unlinkSel">Supprimer ce lien</button>`; }
  const ids = [...sel].filter(id => byId(id));
  if (!ids.length) return `<div class="pempty"><svg viewBox="0 0 24 24"><path d="M4 6h9M7 11h10M10 16h8"/></svg><b>Aucune tâche sélectionnée</b><span>Cliquez sur une ligne ou une barre. Double-clic : modifier le nom, la durée, les dates.</span>
    <div class="pquick"><button class="pbtn" data-cmd="add">+ Tâche</button><button class="pbtn" data-cmd="addMs">+ Jalon</button></div></div>${projStats()}`;
  if (ids.length > 1) return `<div class="ph"><small>Sélection</small><h3>${ids.length} tâches</h3></div>
    ${fld('Avancement', `<input type="range" min="0" max="100" step="5" data-pm="p" value="${Math.round(ids.reduce((a, id) => a + byId(id).p, 0) / ids.length)}">`)}
    <div class="pf"><span>Couleur</span>${swatches('', 'data-pmc')}</div>
    <div class="pbtns"><button class="pbtn" data-cmd="link">Lier dans l'ordre</button><button class="pbtn" data-cmd="unlink">Délier</button><button class="pbtn" data-cmd="indent">Descendre d'un niveau</button><button class="pbtn danger" data-cmd="del">Supprimer</button></div>`;
  const t = byId(ids[0]), r = C[t.id], S = r.sum, W1 = wbs();
  const succ = state.els.filter(x => x.deps.some(L => L.id === t.id));
  const opts = (cur, excl) => state.els.filter(x => !excl.has(x.id)).map(x => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${W1[x.id]} · ${esc(x.name)}</option>`).join('');
  const excl = new Set(subtree(t).map(x => x.id).concat(ancestors(t).map(x => x.id)));
  return `<div class="ph"><small>${W1[t.id]} · ${S ? 'Tâche récapitulative' : t.ms ? 'Jalon' : 'Tâche'}</small><input id="tpName" class="ph-in" data-pt="name" value="${esc(t.name)}" aria-label="Nom de la tâche"></div>
    ${S ? `<div class="pinfo"><div><span>Début</span><b>${fmtD(r.ds)}</b></div><div><span>Fin</span><b>${fmtD(r.de)}</b></div><div><span>Durée</span><b>${r.dur} j</b></div><div><span>Avancement</span><b>${r.p} %</b></div></div><p class="pnote">Dates et avancement calculés à partir des ${kids(t.id).length} sous-tâches.</p>` : `
    <div class="pseg"><button type="button" data-pt-ms="0" class="${t.ms ? '' : 'on'}">Tâche</button><button type="button" data-pt-ms="1" class="${t.ms ? 'on' : ''}">Jalon</button></div>
    <div class="pgrid">${fld('Début souhaité', `<input type="date" data-pt="s" value="${t.s}">`)}${t.ms ? '' : fld('Durée (j ouvrés)', `<input type="number" min="1" step="1" data-pt="d" value="${t.d}">`)}${t.ms ? '' : fld('Fin', `<input type="date" data-pt="end" value="${dayToIso(r.de)}">`)}</div>
    ${r.ds !== isoToDay(t.s) ? `<p class="pnote warn">Calculé : début le ${fmtDL(r.ds)}${t.deps.length || ancestors(t).some(a => a.deps.length) ? ' (repoussé par ses liens)' : ' (jour non travaillé)'}.</p>` : ''}
    ${fld(`Avancement · <b>${t.p} %</b>`, `<input type="range" min="0" max="100" step="5" data-pt="p" value="${t.p}">`)}`}
    <div class="pf"><span>Couleur</span>${swatches(t.col, 'data-ptc')}</div>
    ${S ? '' : fld('Priorité', `<select data-pt="prio">${Object.entries(PRIOS).map(([k, v]) => `<option value="${k}"${t.prio === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`)}
    <h4 class="psec">Prédécesseurs <small>${t.deps.length || ''}</small></h4>
    ${t.deps.map((L, i) => `<div class="prow3"><select data-dep="${i}" data-k="id">${opts(L.id, excl)}</select><select data-dep="${i}" data-k="t" title="Type de lien">${Object.keys(LINKS).map(k => `<option value="${k}"${L.t === k ? ' selected' : ''} title="${LINKS[k]}">${k === 'FS' ? 'FD' : k === 'SS' ? 'DD' : k === 'FF' ? 'FF' : 'DF'}</option>`).join('')}</select><input type="number" step="1" data-dep="${i}" data-k="lag" value="${L.lag}" title="Décalage en jours ouvrés"><button class="px" data-deprm="${i}" aria-label="Retirer">×</button></div>`).join('')}
    <button class="padd" data-pa="addDep">+ Ajouter un prédécesseur</button>
    ${succ.length ? `<p class="pnote">Successeurs : ${succ.map(x => esc(x.name)).join(', ')}</p>` : ''}
    ${S ? '' : `<h4 class="psec">Ressources <small>${t.res.length || ''}</small></h4>
    ${t.res.map((a, i) => `<div class="prow2"><select data-ra="${i}" data-k="id">${state.res.map(q => `<option value="${q.id}"${q.id === a.id ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}</select><label class="pu"><input type="number" min="1" max="1000" step="5" data-ra="${i}" data-k="u" value="${a.u}"><span>%</span></label><button class="px" data-rarm="${i}" aria-label="Retirer">×</button></div>`).join('')}
    ${state.res.length ? `<button class="padd" data-pa="addRa">+ Affecter une ressource</button>` : `<button class="padd" data-pa="toRes">+ Créer des ressources</button>`}`}
    <h4 class="psec">Notes</h4><textarea data-pt="note" rows="3" placeholder="Consignes, contraintes, contacts…">${esc(t.note)}</textarea>
    <div class="pinfo"><div><span>Début calculé</span><b>${fmtD(r.ds)}</b></div><div><span>Fin</span><b>${fmtD(r.de)}</b></div><div><span>Marge totale</span><b>${Math.max(0, r.slack)} j</b></div><div><span>Chemin critique</span><b>${r.crit ? 'Oui' : 'Non'}</b></div>${r.cost ? `<div><span>Coût estimé</span><b>${eur(r.cost)}</b></div>` : ''}${state.base?.t?.[t.id] ? `<div><span>Écart / référence</span><b class="${r.late ? 'neg' : ''}">${r.late ? '+' + r.late + ' j' : 'à l\'heure'}</b></div>` : ''}</div>
    <div class="pbtns"><button class="pbtn" data-cmd="addSub">+ Sous-tâche</button><button class="pbtn" data-pa="dup">Dupliquer</button><button class="pbtn danger" data-cmd="del">Supprimer</button></div>`;
}
function projStats(){
  const leaves = state.els.filter(t => !C[t.id].sum), ms = leaves.filter(t => t.ms).length, crit = leaves.filter(t => C[t.id].crit && !t.ms).length, late = leaves.filter(behind).length;
  return `<div class="pinfo big"><div><span>Début</span><b>${fmtD(PROJ.start)}</b></div><div><span>Fin</span><b>${fmtD(PROJ.end)}</b></div><div><span>Durée</span><b>${Math.max(0, PROJ.ef - PROJ.es + 1)} j ouvrés</b></div><div><span>Avancement</span><b>${PROJ.p} %</b></div>
    <div><span>Tâches</span><b>${leaves.length - ms}</b></div><div><span>Jalons</span><b>${ms}</b></div><div><span>Critiques</span><b>${crit}</b></div><div><span>En retard</span><b class="${late ? 'neg' : ''}">${late}</b></div>${PROJ.cost ? `<div class="w2"><span>Coût estimé (ressources)</span><b>${eur(PROJ.cost)}</b></div>` : ''}${state.base ? `<div class="w2"><span>Écart sur la référence</span><b class="${PROJ.late ? 'neg' : ''}">${PROJ.late ? '+' + PROJ.late + ' j ouvrés' : 'Aucun retard'}</b></div>` : ''}</div>
    <div class="pbar"><i style="width:${PROJ.p}%"></i></div>`;
}
function projectPanel(){
  const m = state.meta;
  return `<div class="ph"><small>Projet</small><h3>${esc(state.name)}</h3></div>${projStats()}
    ${fld('Début du projet', `<input type="date" data-pp="start" value="${state.start}">`)}<p class="pnote">Changer cette date décale tout le planning du même nombre de jours.</p>
    ${fld('Client / maître d\'ouvrage', `<input data-pm2="client" value="${esc(m.client)}">`)}
    ${fld('Responsable', `<input data-pm2="manager" value="${esc(m.manager)}">`)}
    ${fld('Description', `<textarea data-pm2="desc" rows="3">${esc(m.desc)}</textarea>`)}
    <h4 class="psec">Planning de référence</h4>
    <p class="pnote">${state.base ? `Référence enregistrée le ${new Date(state.base.at).toLocaleDateString('fr-FR')} (${Object.keys(state.base.t).length} tâches). Activez « Référence » dans la barre pour voir les écarts.` : 'Enregistrez le planning validé (signature du marché, ordre de service…) pour suivre les écarts ensuite.'}</p>
    <div class="pbtns"><button class="pbtn" data-pa="baseline">${state.base ? 'Mettre à jour la référence' : 'Enregistrer la référence'}</button>${state.base ? '<button class="pbtn" data-pa="baseclear">Effacer</button>' : ''}</div>`;
}
function resPanel(){
  const L = resLoad();
  return `<div class="ph"><small>Ressources</small><h3>Équipes, personnes, engins</h3></div>
    ${state.res.map(r => { const m = L[r.id]; let peak = 0, d = 0; m.forEach(v => { peak = Math.max(peak, v); d += v / 100; });
      return `<div class="rcard${selRes === r.id ? ' on' : ''}" data-rc="${r.id}"><div class="rtop"><input data-rs="${r.id}" data-k="name" value="${esc(r.name)}" aria-label="Nom"><button class="px" data-rsrm="${r.id}" aria-label="Supprimer la ressource">×</button></div>
        <div class="pgrid">${fld('Rôle', `<input data-rs="${r.id}" data-k="role" value="${esc(r.role)}">`)}${fld('Coût / jour (€)', `<input type="number" min="0" step="10" data-rs="${r.id}" data-k="rate" value="${r.rate}">`)}${fld('Capacité (%)', `<input type="number" min="1" step="10" data-rs="${r.id}" data-k="cap" value="${r.cap}">`)}</div>
        ${swatches(r.col, `data-rsc="${r.id}" data-rcol`)}<p class="pnote ${peak > r.cap ? 'warn' : ''}">${Math.round(d * 10) / 10} jours de travail · pic ${peak ? Math.round(peak / r.cap * 100) : 0} %${peak > r.cap ? ' : surcharge' : ''}</p></div>`; }).join('')}
    <button class="padd" data-pa="addRes">+ Ajouter une ressource</button>`;
}
function calPanel(){
  const c = state.cal, y0 = dayDate(PROJ.start).getUTCFullYear(), y1 = dayDate(PROJ.end).getUTCFullYear();
  const hol = []; for (let y = y0; y <= Math.min(y1, y0 + 3); y++) frHolidays(y).forEach((n, d) => { if (d >= PROJ.start - 7 && d <= PROJ.end + 7) hol.push([d, n]); });
  hol.sort((a, b) => a[0] - b[0]);
  return `<div class="ph"><small>Calendrier</small><h3>Jours travaillés</h3></div>
    <div class="pdays">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button type="button" data-wd="${i}" class="${c.week[i] ? 'on' : ''}">${JOURS[i].slice(0, 3)}</button>`).join('')}</div>
    <label class="pchk"><input type="checkbox" data-cal="hol"${c.hol !== false ? ' checked' : ''}><span>Jours fériés français chômés</span></label>
    ${c.hol !== false && hol.length ? `<ul class="plist">${hol.map(([d, n]) => `<li><b>${fmtD(d)}</b>${esc(n)}</li>`).join('')}</ul>` : ''}
    <h4 class="psec">Fermetures et congés</h4>
    ${(c.off || []).map((o, i) => `<div class="prow3 off"><input type="date" data-off="${i}" data-k="from" value="${o.from}"><input type="date" data-off="${i}" data-k="to" value="${o.to || o.from}"><input data-off="${i}" data-k="name" value="${esc(o.name || '')}" placeholder="Motif"><button class="px" data-offrm="${i}" aria-label="Retirer">×</button></div>`).join('')}
    <button class="padd" data-pa="addOff">+ Ajouter une fermeture (congés, intempéries…)</button>
    <h4 class="psec">Jours travaillés exceptionnels</h4>
    ${(c.on || []).map((d, i) => `<div class="prow2"><input type="date" data-on="${i}" value="${d}"><button class="px" data-onrm="${i}" aria-label="Retirer">×</button></div>`).join('')}
    <button class="padd" data-pa="addOn">+ Ajouter un jour travaillé (samedi, pont…)</button>`;
}
/* ---------- événements du panneau ---------- */
function bindPanel(){
  const b = $('#pbody');
  $('#panel .tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (!t) return; setTab(t.dataset.tab); renderPanel(); });
  b.addEventListener('change', e => {
    const x = e.target, v = x.value, ids = [...sel].filter(id => byId(id)), t = byId(ids[0]);
    if (x.dataset.pl && selLink){ edit(() => { const L = byId(selLink.to).deps.find(q => q.id === selLink.from); if (x.dataset.pl === 't') L.t = v; else L.lag = Math.round(num(v)) || 0; }); return; }
    if (x.dataset.pt && t){ const k = x.dataset.pt; edit(() => {
      if (k === 'name') t.name = v.trim() || t.name; else if (k === 's'){ if (Number.isFinite(isoToDay(v))) t.s = v; }
      else if (k === 'd'){ const n = Math.round(num(v)); if (n >= 1) t.d = n; } else if (k === 'end'){ const d = isoToDay(v); if (Number.isFinite(d)) t.d = Math.max(1, CAL.count(C[t.id].ds, d)); }
      else if (k === 'p') t.p = clamp(+v, 0, 100); else if (k === 'prio') t.prio = v; else if (k === 'note') t.note = v; }); return; }
    if (x.dataset.pm === 'p'){ edit(() => ids.forEach(id => { if (!C[id].sum) byId(id).p = +v; })); return; }
    if (x.dataset.dep != null && t){ const L = t.deps[+x.dataset.dep], k = x.dataset.k; const old = {...L}; edit(() => { if (k === 'lag') L.lag = Math.round(num(v)) || 0; else L[k] = v; schedule(); if (CYCLE){ Object.assign(L, old); throw new Error('ce lien créerait une boucle'); } }); return; }
    if (x.dataset.ra != null && t){ const a = t.res[+x.dataset.ra]; edit(() => { if (x.dataset.k === 'u') a.u = clamp(Math.round(num(v)) || 100, 1, 1000); else a.id = v; }); return; }
    if (x.dataset.pp === 'start'){ const d1 = isoToDay(v), d0 = isoToDay(state.start); if (!Number.isFinite(d1)) return; edit(() => { const dd = d1 - d0; state.start = v; state.els.forEach(q => q.s = dayToIso(isoToDay(q.s) + dd)); }); return; }
    if (x.dataset.pm2){ edit(() => state.meta[x.dataset.pm2] = v, {keepPanel:true}); return; }
    if (x.dataset.rs){ const r = state.res.find(q => q.id === x.dataset.rs), k = x.dataset.k; edit(() => { r[k] = k === 'rate' ? Math.max(0, num(v) || 0) : k === 'cap' ? clamp(num(v) || 100, 1, 10000) : v; }); return; }
    if (x.dataset.cal === 'hol'){ edit(() => state.cal.hol = x.checked); return; }
    if (x.dataset.off != null){ const o = state.cal.off[+x.dataset.off]; edit(() => { o[x.dataset.k] = v; if (o.to < o.from) o.to = o.from; }); return; }
    if (x.dataset.on != null){ edit(() => state.cal.on[+x.dataset.on] = v); return; }
  });
  b.addEventListener('input', e => { const x = e.target; if (x.dataset.pt === 'p' && x.type === 'range'){ const l = x.closest('.pf')?.querySelector('b'); if (l) l.textContent = x.value + ' %'; } });
  b.addEventListener('click', e => {
    const x = e.target.closest('button'); if (!x) return; const ids = [...sel].filter(id => byId(id)), t = byId(ids[0]);
    if (x.dataset.cmd) return cmd(x.dataset.cmd);
    if (x.dataset.ptMs != null && t){ edit(() => { t.ms = x.dataset.ptMs === '1'; if (t.ms) t.d = 0; else t.d = Math.max(1, t.d || 1); }); return; }
    if (x.dataset.ptc && t) return edit(() => t.col = t.col === x.dataset.ptc ? '' : x.dataset.ptc);
    if (x.dataset.pmc) return edit(() => ids.forEach(id => byId(id).col = x.dataset.pmc));
    if (x.dataset.rsc) return edit(() => state.res.find(q => q.id === x.dataset.rsc).col = x.dataset.rcol);
    if (x.dataset.deprm != null && t) return edit(() => t.deps.splice(+x.dataset.deprm, 1));
    if (x.dataset.rarm != null && t) return edit(() => t.res.splice(+x.dataset.rarm, 1));
    if (x.dataset.rsrm){ const r = state.res.find(q => q.id === x.dataset.rsrm), n = state.els.filter(q => q.res.some(a => a.id === r.id)).length;
      if (n && !confirm(`Supprimer « ${r.name} » ? Elle est affectée à ${n} tâche${n > 1 ? 's' : ''}.`)) return; return edit(() => { state.res = state.res.filter(q => q !== r); state.els.forEach(q => q.res = q.res.filter(a => a.id !== r.id)); }); }
    if (x.dataset.offrm != null) return edit(() => state.cal.off.splice(+x.dataset.offrm, 1));
    if (x.dataset.onrm != null) return edit(() => state.cal.on.splice(+x.dataset.onrm, 1));
    if (x.dataset.wd != null) return edit(() => { const w = [...state.cal.week]; w[+x.dataset.wd] = w[+x.dataset.wd] ? 0 : 1; if (!w.some(Boolean)) throw new Error('il faut au moins un jour travaillé'); state.cal.week = w; });
    const a = x.dataset.pa; if (!a) return;
    if (a === 'unlinkSel' && selLink) return edit(() => { const q = byId(selLink.to); q.deps = q.deps.filter(L => L.id !== selLink.from); selLink = null; });
    if (a === 'addDep' && t){ const W1 = state.els, ex = new Set(subtree(t).map(q => q.id).concat(ancestors(t).map(q => q.id)).concat(t.deps.map(L => L.id))), i = W1.indexOf(t);
      const cand = W1.slice(0, i).reverse().find(q => !ex.has(q.id) && !C[q.id].sum) || W1.find(q => !ex.has(q.id)); if (!cand) return toast('Aucune autre tâche à lier.'); return addLink(cand.id, t.id); }
    if (a === 'addRa' && t){ const free = state.res.find(q => !t.res.some(r => r.id === q.id)) || state.res[0]; return edit(() => t.res.push({id:free.id, u:100})); }
    if (a === 'toRes'){ setTab('res'); return renderPanel(); }
    if (a === 'addRes') return addRes();
    if (a === 'dup' && t) return cmd('dup');
    if (a === 'addOff'){ const d = dayToIso(Math.max(todayDay(), PROJ.start)); return edit(() => state.cal.off.push({from:d, to:d, name:''})); }
    if (a === 'addOn'){ let d = Math.max(todayDay(), PROJ.start); while (CAL.w(d)) d++; return edit(() => state.cal.on.push(dayToIso(d))); }
    if (a === 'baseline') return setBaseline();
    if (a === 'baseclear') return clearBaseline();
  });
}
function addRes(){ const n = state.res.length; edit(() => state.res.push({id:'r' + uid().slice(1), name:'Ressource ' + (n + 1), role:'', col:COLORS[(n + 1) % COLORS.length][0], rate:0, cap:100})); setTab('res'); renderPanel(); setTimeout(() => { const i = $$('#pbody .rcard input[data-k="name"]').pop(); i?.focus(); i?.select(); }, 30); }
function setBaseline(){ edit(() => { state.base = {at:Date.now(), t:Object.fromEntries(state.els.map(t => [t.id, [dayToIso(C[t.id].ds), dayToIso(C[t.id].de)]]))}; state.view.base = true; }); toast('Référence enregistrée : les écarts apparaissent sous chaque barre.'); }
function clearBaseline(){ if (!state.base) return; edit(() => { state.base = null; state.view.base = false; }); toast('Référence effacée.'); }
