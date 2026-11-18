/* ============ Vue Ressources : charge jour par jour, surcharges, tâches affectées ============ */
function renderRes(){
  const host = $('#resView'); let gw = host.querySelector('.gw');
  const keep = gw ? [gw.scrollLeft, gw.scrollTop] : null;
  if (!gw){ host.innerHTML = '<div class="gw rv" tabindex="-1"></div>'; gw = host.querySelector('.gw'); gw.addEventListener('click', e => { const r = e.target.closest('[data-rid]'); if (r){ selRes = r.dataset.rid; setTab('res'); renderPanel(); refresh(); } const t = e.target.closest('[data-task]'); if (t){ setMode('gantt'); pick(t.dataset.task, {}); requestAnimationFrame(() => scrollToDay(C[t.dataset.task].ds - 3)); } }); }
  tlRange();
  const L = resLoad(), rh = 46, W = X(TL.d1 + 1), {tw} = cols(), z = state.view.zoom;
  const rows = state.res;
  const H = Math.max(rows.length * rh + 40, gw.clientHeight - HH);
  let tb = '', ch = '';
  rows.forEach((r, i) => {
    const m = L[r.id], y = i * rh; let peak = 0, over = 0, days = 0; m.forEach(v => { peak = Math.max(peak, v); if (v > r.cap) over++; days++; });
    const tasks = state.els.filter(t => t.res.some(a => a.id === r.id) && !C[t.id].sum);
    tb += `<div class="grow rrow${selRes === r.id ? ' sel' : ''}" data-rid="${r.id}" style="top:${y}px;height:${rh}px;grid-template-columns:1fr auto"><div class="c-name"><i class="dot" style="--c:${COLOR[r.col][1]}"></i><span class="nm"><b>${esc(r.name)}</b><small>${esc(r.role || '—')} · ${tasks.length} tâche${tasks.length > 1 ? 's' : ''}</small></span></div><div class="c-load ${peak > r.cap ? 'over' : ''}" title="Charge maximale">${peak ? Math.round(peak / r.cap * 100) + ' %' : '—'}</div></div>`;
    // charge : colonnes jour par jour (agrégées par semaine ou mois aux petites échelles)
    const step = z === 'day' ? 1 : z === 'week' ? 1 : 7;
    for (let d = TL.d0; d <= TL.d1; d += step){
      let v = 0, n = 0; for (let k = 0; k < step; k++){ const x = m.get(d + k); if (x){ v = Math.max(v, x); n++; } }
      if (!v) continue; const pc = v / r.cap, hgt = Math.min(1.4, pc) * (rh - 18);
      ch += `<i class="ld${pc > 1 ? ' over' : pc < .5 ? ' low' : ''}" style="left:${X(d)}px;width:${Math.max(1, step * TL.px - (TL.px > 4 ? 1 : 0))}px;top:${y + rh - 6 - hgt}px;height:${hgt}px" title="${fmtD(d)} : ${Math.round(pc * 100)} %"></i>`;
    }
    ch += `<i class="cap" style="top:${y + rh - 6 - (rh - 18)}px;width:${W}px"></i>`;
    tasks.forEach(t => { const c = C[t.id]; ch += `<div class="rtask" data-task="${t.id}" style="left:${X(c.ds)}px;width:${Math.max(3, X(c.de + 1) - X(c.ds))}px;top:${y + 3}px;--c:${COLOR[r.col][1]}" title="${esc(t.name)} · ${t.res.find(a => a.id === r.id).u} %">${X(c.de + 1) - X(c.ds) > 70 ? esc(t.name) : ''}</div>`; });
  });
  const empty = !rows.length ? `<div class="gempty"><b>Aucune ressource</b><span>Ajoutez les personnes, équipes, engins ou sous-traitants dans l'onglet « Ressources » du panneau, puis affectez-les aux tâches.</span><button class="ib primary" data-fact="addres">Ajouter une ressource</button></div>` : '';
  gw.innerHTML = `<div class="gin" style="grid-template-columns:${tw}px ${W}px;grid-template-rows:${HH}px ${H}px"><div class="gth" style="grid-template-columns:1fr auto"><div class="c-name">Ressource</div><div class="c-load">Pic</div></div><div class="gch">${headerHTML()}</div><div class="gtb" style="height:${H}px">${tb}</div><div class="gcb" style="height:${H}px">${bgSVG(H)}${ch}</div></div>${empty}`;
  if (keep){ gw.scrollLeft = keep[0]; gw.scrollTop = keep[1]; } else requestAnimationFrame(() => { gw.scrollLeft = Math.max(0, X(PROJ.start) - 40); });
}
let selRes = '';
