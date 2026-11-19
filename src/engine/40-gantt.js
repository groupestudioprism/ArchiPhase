/* ============ Vue Gantt : tableau des tâches + chronologie ============
   Un seul conteneur qui défile dans les deux sens ; l'en-tête (haut) et le tableau (gauche) restent collés (position: sticky).
   Barres en HTML (faciles à saisir au doigt et à la souris), liens en SVG. Rendu complet à chaque modification (quelques centaines de tâches sans souci). */
const ZOOMS = {day:{px:30, pad:7, lab:'Jours'}, week:{px:12, pad:21, lab:'Semaines'}, month:{px:4, pad:62, lab:'Mois'}, quarter:{px:1.4, pad:150, lab:'Trimestres'}};
const RH = () => MQ_COARSE.matches ? 40 : 34;
const HH = 50;
let TL = {d0:0, d1:0, px:12};
let mode = 'gantt';
function tlRange(){
  const z = ZOOMS[state.view.zoom] || ZOOMS.week, td = todayDay();
  let a = Math.min(PROJ.start, isoToDay(state.start)), b = Math.max(PROJ.end, a + 30);
  if (Math.abs(td - a) < 400) a = Math.min(a, td); if (Math.abs(td - b) < 400) b = Math.max(b, td);
  a -= z.pad; b += z.pad * 2;
  if (state.view.zoom === 'day' || state.view.zoom === 'week') a -= (dow(a) + 6) % 7;   // commence un lundi
  else { const x = dayDate(a); a = Math.floor(Date.UTC(x.getUTCFullYear(), state.view.zoom === 'quarter' ? Math.floor(x.getUTCMonth() / 3) * 3 : x.getUTCMonth(), 1) / DAY); }
  TL = {d0:a, d1:b, px:z.px};
}
const X = d => (d - TL.d0) * TL.px;
const D = x => TL.d0 + Math.floor(x / TL.px);
/* en-tête de la chronologie (2 lignes), commun au Gantt et à la vue des ressources */
function headerHTML(){
  const z = state.view.zoom, {d0, d1, px} = TL; let top = '', bot = '';
  const cell = (cls, x, w, txt, title = '') => `<div class="${cls}" style="left:${x.toFixed(1)}px;width:${Math.max(0, w).toFixed(1)}px"${title ? ` title="${esc(title)}"` : ''}><span>${txt}</span></div>`;
  const months = []; { let x = dayDate(d0), m = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1) / DAY; while (m <= d1){ const y = dayDate(m), n = Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + 1, 1) / DAY; months.push([m, n, y]); m = n; } }
  if (z === 'day' || z === 'week'){
    months.forEach(([a, b, y]) => { const xa = Math.max(X(a), 0); top += cell('th1', xa, X(b) - xa, `${MOIS[y.getUTCMonth()]} ${y.getUTCFullYear()}`); });
    if (z === 'day') for (let d = d0; d <= d1; d++){ const x = dayDate(d), h = holidayName(d); bot += cell('th2' + (CAL.w(d) ? '' : ' off') + (d === todayDay() ? ' now' : ''), X(d), px, `<i>${JOURS[x.getUTCDay()][0].toUpperCase()}</i>${x.getUTCDate()}`, h); }
    else for (let d = d0; d <= d1; d += 7) bot += cell('th2' + (todayDay() >= d && todayDay() < d + 7 ? ' now' : ''), X(d), 7 * px, `S${isoWeek(d)} <small>${dayDate(d).getUTCDate()}/${dayDate(d).getUTCMonth() + 1}</small>`);
  } else {
    let y0 = dayDate(d0).getUTCFullYear(), y1 = dayDate(d1).getUTCFullYear();
    for (let y = y0; y <= y1; y++){ const a = Date.UTC(y, 0, 1) / DAY, b = Date.UTC(y + 1, 0, 1) / DAY, xa = Math.max(X(a), 0); top += cell('th1', xa, X(b) - xa, String(y)); }
    if (z === 'month') months.forEach(([a, b, y]) => { bot += cell('th2', X(a), X(b) - X(a), MOIS_C[y.getUTCMonth()]); });
    else months.filter(m => m[2].getUTCMonth() % 3 === 0).forEach(([a, , y]) => { const b = Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + 3, 1) / DAY; bot += cell('th2', X(a), X(b) - X(a), 'T' + (y.getUTCMonth() / 3 + 1)); });
  }
  return `<div class="tr1">${top}</div><div class="tr2">${bot}</div>`;
}
/* fond : jours chômés grisés, séparations, ligne « aujourd'hui » */
function bgSVG(h){
  const z = state.view.zoom, {d0, d1, px} = TL, W = X(d1 + 1); let off = '', lines = '';
  if (z === 'day' || z === 'week'){ for (let d = d0; d <= d1; d++) if (!CAL.w(d)){ let e = d; while (e + 1 <= d1 && !CAL.w(e + 1)) e++; off += `<rect x="${X(d)}" y="0" width="${(e - d + 1) * px}" height="${h}"/>`; d = e; } }
  if (z === 'day') for (let d = d0; d <= d1; d++) lines += `M${X(d) + .5} 0V${h}`;
  else if (z === 'week') for (let d = d0; d <= d1; d += 7) lines += `M${X(d) + .5} 0V${h}`;
  else { let x = dayDate(d0), m = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1) / DAY; while (m <= d1){ lines += `M${X(m) + .5} 0V${h}`; const y = dayDate(m); m = Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + (z === 'quarter' ? 3 : 1), 1) / DAY; } }
  const td = todayDay(), tx = X(td) + (z === 'day' ? px / 2 : 0);
  return `<svg class="gbg" width="${W}" height="${h}" aria-hidden="true"><g class="off">${off}</g><path class="grid" d="${lines}"/>${td >= d0 && td <= d1 ? `<path class="today" d="M${tx} 0V${h}"/>` : ''}</svg>`;
}
const colOf = t => COLOR[t.col] || (C[t.id]?.crit && state.view.crit ? COLOR.rouge : COLOR.teal);
function cols(){
  const narrow = isNarrow.matches, tw = narrow ? Math.min(230, innerWidth * .52) : (state.view.tw || 520);
  const c = narrow ? [['name', 'Tâche', 0], ['dur', 'Durée', 60]] : [['wbs', 'N°', 44], ['name', 'Tâche', 0], ['start', 'Début', 74], ['end', 'Fin', 74], ['dur', 'Durée', 62], ['p', '%', 52]];
  const fixed = c.reduce((a, x) => a + x[2], 0); c.find(x => x[0] === 'name')[2] = Math.max(120, tw - fixed);
  return {c, tw:c.reduce((a, x) => a + x[2], 0)};
}
function renderGantt(){
  const host = $('#ganttView'); let gw = host.querySelector('.gw');
  const keep = gw ? [gw.scrollLeft, gw.scrollTop] : null;
  if (!gw){ host.innerHTML = '<div class="gw" tabindex="-1"></div>'; gw = host.querySelector('.gw'); bindGantt(gw); }
  tlRange();
  const rows = visibleRows(), rh = RH(), H = Math.max(rows.length * rh, gw.clientHeight - HH), W = X(TL.d1 + 1), {c, tw} = cols(), W1 = wbs();
  const gt = c.map(x => x[2] + 'px').join(' ');
  let th = `<div class="gth" style="grid-template-columns:${gt}">${c.map(x => `<div class="c-${x[0]}">${x[1]}</div>`).join('')}<i class="gsplit" title="Glisser pour élargir le tableau"></i></div>`;
  let tb = '', bars = '', ys = {};
  rows.forEach((t, i) => {
    const r = C[t.id], y = i * rh, s = sel.has(t.id), lv = r.lvl, isS = r.sum, late = behind(t);
    ys[t.id] = y;
    const cells = {wbs:`<div class="c-wbs">${W1[t.id]}</div>`,
      name:`<div class="c-name" style="padding-left:${6 + lv * 16}px">${isS ? `<button class="car${t.c ? ' shut' : ''}" data-car="${t.id}" aria-label="${t.c ? 'Déplier' : 'Replier'}"><svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3"/></svg></button>` : `<i class="dot${t.ms ? ' ms' : ''}" style="--c:${colOf(t)[1]}"></i>`}<span class="nm${isS ? ' sum' : ''}">${esc(t.name)}</span>${late ? '<b class="late" title="En retard sur l\'avancement attendu">!</b>' : ''}</div>`,
      start:`<div class="c-start">${fmtD(r.ds)}</div>`, end:`<div class="c-end">${fmtD(r.de)}</div>`,
      dur:`<div class="c-dur">${t.ms ? '<span class="msl">jalon</span>' : fmtDur(r.dur, t.du)}</div>`, p:`<div class="c-p">${r.p}%</div>`};
    tb += `<div class="grow${s ? ' sel' : ''}${isS ? ' sum' : ''}" data-id="${t.id}" style="top:${y}px;height:${rh}px;grid-template-columns:${gt}">${c.map(x => cells[x[0]]).join('')}</div>`;
    // barre
    const x0 = X(r.ds), x1 = X(r.de + 1), cy = y + rh / 2, base = state.view.base && state.base?.t?.[t.id];
    if (base){ const b0 = isoToDay(base[0]), b1 = isoToDay(base[1]); bars += `<div class="bbase${t.ms ? ' ms' : ''}" style="left:${X(b0)}px;width:${t.ms ? 0 : Math.max(2, X(b1 + 1) - X(b0))}px;top:${y + rh - 9}px"></div>`; }
    if (t.ms) bars += `<div class="bar ms${s ? ' sel' : ''}${r.crit && state.view.crit ? ' crit' : ''}" data-bar="${t.id}" style="left:${x0 - 9}px;top:${cy - 9}px;--c:${colOf(t)[1]}"><i></i></div><div class="blab" style="left:${x0 + 14}px;top:${cy - 9}px">${esc(t.name)} <small>${fmtD(r.ds)}</small></div>`;
    else if (isS) bars += `<div class="bar sum${s ? ' sel' : ''}${r.crit && state.view.crit ? ' crit' : ''}" data-bar="${t.id}" style="left:${x0}px;width:${Math.max(4, x1 - x0)}px;top:${cy - 7}px"><b style="width:${r.p}%"></b></div><div class="blab sum" style="left:${x1 + 8}px;top:${cy - 9}px">${esc(t.name)} <small>${r.p}%</small></div>`;
    else {
      const res = t.res.map(a => state.res.find(q => q.id === a.id)?.name + (a.u !== 100 ? ` ${a.u}%` : '')).filter(Boolean).join(', ');
      const [, c1, c2] = colOf(t);
      bars += `<div class="bar${s ? ' sel' : ''}${r.crit && state.view.crit ? ' crit' : ''}${late ? ' late' : ''}" data-bar="${t.id}" style="left:${x0}px;width:${Math.max(4, x1 - x0)}px;top:${cy - 10}px;--c1:${c1};--c2:${c2}"><b style="width:${t.p}%"></b><i class="h-end" data-h="end" title="Durée"></i><i class="h-p" data-h="p" style="left:${t.p}%" title="Avancement"></i><i class="h-link" data-h="link" title="Tirer vers une autre tâche pour la lier"></i></div>`
        + `<div class="blab" style="left:${x1 + 8}px;top:${cy - 9}px">${esc(t.name)} <small>${res ? esc(res) : fmtDur(r.dur, t.du)}</small></div>`;
    }
  });
  // liens
  let lk = '';
  rows.forEach(t => t.deps.forEach(L => {
    if (!(L.id in ys) || !(t.id in ys)) return;
    const p = byId(L.id), rp = C[L.id], rs = C[t.id], py = ys[L.id] + rh / 2, sy = ys[t.id] + rh / 2;
    const pS = X(rp.ds) - (p.ms ? 0 : 0), pE = p.ms ? X(rp.ds) + 9 : X(rp.de + 1), sS = t.ms ? X(rs.ds) - 9 : X(rs.ds), sE = t.ms ? X(rs.ds) + 9 : X(rs.de + 1);
    const g = 9, dir = sy > py ? 1 : -1, mid = sy - dir * rh / 2; let d;
    if (L.t === 'SS'){ const m = Math.min(pS, sS) - g; d = `M${pS} ${py}H${m}V${sy}H${sS - 2}`; }
    else if (L.t === 'FF'){ const m = Math.max(pE, sE) + g; d = `M${pE} ${py}H${m}V${sy}H${sE + 2}`; }
    else if (L.t === 'SF'){ d = `M${pS} ${py}H${pS - g}V${mid}H${sE + g}V${sy}H${sE + 2}`; }
    else { d = sS - g >= pE + 2 ? `M${pE} ${py}H${sS - g}V${sy}H${sS - 2}` : `M${pE} ${py}H${pE + g}V${mid}H${sS - g}V${sy}H${sS - 2}`; }
    const on = selLink && selLink.to === t.id && selLink.from === L.id, crit = state.view.crit && rp.crit && rs.crit;
    lk += `<g class="lk${on ? ' on' : ''}${crit ? ' crit' : ''}" data-to="${t.id}" data-from="${L.id}"><path class="hit" d="${d}"/><path class="ln" d="${d}" marker-end="url(#${crit ? 'arC' : on ? 'arS' : 'arL'})"/></g>`;
  }));
  const links = `<svg class="glinks" width="${W}" height="${H}"><defs>${['arL', 'arS', 'arC'].map(k => `<marker id="${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9z"/></marker>`).join('')}</defs>${lk}</svg>`;
  const empty = !rows.length ? `<div class="gempty"><b>Planning vide</b><span>Ajoutez une première tâche avec le bouton « Tâche », importez un fichier GanttProject ou MS Project, ou partez d'un modèle (menu Fichier).</span><button class="ib primary" data-cmd="add">Ajouter une tâche</button> <button class="ib" data-fact="tpl">Choisir un modèle</button></div>` : '';
  gw.innerHTML = `<div class="gin" style="grid-template-columns:${tw}px ${W}px;grid-template-rows:${HH}px ${H}px">${th}<div class="gch">${headerHTML()}</div><div class="gtb" style="height:${H}px">${tb}</div><div class="gcb" style="height:${H}px">${bgSVG(H)}${links}${bars}</div></div>${empty}`;
  gw.style.setProperty('--rh', rh + 'px');
  if (keep){ gw.scrollLeft = keep[0]; gw.scrollTop = keep[1]; } else requestAnimationFrame(() => scrollToDay(Math.max(PROJ.start, Math.min(todayDay(), PROJ.end)) - 5, true));
  if (CYCLE) toast('Attention : des liens forment une boucle. Supprimez l\'un d\'eux pour retrouver un planning cohérent.', 5000);
}
function scrollToDay(d, instant){ const gw = $('#ganttView .gw') || $('#resView .gw'); if (!gw) return; const {tw} = cols(); gw.scrollTo({left:Math.max(0, X(d) - 40), behavior:instant ? 'auto' : 'smooth'}); }
function fitAll(){
  const gw = $('#ganttView .gw'); if (!gw) return; const {tw} = cols(), avail = gw.clientWidth - tw - 40, span = PROJ.end - PROJ.start + 1;
  const z = Object.entries(ZOOMS).find(([, v]) => span * v.px <= avail)?.[0] || 'quarter';
  state.view.zoom = z; $('#zoomSel').value = z; refresh(); requestAnimationFrame(() => scrollToDay(PROJ.start - 3));
}
/* ---------- interactions ---------- */
let drag = null, lastTap = {};
function bindGantt(gw){
  gw.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const car = e.target.closest('[data-car]'); if (car){ e.preventDefault(); const t = byId(car.dataset.car); if (t){ t.c = !t.c; refresh(); save(); } return; }
    const sp = e.target.closest('.gsplit'); if (sp){ e.preventDefault(); const x0 = e.clientX, w0 = cols().tw; drag = {k:'split', x0, w0}; gw.setPointerCapture(e.pointerId); return; }
    const lkEl = e.target.closest('.lk'); if (lkEl){ selLink = {to:lkEl.dataset.to, from:lkEl.dataset.from}; sel = new Set([lkEl.dataset.to]); refresh(); renderPanel(); return; }
    const bar = e.target.closest('[data-bar]'), row = e.target.closest('.grow');
    if (bar){
      const id = bar.dataset.bar, t = byId(id), h = e.target.dataset.h || 'move';
      if (!sel.has(id) || e.ctrlKey || e.metaKey) pick(id, e);
      if (state.view.ro) return;
      drag = {k:h, id, t, el:bar, x0:e.clientX, y0:e.clientY, l0:parseFloat(bar.style.left), w0:bar.offsetWidth, moved:false, sum:C[id].sum};
      gw.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (row){ pick(row.dataset.id, e); return; }
    if (e.target.closest('.gcb') && !e.shiftKey){ sel.clear(); selLink = null; refresh(); renderPanel(); }
  });
  gw.addEventListener('pointermove', e => {
    if (!drag){ hoverTip(e); return; }
    const dx = e.clientX - drag.x0; if (Math.abs(dx) > 3 || Math.abs(e.clientY - (drag.y0 || 0)) > 3) drag.moved = true;
    if (drag.k === 'split'){ state.view.tw = clamp(drag.w0 + dx, 260, Math.min(900, innerWidth - 200)); renderGantt(); return; }
    if (!drag.moved) return; tip(null);
    const snap = v => Math.round(v / TL.px) * TL.px;
    if (drag.k === 'move'){ drag.el.style.left = (drag.l0 + snap(dx)) + 'px'; drag.dd = Math.round(dx / TL.px); liveTip(drag); }
    else if (drag.k === 'end'){ const w = Math.max(TL.px, snap(drag.w0 + dx)); drag.el.style.width = w + 'px'; drag.de = D(drag.l0 + w - 1); liveTip(drag); }
    else if (drag.k === 'p'){ const p = clamp(Math.round((e.clientX - drag.el.getBoundingClientRect().left) / drag.w0 * 20) * 5, 0, 100); drag.p = p; drag.el.querySelector('b').style.width = p + '%'; drag.el.querySelector('.h-p').style.left = p + '%'; tip(`${p} % réalisé`, e); }
    else if (drag.k === 'link'){ linkPreview(gw, drag, e); }
  });
  const end = e => {
    if (!drag) return; const d = drag; drag = null; tip(null); gw.querySelector('.lprev')?.remove();
    if (d.k === 'split'){ save(); return; }
    if (!d.moved){ const now = performance.now(); if (e.type === 'pointerup' && lastTap.id === d.id && now - lastTap.t < 420) { lastTap = {}; openTaskEdit(d.id); } else lastTap = {id:d.id, t:now}; return; }
    if (d.k === 'move' && d.dd){ edit(() => { const r = C[d.id], ids = d.sum ? subtree(d.t).filter(x => !C[x.id].sum).map(x => x.id) : [d.id]; ids.forEach(id => { const x = byId(id); x.s = dayToIso(C[id].ds + d.dd); }); }); toastMove(d); }
    else if (d.k === 'end' && d.de != null){ edit(() => { const r = C[d.id]; if (d.sum) return; d.t.d = Math.max(1, CAL.count(r.ds, d.de)); d.t.ms = false; }); }
    else if (d.k === 'p' && d.p != null){ edit(() => { if (!d.sum) d.t.p = d.p; }); }
    else if (d.k === 'link'){ const tgt = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-bar],.grow'); const to = tgt?.dataset.bar || tgt?.dataset.id; if (to && to !== d.id) addLink(d.id, to); else refresh(); }
  };
  gw.addEventListener('pointerup', end); gw.addEventListener('pointercancel', end);
  gw.addEventListener('dblclick', e => { const cell = e.target.closest('.grow > [class^="c-"]'); if (!cell) return; const f = cell.className.slice(2); if (['name', 'dur', 'start', 'end', 'p'].includes(f)) inlineEdit(cell.parentElement.dataset.id, f, cell); });
  gw.addEventListener('contextmenu', e => { const id = e.target.closest('[data-bar],.grow')?.dataset; const tid = id?.bar || id?.id; if (!tid) return; e.preventDefault(); if (!sel.has(tid)) pick(tid, {}); ctxMenu(e.clientX, e.clientY); });
  gw.addEventListener('pointerleave', () => tip(null));
  // appui long (tactile) = menu contextuel
  let lp = 0; gw.addEventListener('touchstart', e => { const el = e.target.closest('[data-bar],.grow'); if (!el) return; const t0 = e.touches[0]; lp = setTimeout(() => { if (drag && drag.moved) return; drag = null; const id = el.dataset.bar || el.dataset.id; if (!sel.has(id)) pick(id, {}); ctxMenu(t0.clientX, t0.clientY); }, 550); }, {passive:true});
  ['touchend', 'touchmove', 'touchcancel'].forEach(k => gw.addEventListener(k, () => clearTimeout(lp), {passive:true}));
}
function pick(id, e){
  if (e.shiftKey && focusId){ const rows = visibleRows().map(t => t.id), a = rows.indexOf(focusId), b = rows.indexOf(id); if (a >= 0 && b >= 0){ sel = new Set(rows.slice(Math.min(a, b), Math.max(a, b) + 1)); } }
  else if (e.ctrlKey || e.metaKey){ sel.has(id) ? sel.delete(id) : sel.add(id); focusId = id; }
  else { sel = new Set([id]); focusId = id; }
  const k = [...sel].join() + '|' + (selLink ? 1 : 0); selLink = null;
  if (k === pick.k) return; pick.k = [...sel].join() + '|0'; refresh(); renderPanel();
}
function toastMove(d){ const r = C[d.id]; if (r) toast(`${d.t.name} : ${fmtDL(r.ds)}${r.ds !== C[d.id]?.ds ? '' : ''}`); }
function liveTip(d){ const r = C[d.id]; if (d.k === 'move'){ const a = r.ds + d.dd, b = r.de + d.dd; tip(`${fmtD(a)} → ${fmtD(b)}`, null, d.el); } else if (d.k === 'end') tip(`Fin ${fmtD(d.de)} · ${Math.max(1, CAL.count(r.ds, d.de))} j ouvrés`, null, d.el); }
function linkPreview(gw, d, e){
  let p = gw.querySelector('.lprev'); const box = gw.querySelector('.gcb').getBoundingClientRect();
  if (!p){ gw.querySelector('.glinks').insertAdjacentHTML('beforeend', '<path class="lprev" marker-end="url(#arS)"/>'); p = gw.querySelector('.lprev'); }
  const br = d.el.getBoundingClientRect(), x1 = br.right - box.left, y1 = br.top + br.height / 2 - box.top, x2 = e.clientX - box.left, y2 = e.clientY - box.top;
  p.setAttribute('d', `M${x1} ${y1}C${x1 + 40} ${y1} ${x2 - 40} ${y2} ${x2} ${y2}`);
  const tgt = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-bar],.grow'), to = tgt?.dataset.bar || tgt?.dataset.id;
  tip(to && to !== d.id ? `Lier : ${d.t.name} → ${byId(to)?.name}` : 'Relâchez sur la tâche qui doit suivre', e);
}
function addLink(from, to, type = 'FS'){
  const t = byId(to); if (!t || t.deps.some(x => x.id === from)) { refresh(); return; }
  if (subtree(byId(from)).some(x => x.id === to) || subtree(t).some(x => x.id === from)){ toast('Une tâche ne peut pas être liée à sa propre tâche récapitulative.'); refresh(); return; }
  edit(() => { t.deps.push({id:from, t:type, lag:0}); schedule(); if (CYCLE){ t.deps.pop(); throw new Error('ce lien créerait une boucle'); } });
}
/* infobulle */
function tip(html, e, el){
  const g = $('#gtip'); if (!html){ g.hidden = true; return; }
  g.innerHTML = html; g.hidden = false;
  let x, y; if (el){ const r = el.getBoundingClientRect(); x = r.left; y = r.top - g.offsetHeight - 8; } else { x = e.clientX + 14; y = e.clientY + 16; }
  g.style.left = clamp(x, 6, innerWidth - g.offsetWidth - 6) + 'px'; g.style.top = clamp(y, 6, innerHeight - g.offsetHeight - 6) + 'px';
}
let tipT = 0;
function hoverTip(e){
  if (MQ_COARSE.matches) return;
  const b = e.target.closest('[data-bar]'); clearTimeout(tipT);
  if (!b){ tip(null); return; }
  tipT = setTimeout(() => { const t = byId(b.dataset.bar), r = C[t.id]; if (!t) return;
    const res = t.res.map(a => (state.res.find(q => q.id === a.id)?.name || '') + (a.u !== 100 ? ` (${a.u} %)` : '')).join(', ');
    tip(`<b>${esc(t.name)}</b><span>${t.ms ? 'Jalon · ' + fmtDL(r.ds) : `${fmtD(r.ds)} → ${fmtD(r.de)} · ${fmtDur(r.dur, t.du)}${r.dur > 1 ? ' (' + r.dur + ' j ouvrés)' : ''}`}</span><span>Avancement ${r.p} %${r.sum ? '' : ` · marge ${Math.max(0, r.slack)} j`}${r.crit ? ' · <em>critique</em>' : ''}</span>${res ? `<span>${esc(res)}</span>` : ''}${r.cost ? `<span>Coût ${eur(r.cost)}</span>` : ''}${state.view.base && r.late ? `<span class="tl">Retard sur la référence : ${r.late} j</span>` : ''}`, e); }, 280);
}
/* édition directe dans le tableau (double-clic, F2) */
function inlineEdit(id, field, cell){
  const t = byId(id), r = C[id]; if (!t || !cell || state.view.ro) return;
  if (r.sum && field !== 'name') { toast('Dates, durée et avancement d\'une tâche récapitulative se calculent à partir de ses sous-tâches.'); return; }
  const v = {name:t.name, dur:t.ms ? 0 : fmtDur(t.d, t.du), start:dayToIso(r.ds), end:dayToIso(r.de), p:t.p}[field];
  const type = field === 'start' || field === 'end' ? 'date' : field === 'name' || field === 'dur' ? 'text' : 'number';
  const box = cell.getBoundingClientRect(), inp = document.createElement('input');
  inp.type = type; inp.value = v; inp.className = 'gedit'; Object.assign(inp.style, {left:box.left + 'px', top:box.top + 'px', width:Math.max(box.width, type === 'date' ? 130 : 60) + 'px', height:box.height + 'px'});
  document.body.appendChild(inp); inp.focus(); inp.select?.();
  let done = false; const commit = ok => { if (done) return; done = true; const val = inp.value; inp.remove(); if (!ok || String(val) === String(v)) return;
    edit(() => { if (field === 'name') t.name = val.trim() || t.name; else if (field === 'dur'){ const n = parseDur(val, durSplit(t.d, t.du).u); if (!Number.isFinite(n)) { toast('Durée illisible : essayez « 5 j », « 3 sem », « 2 mois » ou « 1 an »'); return; } t.d = Math.max(0, n); t.ms = n === 0; t.du = durUnitOf(val) || t.du;}
      else if (field === 'start'){ const d = isoToDay(val); if (Number.isFinite(d)) t.s = dayToIso(d); }
      else if (field === 'end'){ const d = isoToDay(val); if (Number.isFinite(d)){ t.d = Math.max(1, CAL.count(r.ds, d)); t.ms = false; } }
      else if (field === 'p') t.p = clamp(Math.round(num(val)) || 0, 0, 100); }); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') commit(true); if (e.key === 'Escape') commit(false); });
  inp.addEventListener('blur', () => commit(true));
}
