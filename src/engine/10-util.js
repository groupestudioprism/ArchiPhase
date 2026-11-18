/* ============ ARCHIPHASE · utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = s => { const v = parseFloat(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
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
