/* ============ Vue PERT : réseau des tâches, dates au plus tôt / au plus tard, chemin critique ============
   Colonnes = rang dans le réseau (plus long chemin depuis le début), lignes = ordre du planning. Les liens posés sur une
   tâche récapitulative sont reportés sur ses sous-tâches. Glisser le fond pour se déplacer, molette + Ctrl pour zoomer. */
let pertZoom = 1;
function renderPert(){
  const host = $('#pertView');
  const sum = new Set(state.els.filter(t => C[t.id].sum).map(t => t.id)), nodes = state.els.filter(t => !sum.has(t.id));
  if (!nodes.length){ host.innerHTML = '<div class="gempty"><b>Réseau PERT</b><span>Ajoutez des tâches et des liens : le réseau, les marges et le chemin critique s\'affichent ici.</span></div>'; return; }
  const pred = {}; nodes.forEach(t => pred[t.id] = []);
  nodes.forEach(t => { const all = [...t.deps]; ancestors(t).forEach(a => all.push(...a.deps)); all.forEach(L => (sum.has(L.id) ? leavesOf(L.id, sum) : [L.id]).forEach(p => { if (pred[p] && p !== t.id && !pred[t.id].includes(p)) pred[t.id].push(p); })); });
  const rank = {}; const rk = (id, seen = new Set()) => { if (rank[id] != null) return rank[id]; if (seen.has(id)) return 0; seen.add(id); const r = pred[id].length ? Math.max(...pred[id].map(p => rk(p, seen) + 1)) : 0; return rank[id] = r; };
  nodes.forEach(t => rk(t.id));
  const colsN = {}, pos = {}; nodes.forEach(t => { const c = rank[t.id]; colsN[c] = (colsN[c] || 0); pos[t.id] = [c, colsN[c]++]; });
  const BW = 204, BH = 86, GX = 70, GY = 26, M = 30;
  const maxC = Math.max(...Object.keys(colsN).map(Number)), maxR = Math.max(...Object.values(colsN));
  const W = M * 2 + (maxC + 1) * BW + maxC * GX, H = M * 2 + maxR * BH + (maxR - 1) * GY;
  const P = id => { const [c, r] = pos[id]; return [M + c * (BW + GX), M + r * (BH + GY)]; };
  let links = '', boxes = '';
  nodes.forEach(t => pred[t.id].forEach(p => { const [x1, y1] = P(p), [x2, y2] = P(t.id), crit = state.view.crit !== false && C[p].crit && C[t.id].crit; const a = [x1 + BW, y1 + BH / 2], b = [x2, y2 + BH / 2], mx = (a[0] + b[0]) / 2;
    links += `<path class="pl${crit ? ' crit' : ''}" d="M${a[0]} ${a[1]}C${mx} ${a[1]} ${mx} ${b[1]} ${b[0] - 3} ${b[1]}" marker-end="url(#${crit ? 'paC' : 'paL'})"/>`; }));
  nodes.forEach(t => { const [x, y] = P(t.id), r = C[t.id], crit = r.crit, c = colOf(t)[1], s = sel.has(t.id);
    const ls = CAL.toD(r.lf - Math.max(0, r.dur) + 1), lf = CAL.toD(Math.max(r.lf, r.es));
    boxes += `<g class="pn${crit ? ' crit' : ''}${s ? ' sel' : ''}" data-id="${t.id}" transform="translate(${x} ${y})"><rect width="${BW}" height="${BH}" rx="10"/><rect class="pc" width="6" height="${BH}" rx="3" style="fill:${c}"/>
      <text x="16" y="21" class="pt">${esc(t.name.length > 28 ? t.name.slice(0, 27) + '…' : t.name)}</text>
      <text x="16" y="41" class="ps">${t.ms ? 'Jalon' : fmtDur(r.dur, t.du)} · ${r.p} %${crit ? ' · critique' : ` · marge ${Math.max(0, r.slack)} j`}</text>
      <line x1="10" x2="${BW - 10}" y1="52" y2="52"/><text x="16" y="68" class="pd">Tôt ${fmtD(r.ds)} → ${fmtD(r.de)}</text><text x="16" y="81" class="pd mut">Tard ${fmtD(ls)} → ${fmtD(lf)}</text>
      ${t.ms ? `<path class="pmk" d="M${BW - 22} 12l8 8-8 8-8-8z" style="fill:${c}"/>` : ''}</g>`; });
  host.innerHTML = `<div class="pw"><div class="pin" style="width:${W * pertZoom}px;height:${H * pertZoom}px"><svg width="${W * pertZoom}" height="${H * pertZoom}" viewBox="0 0 ${W} ${H}"><defs>${['paL', 'paC'].map(k => `<marker id="${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1L9 5L1 9z"/></marker>`).join('')}</defs>${links}${boxes}</svg></div>
    <div class="plegend"><span><i class="crit"></i>Chemin critique</span><span><i></i>Tâche avec marge</span><button class="ib" data-pz="-1" aria-label="Dézoomer">−</button><button class="ib" data-pz="1" aria-label="Zoomer">+</button></div></div>`;
  const pw = host.querySelector('.pw');
  pw.onclick = e => { const z = e.target.closest('[data-pz]'); if (z){ pertZoom = clamp(pertZoom * (z.dataset.pz > 0 ? 1.2 : 1 / 1.2), .3, 2.5); renderPert(); return; } const n = e.target.closest('.pn'); if (n) pick(n.dataset.id, e); };
  pw.ondblclick = e => { const n = e.target.closest('.pn'); if (n) openTaskEdit(n.dataset.id); };
  pw.onwheel = e => { if (!e.ctrlKey) return; e.preventDefault(); pertZoom = clamp(pertZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), .3, 2.5); renderPert(); };
  let pan = null; pw.onpointerdown = e => { if (e.target.closest('.pn,.plegend')) return; pan = [e.clientX, e.clientY, pw.scrollLeft, pw.scrollTop]; pw.setPointerCapture(e.pointerId); };
  pw.onpointermove = e => { if (!pan) return; pw.scrollLeft = pan[2] - (e.clientX - pan[0]); pw.scrollTop = pan[3] - (e.clientY - pan[1]); };
  pw.onpointerup = () => pan = null;
}
