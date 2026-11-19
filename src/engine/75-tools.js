/* ============ ARCHIPHASE · outils : nivellement des ressources, rattrapage des retards, palette de commandes, courbe en S ============ */

/* ---------- Nivellement automatique des ressources ----------
   Repère le premier jour où une ressource dépasse sa capacité, décale (vers l'avenir) la tâche non commencée qui a le plus de marge
   juste après la fin d'une tâche concurrente, puis recommence jusqu'à ne plus avoir de surcharge. Une seule action annulable (Ctrl+Z). */
function levelResources(){
  if (state.view.ro) return toast('Ce projet vous est partagé en lecture seule.');
  if (!state.res.length) return toast('Aucune ressource : ajoutez-en dans l\'onglet « Ressources » du panneau.');
  const was = new Map(state.els.map(t => [t.id, t.s])), stuck = new Set(); let endBefore = 0, partial = false;
  edit(() => {
    schedule(); endBefore = PROJ.ef;
    const cap = Object.fromEntries(state.res.map(r => [r.id, r.cap])), skip = new Set();
    const t0 = Date.now();
    for (let guard = 0; guard < 4000; guard++){
      if (Date.now() - t0 > 8000){ partial = true; break; }
      const day = new Map();
      state.els.forEach(t => { const r = C[t.id]; if (!r || r.sum || t.ms) return;
        t.res.forEach(a => { if (!cap[a.id]) return; for (let w = r.es; w <= r.ef; w++){ const k = a.id + ':' + w; let e = day.get(k); if (!e) day.set(k, e = {rid:a.id, w, u:0, ts:[]}); e.u += a.u; e.ts.push(t); } }); });
      // premier jour en surcharge de chaque ressource ; une tâche décalée par ressource et par passe, puis un seul recalcul
      const first = new Map();
      for (const e of day.values()) if (e.u > cap[e.rid] && !skip.has(e.rid + ':' + e.w) && (!first.has(e.rid) || e.w < first.get(e.rid).w)) first.set(e.rid, e);
      if (!first.size) break;
      const done = new Set(); let any = false;
      for (const hit of first.values()){
        const cand = hit.ts.filter(t => t.p === 0 && !done.has(t.id));
        if (hit.ts.length < 2 || !cand.length){ skip.add(hit.rid + ':' + hit.w); stuck.add(hit.rid); continue; }
        cand.sort((a, b) => (C[b.id].slack - C[a.id].slack) || (C[b.id].es - C[a.id].es));
        const t = cand[0], others = hit.ts.filter(x => x !== t);
        const nw = Math.max(C[t.id].es + 1, Math.min(...others.map(x => C[x.id].ef)) + 1);
        t.s = dayToIso(CAL.toD(nw)); done.add(t.id); any = true;
      }
      if (any) schedule();
    }
  });
  const moved = state.els.filter(t => was.get(t.id) !== t.s).length, gap = PROJ.ef - endBefore;
  if (!moved && !stuck.size) return toast('Aucune surcharge : les ressources sont déjà dans leur capacité.');
  toast(`Nivellement : ${moved} tâche${moved > 1 ? 's' : ''} décalée${moved > 1 ? 's' : ''}, ${gap > 0 ? 'fin du projet repoussée de ' + fmtDur(gap) : 'fin du projet inchangée'}`
    + (partial ? ' · limité à 8 s : relancez pour continuer' : '') + (stuck.size ? ` · surcharge restante sur ${[...stuck].map(id => state.res.find(r => r.id === id)?.name).filter(Boolean).join(', ')} (tâche seule au-dessus de sa capacité, ou déjà commencée)` : ''), 6000);
}

/* ---------- Rattraper les retards : tout ce qui devait être fait repart d'aujourd'hui ---------- */
function catchUp(){
  if (state.view.ro) return toast('Ce projet vous est partagé en lecture seule.');
  const td = todayDay(), tw = CAL.toW(td); let n = 0;
  edit(() => {
    schedule();
    state.els.forEach(t => { const r = C[t.id]; if (!r || r.sum || t.ms || t.p >= 100) return;
      if (t.p === 0 && r.ds < td){ t.s = dayToIso(CAL.toD(tw)); n++; }
      else if (t.p > 0 && r.de < td){ const rest = Math.max(1, Math.ceil(t.d * (1 - t.p / 100))), nd = tw + rest - r.es; if (nd > t.d){ t.d = nd; n++; } } });
  });
  toast(n ? `${n} tâche${n > 1 ? 's' : ''} replanifiée${n > 1 ? 's' : ''} à partir d'aujourd'hui (annulable avec Ctrl+Z)` : 'Rien à rattraper : aucune tâche en retard.');
}

/* ---------- Courbe en S : avancement prévu (d'après le planning) et réel ---------- */
function sCurveSvg(){
  const leaves = state.els.filter(t => C[t.id] && !C[t.id].sum && !t.ms), W = leaves.reduce((s, t) => s + C[t.id].dur, 0), n = PROJ.ef - PROJ.es + 1;
  if (!W || n < 2) return '';
  const acc = new Float64Array(n + 1); leaves.forEach(t => { const r = C[t.id]; for (let w = r.es; w <= r.ef; w++) acc[w - PROJ.es + 1]++; });
  const cum = [0]; let c = 0; for (let i = 1; i <= n; i++){ c += acc[i]; cum.push(c / W * 100); }
  const VW = 300, VH = 118, px = i => 10 + i / n * (VW - 20), py = v => VH - 16 - v / 100 * (VH - 30), step = Math.max(1, Math.ceil(n / 140)), pts = [];
  for (let i = 0; i <= n; i += step) pts.push(i); if (pts[pts.length - 1] !== n) pts.push(n);
  const path = pts.map((i, k) => (k ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(cum[i]).toFixed(1)).join('');
  const ti = CAL.toW(todayDay()) - PROJ.es, inside = ti >= 0 && ti <= n, plan = inside ? Math.round(cum[ti]) : null, real = PROJ.p;
  const grid = [0, 50, 100].map(v => `<line x1="10" x2="${VW - 10}" y1="${py(v)}" y2="${py(v)}" stroke="var(--line)" stroke-width="1"/><text x="${VW - 10}" y="${py(v) - 3}" text-anchor="end" font-size="8" fill="var(--mut)">${v} %</text>`).join('');
  const mark = inside ? `<line x1="${px(ti)}" x2="${px(ti)}" y1="12" y2="${VH - 16}" stroke="var(--mut)" stroke-dasharray="3 3"/><circle cx="${px(ti)}" cy="${py(plan)}" r="3.5" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/><circle cx="${px(ti)}" cy="${py(real)}" r="4" fill="${real + 3 < plan ? '#E0524F' : '#22B488'}"/>` : '';
  const gap = inside ? real - plan : 0;
  return `<h4 class="psec">Courbe en S</h4><svg class="scurve" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Avancement prévu et réel">${grid}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>${mark}
    <text x="10" y="${VH - 3}" font-size="8" fill="var(--mut)">${fmtD(PROJ.start)}</text><text x="${VW - 10}" y="${VH - 3}" text-anchor="end" font-size="8" fill="var(--mut)">${fmtD(PROJ.end)}</text></svg>
    <p class="pnote">${inside ? `Aujourd'hui : prévu <b>${plan} %</b> · réel <b>${real} %</b>${gap < -3 ? ` · <b class="neg">en retard de ${-gap} points</b>` : gap > 3 ? ` · en avance de ${gap} points` : ' · dans les temps'}` : 'Courbe cumulée du travail prévu sur la durée du projet.'}</p>`;
}

/* ---------- Palette de commandes (Ctrl+K) : chercher une tâche, lancer une action, créer une tâche en tapant « Nom 3 sem » ---------- */
const normTxt = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function closePalette(){ document.getElementById('apPal')?.remove(); }
function palActions(){
  const clickTog = k => $(`.gbar [data-tog="${k}"]`)?.click(), zoom = z => { const s = $('#zoomSel'); if (s){ s.value = z; s.dispatchEvent(new Event('change', {bubbles:true})); } };
  return [
    ['Nouvelle tâche', 'ajouter creer', () => cmd('add')], ['Nouveau jalon', 'ajouter creer', () => cmd('addMs')], ['Nouvelle sous-tâche', 'ajouter creer', () => cmd('addSub')],
    ['Niveler les ressources', 'surcharge capacite equilibrer', levelResources], ['Rattraper les retards (repartir d\'aujourd\'hui)', 'replanifier retard aujourd hui', catchUp],
    ['Aller à aujourd\'hui', 'date', () => cmd('today')], ['Tout afficher', 'ajuster zoom', () => cmd('fit')],
    ['Vue Gantt', 'diagramme planning 1', () => setMode('gantt')], ['Vue Ressources', 'charge equipes 2', () => setMode('res')], ['Vue PERT', 'reseau 3', () => setMode('pert')],
    ['Échelle : jours', 'zoom', () => zoom('day')], ['Échelle : semaines', 'zoom', () => zoom('week')], ['Échelle : mois', 'zoom', () => zoom('month')],
    ['Afficher / masquer le chemin critique', 'critique', () => clickTog('crit')], ['Afficher / masquer la référence', 'baseline ecart', () => clickTog('base')],
    ['Enregistrer la référence', 'baseline figer', setBaseline], ['Annuler', 'undo', undo], ['Rétablir', 'redo', redo],
    ['Thème clair / sombre', 'dark mode nuit', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')],
    ['Exporter : image PNG', 'export', () => doExport('png')], ['Exporter : imprimer / PDF', 'export', () => doExport('pdf')], ['Exporter : tableau CSV', 'export excel', () => doExport('csv')],
    ['Exporter : MS Project (.xml)', 'export', () => doExport('msp')], ['Exporter : GanttProject (.gan)', 'export', () => doExport('gan')], ['Exporter : agenda (.ics)', 'export jalons', () => doExport('ics')],
    ['Raccourcis et aide', 'clavier', helpDialog],
  ].map(([t, k, run]) => ({t, k: normTxt(t + ' ' + k), run, kind:'cmd'}));
}
function openPalette(){
  if (document.getElementById('apPal')) return closePalette();
  const o = document.createElement('div'); o.id = 'apPal'; o.className = 'pal';
  o.innerHTML = `<div class="pal-card" role="dialog" aria-modal="true" aria-label="Palette de commandes"><input class="pal-in" type="text" autocomplete="off" spellcheck="false" placeholder="Chercher une tâche ou une commande… ou « Pose bordures 2 sem » pour créer" aria-label="Rechercher"><div class="pal-l" role="listbox"></div><div class="pal-f"><span>↑↓ choisir</span><span>↵ valider</span><span>Échap fermer</span></div></div>`;
  document.body.appendChild(o);
  const inp = o.querySelector('input'), list = o.querySelector('.pal-l'), W1 = wbs(), acts = palActions(); let items = [], cur = 0;
  const goTask = t => { ancestors(t).forEach(a => { a.c = false; }); sel = new Set([t.id]); focusId = t.id; if (mode !== 'gantt') setMode('gantt'); else refresh(); renderPanel();
    revealRow(t.id); requestAnimationFrame(() => { scrollToDay(C[t.id].ds - 3); $(`.grow[data-id="${t.id}"]`)?.scrollIntoView({block:'nearest'}); }); };
  const build = q => {
    const n = normTxt(q.trim()), out = [];
    if (n){
      state.els.filter(t => normTxt(t.name).includes(n) || normTxt(W1[t.id]) === n).slice(0, 8).forEach(t => out.push({kind:'task', t:t.name, sub:`${W1[t.id]} · ${t.ms ? 'jalon ' + fmtD(C[t.id].ds) : fmtD(C[t.id].ds) + ' → ' + fmtD(C[t.id].de) + ' · ' + fmtDur(C[t.id].dur, t.du)}`, run:() => goTask(t)}));
      acts.filter(a => n.split(/\s+/).every(w => a.k.includes(w))).slice(0, 8).forEach(a => out.push(a));
      const m = q.trim().match(/^(.*?)\s+(\d+(?:[.,]\d+)?\s*[a-zA-Zéû.]+)$/), dd = m ? parseDur(m[2]) : NaN, nm = (Number.isFinite(dd) && dd > 0 ? m[1] : q.trim()).trim() || q.trim(), d = Number.isFinite(dd) && dd > 0 ? dd : 5;
      out.push({kind:'new', t:`Créer la tâche « ${nm} »`, sub:`Durée ${fmtDur(d, durUnitOf(m?.[2]) || '')}${selected().length ? ', après la tâche sélectionnée' : ''}`, run:() => {
        if (state.view.ro) return toast('Ce projet vous est partagé en lecture seule.');
        let t; edit(() => { const f = selected().slice(-1)[0], d0 = f ? C[f.id].de + 1 : (state.els.length ? PROJ.end + 1 : isoToDay(state.start));
          t = newTask({name:nm.slice(0, 120), d, s:dayToIso(d0), par:f ? f.par : '', du:durUnitOf(m?.[2]) || ''}); if (f) insertAfter(f, t); else state.els.push(t); });
        if (t) goTask(t); }});
    } else acts.slice(0, 12).forEach(a => out.push(a));
    return out;
  };
  const paint = () => { list.innerHTML = items.length ? items.map((x, i) => `<button type="button" class="pal-i${i === cur ? ' on' : ''}" role="option" data-i="${i}" aria-selected="${i === cur}"><i class="pal-k ${x.kind}">${x.kind === 'task' ? 'Tâche' : x.kind === 'new' ? 'Créer' : 'Action'}</i><b>${esc(x.t)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('') : '<div class="pal-e">Aucun résultat</div>'; list.querySelector('.on')?.scrollIntoView({block:'nearest'}); };
  const run = i => { const x = items[i]; if (!x) return; closePalette(); x.run(); };
  inp.addEventListener('input', () => { items = build(inp.value); cur = 0; paint(); });
  inp.addEventListener('keydown', e => { e.stopPropagation();
    if (e.key === 'Escape'){ e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if (items.length){ cur = (cur + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); } }
    else if (e.key === 'Enter'){ e.preventDefault(); run(cur); } });
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
  o.addEventListener('mousedown', e => { if (e.target === o) closePalette(); });
  items = build(''); paint(); inp.focus();
}
function bindTools(){
  document.addEventListener('keydown', e => {
    if (!((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k')) return;
    if ($('#app').hidden || !$('#auth').hidden || !$('#home').hidden || !$('#apDlg').hidden || !$('#engDlg').hidden) return;
    e.preventDefault(); openPalette();
  });
  $$('[data-pal]').forEach(b => b.addEventListener('click', openPalette));
}
