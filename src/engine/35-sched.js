/* ============ Ordonnancement : dates au plus tôt, tâches récapitulatives, marges, chemin critique ============
   Calcul en jours ouvrés (index CAL) : es = premier jour, ef = dernier jour (ef = es - 1 pour un jalon, durée nulle).
   Chaque tâche démarre à sa date souhaitée (s), repoussée si un lien l'impose (comme GanttProject : les liens poussent, ils ne tirent jamais en arrière).
   Les liens posés sur une tâche récapitulative s'appliquent à toutes ses sous-tâches. */
let C = {}, PROJ = {es:0, ef:0, start:0, end:0, cost:0, work:0, p:0, late:0}, CYCLE = false;
function schedule(){
  const st = state, start = isoToDay(st.start);
  CAL.build(st.cal, start);
  const els = st.els, sum = new Set(els.filter(t => els.some(x => x.par === t.id)).map(t => t.id));
  const leaves = els.filter(t => !sum.has(t.id)), R = {};
  els.forEach(t => R[t.id] = {es:0, ef:-1, sum:sum.has(t.id), slack:0, crit:false, lvl:0});
  const pw = CAL.toW(start);
  // contraintes héritées : liens de la tâche et de ses ancêtres
  const inh = {}; leaves.forEach(t => { const all = [...t.deps]; ancestors(t).forEach(a => all.push(...a.deps)); inh[t.id] = all; });
  const dur = t => t.ms ? 0 : Math.max(1, t.d);
  leaves.forEach(t => { const r = R[t.id]; r.es = Math.max(pw, CAL.toW(isoToDay(t.s) || start)); r.ef = r.es + dur(t) - 1; });
  const sumUpd = () => { for (let i = els.length - 1; i >= 0; i--){ const t = els[i]; if (!sum.has(t.id)) continue; let a = Infinity, b = -Infinity; els.forEach(k => { if (k.par === t.id){ const r = R[k.id]; a = Math.min(a, r.es); b = Math.max(b, r.ef, r.es - 1); } }); R[t.id].es = a; R[t.id].ef = b; } };
  sumUpd(); CYCLE = false;
  // relaxation jusqu'à stabilité (les cycles de liens sont détectés et signalés)
  let it = 0, changed = true; const N = els.length + 5;
  while (changed && it < N * 2 + 10){
    changed = false; it++;
    for (const t of leaves){
      const r = R[t.id], d = dur(t); let es = r.es;
      for (const L of inh[t.id]){
        const p = R[L.id]; if (!p) continue; const lag = L.lag || 0;
        let need;
        if (L.t === 'SS') need = p.es + lag;
        else if (L.t === 'FF') need = p.ef + lag - d + 1;
        else if (L.t === 'SF') need = p.es + lag - d;   // la tâche finit (au plus tôt) la veille du début de la précédente
        else need = p.ef + 1 + lag;
        if (need > es) es = need;
      }
      if (es !== r.es){ r.es = es; r.ef = es + d - 1; changed = true; }
    }
    if (changed) sumUpd();
  }
  if (changed) CYCLE = true;
  // passe arrière : dates au plus tard, marge totale (calculées sur les tâches élémentaires)
  let pe = -Infinity, ps = Infinity; leaves.forEach(t => { pe = Math.max(pe, R[t.id].ef, R[t.id].es - 1); ps = Math.min(ps, R[t.id].es); });
  if (!leaves.length){ pe = pw; ps = pw; }
  const succ = {}; leaves.forEach(t => inh[t.id].forEach(L => { const targets = sum.has(L.id) ? leavesOf(L.id, sum) : [L.id]; targets.forEach(pid => (succ[pid] ||= []).push({t, L})); }));
  const ls = {}, lf = {}; leaves.forEach(t => { lf[t.id] = pe; ls[t.id] = pe - dur(t) + 1; });
  for (let k = 0; k < leaves.length + 5; k++){
    let ch = false;
    for (const t of leaves){
      const d = dur(t); let f = pe;
      (succ[t.id] || []).forEach(({t:s, L}) => { const lag = L.lag || 0;
        if (L.t === 'SS') f = Math.min(f, ls[s.id] - lag + d - 1);
        else if (L.t === 'FF') f = Math.min(f, lf[s.id] - lag);
        else if (L.t === 'SF') f = Math.min(f, lf[s.id] - lag + d);
        else f = Math.min(f, ls[s.id] - 1 - lag); });
      if (f !== lf[t.id]){ lf[t.id] = f; ls[t.id] = f - d + 1; ch = true; }
    }
    if (!ch) break;
  }
  leaves.forEach(t => { const r = R[t.id]; r.slack = lf[t.id] - r.ef; r.crit = r.slack <= 0; r.lf = lf[t.id]; });
  els.forEach(t => { if (sum.has(t.id)){ const ks = leavesOf(t.id, sum); R[t.id].crit = ks.some(k => R[k].crit); R[t.id].slack = Math.min(...ks.map(k => R[k].slack)); } R[t.id].lvl = level(t); });
  // avancement pondéré, coûts
  const rate = Object.fromEntries(st.res.map(r => [r.id, r]));
  let cost = 0, work = 0, done = 0;
  leaves.forEach(t => { const d = dur(t), c = t.res.reduce((a, x) => a + (rate[x.id]?.rate || 0) * x.u / 100 * d, 0); R[t.id].cost = c; cost += c; work += d; done += d * t.p / 100; R[t.id].p = t.p; });
  for (let i = els.length - 1; i >= 0; i--){ const t = els[i]; if (!sum.has(t.id)) continue; const ks = leavesOf(t.id, sum); let w = 0, dn = 0, c = 0; ks.forEach(k => { const x = byId(k), d = dur(x); w += d; dn += d * x.p / 100; c += R[k].cost; }); R[t.id].p = w ? Math.round(dn / w * 100) : 0; R[t.id].cost = c; }
  // dates réelles (jours calendaires)
  els.forEach(t => { const r = R[t.id]; r.ds = CAL.toD(r.es); r.de = r.ef < r.es ? r.ds : CAL.toD(r.ef); r.dur = Math.max(0, r.ef - r.es + 1); });
  // retard sur la référence
  let late = 0; if (st.base?.t) els.forEach(t => { const b = st.base.t[t.id]; if (b && !R[t.id].sum){ const dl = CAL.count(isoToDay(b[1]) + 1, R[t.id].de); R[t.id].late = R[t.id].de > isoToDay(b[1]) ? dl : 0; late = Math.max(late, R[t.id].late); } });
  C = R; PROJ = {es:ps, ef:pe, start:CAL.toD(ps), end:pe < ps ? CAL.toD(ps) : CAL.toD(pe), cost, work, p:work ? Math.round(done / work * 100) : 0, late};
}
function leavesOf(id, sum){ const out = [], st = [id]; while (st.length){ const x = st.pop(); state.els.forEach(k => { if (k.par === x){ if (sum.has(k.id)) st.push(k.id); else out.push(k.id); } }); } return out; }
/* tâches en retard sur l'avancement attendu à aujourd'hui */
function behind(t){ const r = C[t.id]; if (!r || r.sum) return false; const td = todayDay(); if (td < r.ds) return false; const exp = td > r.de ? 100 : Math.round(CAL.count(r.ds, td) / Math.max(1, r.dur) * 100); return t.p + 5 < exp; }
/* charge des ressources jour par jour (en % de leur capacité) */
function resLoad(){
  const L = {}; state.res.forEach(r => L[r.id] = new Map());
  state.els.forEach(t => { const r = C[t.id]; if (!r || r.sum || t.ms) return; t.res.forEach(a => { const m = L[a.id]; if (!m) return; for (let w = r.es; w <= r.ef; w++){ const d = CAL.toD(w); m.set(d, (m.get(d) || 0) + a.u); } }); });
  return L;
}
