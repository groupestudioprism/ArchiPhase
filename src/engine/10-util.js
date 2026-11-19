/* ============ ARCHIPHASE · utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = s => { const v = parseFloat(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
/* ---- Durées : stockées en jours ouvrés (t.d), affichées et saisies en j / sem. / mois / ans ----
   1 semaine = nombre de jours travaillés par semaine du calendrier (5 par défaut) ; 1 mois = semaine × 52 / 12 (22 j) ; 1 an = semaine × 52 (260 j). */
const DUR_U = {j:'jour(s)', s:'semaine(s)', m:'mois', a:'an(s)'};
function durBase(){ const wk = Math.max(1, ((typeof state !== 'undefined' && state?.cal?.week) || [0, 1, 1, 1, 1, 1, 0]).filter(Boolean).length); return {j:1, s:wk, m:Math.max(wk, Math.round(wk * 52 / 12)), a:wk * 52}; }
/* {v, u} : valeur et unité d'affichage ; pref = unité choisie par l'utilisateur pour cette tâche (gardée si la valeur reste ≥ 1) */
function durSplit(n, pref){
  const B = durBase(); n = Math.max(0, Math.round(n || 0));
  if (pref && B[pref] && pref !== 'j'){ const v = Math.round(n / B[pref] * 100) / 100; if (v >= 1 && Math.round(v * B[pref]) === n) return {v, u:pref}; }
  if (pref === 'j') return {v:n, u:'j'};
  for (const u of ['a', 'm', 's']) if (n >= B[u] && n % B[u] === 0) return {v:n / B[u], u};
  return {v:n, u:'j'};
}
const fmtDur = (n, pref) => { const {v, u} = durSplit(n, pref); return nf(v, v % 1 ? 1 : 0) + ' ' + (u === 'j' ? 'j' : u === 's' ? 'sem.' : u === 'm' ? 'mois' : v > 1 ? 'ans' : 'an'); };
/* unité écrite dans un texte (« 3 sem » → 's'), '' si aucune, null si inconnue */
function durUnitOf(txt){
  const m = String(txt ?? '').trim().toLowerCase().match(/^[\d.,\s]+([a-zéèû.]*)$/); if (!m) return null;
  const w = m[1].replace(/\./g, ''); if (!w) return '';
  return /^(j|jr|jrs|jour|jours)$/.test(w) ? 'j' : /^(s|sem|semaine|semaines)$/.test(w) ? 's' : /^(m|mo|mois)$/.test(w) ? 'm' : /^(a|an|ans|annee|année|annees|années)$/.test(w) ? 'a' : null;
}
/* « 3 sem », « 2 mois », « 1,5 an », « 10 » (unité par défaut : defU) → jours ouvrés (NaN si illisible) */
function parseDur(txt, defU = 'j'){
  const m = String(txt ?? '').trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)/), u = durUnitOf(txt);
  return m && u !== null ? Math.round(parseFloat(m[1]) * durBase()[u || defU]) : NaN;
}
const nf = (x, d = 0) => Number(x || 0).toLocaleString('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d});
const eur = x => Number(x || 0).toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0});
const uid = () => 't' + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
const LS = {get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }};
const MQ_COARSE = matchMedia('(pointer: coarse)');
const isNarrow = matchMedia('(max-width: 860px)');
let toastT;
function toast(msg, ms = 3200){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
async function downloadBlob(blob, name){
  try { const dl = window.claude?.use ? await window.claude.use('downloads') : null; if (dl){ await dl.save({filename:name, data:blob instanceof Blob ? await blob.text() : String(blob)}); return; } } catch(e){ if (e?.code === 'declined') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = s => String(s || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'projet';
/* droits d'export : licence ARCHIPHASE (ou offre gratuite pour tous tant que l'app est en test) */
function canExport(){ const a = window.SPAccess; if (a && a.level !== 'pending' && !a.canExport){ window.SPLicense?.prompt('export'); return false; } window.SPLicense?.usage?.(); return true; }
/* fenêtre de l'app (même style que les autres apps Archi) */
function engDlg(html, cls = ''){
  const d = $('#engDlg'); d.className = cls; d.querySelector('.edlg-card').innerHTML = html; d.hidden = false;
  d.onclick = e => { if (e.target === d || e.target.closest('[data-x]')) closeEng(); };
  setTimeout(() => d.querySelector('input,select,textarea,button:not([data-x])')?.focus(), 30);
  return d.querySelector('.edlg-card');
}
function closeEng(){ $('#engDlg').hidden = true; }
function popMenu(menu, anchor){
  const r = anchor.getBoundingClientRect(); menu.hidden = false;
  menu.style.top = Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 8) + 'px';
  menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
}
function popAt(menu, x, y){ menu.hidden = false; menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px'; }
document.addEventListener('pointerdown', e => { $$('.menu').forEach(m => { if (!m.hidden && !m.contains(e.target) && !e.target.closest('[aria-haspopup]') && m.id !== 'userMenu' && m.id !== 'homeMenu') m.hidden = true; }); }, true);
