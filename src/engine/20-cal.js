/* ============ Calendrier : jours ouvrés, jours fériés français, congés ============
   Toutes les dates du planning sont des « jours » entiers (nombre de jours depuis le 1er janvier 1970, UTC : aucun décalage d'heure d'été).
   Les calculs d'ordonnancement se font en « jours ouvrés » : un index qui ne compte que les jours travaillés. */
const DAY = 864e5;
const isoToDay = s => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '')); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY) : NaN; };
const dayToIso = d => new Date(d * DAY).toISOString().slice(0, 10);
const dayDate = d => new Date(d * DAY);
const todayDay = () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY); };
const dow = d => (d + 4) % 7;   // 0 = dimanche (le 1/1/1970 était un jeudi)
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const fmtD = d => { if (!Number.isFinite(d)) return '—'; const x = dayDate(d); return String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0') + '/' + String(x.getUTCFullYear()).slice(2); };
const fmtDL = d => { if (!Number.isFinite(d)) return '—'; const x = dayDate(d); return `${JOURS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const isoWeek = d => { const x = dayDate(d), t = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / DAY + 1) / 7); };
/* jours fériés en France métropolitaine (Pâques par l'algorithme de Meeus) */
function easter(y){ const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return Math.floor(Date.UTC(y, mo - 1, da) / DAY); }
const HOL_CACHE = {};
function frHolidays(y){
  if (HOL_CACHE[y]) return HOL_CACHE[y];
  const D = (m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY), E = easter(y);
  return HOL_CACHE[y] = new Map([[D(1, 1), "Jour de l'an"], [E + 1, 'Lundi de Pâques'], [D(5, 1), 'Fête du Travail'], [D(5, 8), 'Victoire 1945'], [E + 39, 'Ascension'], [E + 50, 'Lundi de Pentecôte'],
    [D(7, 14), 'Fête nationale'], [D(8, 15), 'Assomption'], [D(11, 1), 'Toussaint'], [D(11, 11), 'Armistice 1918'], [D(12, 25), 'Noël']]);
}
function holidayName(d){ return frHolidays(dayDate(d).getUTCFullYear()).get(d) || ''; }
/* calendrier du projet : semaine type, fériés, fermetures (plages) et jours travaillés exceptionnels */
const CAL = {
  O:0, N:0, isW:null, wi:null, days:null, key:'',
  build(cal, around){
    const key = JSON.stringify(cal) + '|' + around;
    if (key === this.key) return; this.key = key;
    const O = around - 3650, N = 3650 * 3; this.O = O; this.N = N;
    const off = new Set(), on = new Set();
    (cal.off || []).forEach(r => { const a = isoToDay(r.from), b = isoToDay(r.to || r.from); if (Number.isFinite(a)) for (let d = a; d <= (Number.isFinite(b) ? b : a); d++) off.add(d); });
    (cal.on || []).forEach(s => { const d = isoToDay(s); if (Number.isFinite(d)) on.add(d); });
    const isW = new Uint8Array(N), wi = new Int32Array(N + 1), days = []; let c = 0;
    for (let i = 0; i < N; i++){
      const d = O + i; let w = !!(cal.week || [0, 1, 1, 1, 1, 1, 0])[dow(d)];
      if (w && cal.hol !== false && holidayName(d)) w = false;
      if (off.has(d)) w = false; if (on.has(d)) w = true;
      wi[i] = c; if (w){ isW[i] = 1; days.push(d); c++; }
    }
    wi[N] = c; this.isW = isW; this.wi = wi; this.days = days;
    if (!days.length){ this.days = [O]; }   // calendrier sans aucun jour travaillé : on évite les plantages
  },
  w(d){ const i = d - this.O; return i >= 0 && i < this.N ? !!this.isW[i] : dow(d) % 6 !== 0; },
  /* index ouvré du jour d (si d est chômé : index du prochain jour travaillé) */
  toW(d){ const i = clamp(d - this.O, 0, this.N); return this.wi[i]; },
  /* jour correspondant à l'index ouvré w */
  toD(w){ const D = this.days; if (w < 0) return D[0] + w; if (w >= D.length) return D[D.length - 1] + (w - D.length + 1); return D[w]; },
  /* jours ouvrés entre deux jours inclus */
  count(a, b){ return b < a ? 0 : this.toW(b + 1) - this.toW(a); },
};
