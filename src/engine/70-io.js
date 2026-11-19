/* ============ Imports et exports : GanttProject (.gan), MS Project (.xml), CSV, image, impression / PDF, agenda (.ics), JSON ============ */
const xmlEsc = s => String(s ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;'}[c]));
const cdata = s => '<![CDATA[' + String(s ?? '').replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
const stamp = () => new Date().toISOString().slice(0, 10);
const fname = ext => `${safeName(state.name)}-${stamp()}.${ext}`;
/* ---------- GanttProject ---------- */
const GAN_T = {SS:1, FS:2, FF:3, SF:4}, GAN_R = {1:'SS', 2:'FS', 3:'FF', 4:'SF'};
function toGan(){
  const num = new Map(state.els.map((t, i) => [t.id, i])), rnum = new Map(state.res.map((r, i) => [r.id, i]));
  const succ = {}; state.els.forEach(t => t.deps.forEach(L => (succ[L.id] ||= []).push({to:t.id, ...L})));
  const task = t => { const r = C[t.id], ch = kids(t.id), col = colOf(t)[1].toLowerCase();
    return `<task id="${num.get(t.id)}" name="${xmlEsc(t.name)}" color="${col}" meeting="${t.ms}" start="${dayToIso(r.ds)}" duration="${t.ms ? 0 : r.dur}" complete="${r.p}" priority="${{low:0, normal:1, high:2, crit:3}[t.prio] ?? 1}" expand="${!t.c}">`
      + (t.note ? `<notes>${cdata(t.note)}</notes>` : '') + (succ[t.id] || []).map(s => `<depend id="${num.get(s.to)}" type="${GAN_T[s.t]}" difference="${s.lag}" hardness="Strong"/>`).join('') + ch.map(task).join('') + '</task>'; };
  const wk = state.cal.week, hol = []; if (state.cal.hol !== false){ const y0 = dayDate(PROJ.start).getUTCFullYear(), y1 = dayDate(PROJ.end).getUTCFullYear(); for (let y = y0; y <= y1; y++) frHolidays(y).forEach((n, d) => hol.push(d)); }
  (state.cal.off || []).forEach(o => { for (let d = isoToDay(o.from); d <= isoToDay(o.to || o.from); d++) hol.push(d); });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<project name="${xmlEsc(state.name)}" company="${xmlEsc(state.meta.client)}" webLink="" view-date="${dayToIso(PROJ.start)}" view-index="0" gantt-divider-location="420" resource-divider-location="300" version="3.2.3247" locale="fr_FR">\n`
    + `<description>${cdata(state.meta.desc)}</description>\n<view zooming-state="default:3" id="gantt-chart"><field id="tpd3" name="Nom" width="200" order="0"/><field id="tpd4" name="Date de début" width="80" order="1"/><field id="tpd5" name="Date de fin" width="80" order="2"/></view>\n`
    + `<calendars><day-types><day-type id="0"/><day-type id="1"/><default-week id="1" name="default" sun="${1 - wk[0]}" mon="${1 - wk[1]}" tue="${1 - wk[2]}" wed="${1 - wk[3]}" thu="${1 - wk[4]}" fri="${1 - wk[5]}" sat="${1 - wk[6]}"/><only-show-weekends value="false"/><overriden-day-types/><days/></day-types>`
    + [...new Set(hol)].sort((a, b) => a - b).map(d => { const x = dayDate(d); return `<date year="${x.getUTCFullYear()}" month="${x.getUTCMonth() + 1}" date="${x.getUTCDate()}" type="HOLIDAY"/>`; }).join('') + '</calendars>\n'
    + `<tasks empty-milestones="true"><taskproperties><taskproperty id="tpd0" name="type" type="default" valuetype="icon"/><taskproperty id="tpd1" name="priority" type="default" valuetype="icon"/><taskproperty id="tpd2" name="info" type="default" valuetype="icon"/><taskproperty id="tpd3" name="name" type="default" valuetype="text"/><taskproperty id="tpd4" name="begindate" type="default" valuetype="date"/><taskproperty id="tpd5" name="enddate" type="default" valuetype="date"/><taskproperty id="tpd6" name="duration" type="default" valuetype="int"/><taskproperty id="tpd7" name="completion" type="default" valuetype="int"/></taskproperties>\n`
    + kids('').map(task).join('\n') + '\n</tasks>\n'
    + `<resources>${state.res.map(r => `<resource id="${rnum.get(r.id)}" name="${xmlEsc(r.name)}" function="Default:0" contacts="" phone=""><rate name="standard" value="${r.rate}"/></resource>`).join('')}</resources>\n`
    + `<allocations>${state.els.flatMap(t => t.res.map(a => `<allocation task-id="${num.get(t.id)}" resource-id="${rnum.get(a.id)}" function="Default:0" responsible="true" load="${a.u.toFixed(1)}"/>`)).join('')}</allocations>\n<vacations/><previous/><roles roleset-name="Default"/>\n</project>\n`;
}
function fromGan(xml, name){
  const doc = new DOMParser().parseFromString(xml, 'text/xml'), P = doc.querySelector('project'); if (!P || doc.querySelector('parsererror')) throw new Error('fichier .gan illisible');
  const st = blankState(P.getAttribute('name') || name), map = {}, deps = [];
  st.meta.client = P.getAttribute('company') || ''; st.meta.desc = doc.querySelector('project > description')?.textContent || '';
  const dw = doc.querySelector('default-week'); if (dw) st.cal.week = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(k => dw.getAttribute(k) === '1' ? 0 : 1);
  // jours fériés du fichier → fermetures (on garde aussi nos fériés français)
  doc.querySelectorAll('calendars > date[type="HOLIDAY"]').forEach(d => { const y = d.getAttribute('year'); if (!y) return; const iso = `${y}-${String(d.getAttribute('month')).padStart(2, '0')}-${String(d.getAttribute('date')).padStart(2, '0')}`; if (!holidayName(isoToDay(iso))) st.cal.off.push({from:iso, to:iso, name:'Jour non travaillé (GanttProject)'}); });
  let minS = Infinity;
  const walk = (el, par) => [...el.children].filter(c => c.tagName === 'task').forEach(c => {
    const id = uid(), ms = c.getAttribute('meeting') === 'true', s = c.getAttribute('start'), d = Math.round(+c.getAttribute('duration') || 0);
    map[c.getAttribute('id')] = id; minS = Math.min(minS, isoToDay(s));
    const col = c.getAttribute('color'), near = col ? nearestColor(col) : '';
    st.els.push({id, name:c.getAttribute('name') || 'Tâche', s, d:ms ? 0 : Math.max(1, d), ms, p:+c.getAttribute('complete') || 0, par, deps:[], res:[], col:near, prio:['low', 'normal', 'high', 'crit'][+c.getAttribute('priority')] || 'normal', note:c.querySelector(':scope > notes')?.textContent || '', c:c.getAttribute('expand') === 'false'});
    [...c.children].filter(x => x.tagName === 'depend').forEach(x => deps.push({from:c.getAttribute('id'), to:x.getAttribute('id'), t:GAN_R[x.getAttribute('type')] || 'FS', lag:Math.round(+x.getAttribute('difference') || 0)}));
    walk(c, id);
  });
  const T = doc.querySelector('tasks'); if (T) walk(T, '');
  deps.forEach(x => { const t = st.els.find(q => q.id === map[x.to]); if (t && map[x.from]) t.deps.push({id:map[x.from], t:x.t, lag:x.lag}); });
  const rmap = {}; doc.querySelectorAll('resources > resource').forEach((r, i) => { const id = 'r' + uid().slice(1); rmap[r.getAttribute('id')] = id; st.res.push({id, name:r.getAttribute('name') || 'Ressource', role:'', col:COLORS[(i + 1) % COLORS.length][0], rate:+(r.querySelector('rate')?.getAttribute('value') || 0), cap:100}); });
  doc.querySelectorAll('allocations > allocation').forEach(a => { const t = st.els.find(q => q.id === map[a.getAttribute('task-id')]), rid = rmap[a.getAttribute('resource-id')]; if (t && rid) t.res.push({id:rid, u:Math.round(+a.getAttribute('load') || 100)}); });
  if (Number.isFinite(minS)) st.start = dayToIso(minS);
  return migrate(st);
}
function nearestColor(hex){ const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!h) return ''; const v = parseInt(h[1], 16), rgb = [v >> 16, v >> 8 & 255, v & 255];
  let best = '', bd = Infinity; COLORS.forEach(([k, c]) => { const w = parseInt(c.slice(1), 16), q = [w >> 16, w >> 8 & 255, w & 255], d = q.reduce((a, x, i) => a + (x - rgb[i]) ** 2, 0); if (d < bd){ bd = d; best = k; } }); return best === 'teal' ? '' : best; }
/* ---------- MS Project (XML d'échange) ---------- */
const MSP_T = {FF:0, FS:1, SF:2, SS:3}, MSP_R = ['FF', 'FS', 'SF', 'SS'];
function toMsp(){
  const uidOf = new Map(state.els.map((t, i) => [t.id, i + 1])), W1 = wbs(), ruid = new Map(state.res.map((r, i) => [r.id, i + 1]));
  const dt = (d, end) => dayToIso(d) + (end ? 'T17:00:00' : 'T08:00:00');
  const wk = state.cal.week;
  const tasks = state.els.map((t, i) => { const r = C[t.id], lv = level(t) + 1;
    return `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${xmlEsc(t.name)}</Name><Type>1</Type><IsNull>0</IsNull><WBS>${W1[t.id]}</WBS><OutlineNumber>${W1[t.id]}</OutlineNumber><OutlineLevel>${lv}</OutlineLevel>`
      + `<Priority>${{low:300, normal:500, high:700, crit:900}[t.prio] || 500}</Priority><Start>${dt(r.ds)}</Start><Finish>${dt(r.de, !t.ms)}</Finish><Duration>PT${(t.ms ? 0 : r.dur) * 8}H0M0S</Duration><DurationFormat>7</DurationFormat>`
      + `<Milestone>${t.ms ? 1 : 0}</Milestone><Summary>${r.sum ? 1 : 0}</Summary><PercentComplete>${r.p}</PercentComplete><ConstraintType>${r.sum ? 0 : 4}</ConstraintType>${r.sum ? '' : `<ConstraintDate>${dt(isoToDay(t.s))}</ConstraintDate>`}`
      + (t.note ? `<Notes>${xmlEsc(t.note)}</Notes>` : '') + t.deps.map(L => `<PredecessorLink><PredecessorUID>${uidOf.get(L.id)}</PredecessorUID><Type>${MSP_T[L.t]}</Type><CrossProject>0</CrossProject><LinkLag>${L.lag * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join('') + '</Task>'; });
  const days = [1, 2, 3, 4, 5, 6, 7].map(n => `<WeekDay><DayType>${n}</DayType><DayWorking>${wk[n - 1] ? 1 : 0}</DayWorking>${wk[n - 1] ? '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>' : ''}</WeekDay>`).join('');
  const exc = []; if (state.cal.hol !== false){ const y0 = dayDate(PROJ.start).getUTCFullYear(), y1 = dayDate(PROJ.end).getUTCFullYear(); for (let y = y0; y <= y1; y++) frHolidays(y).forEach((n, d) => exc.push([d, d, n])); }
  (state.cal.off || []).forEach(o => exc.push([isoToDay(o.from), isoToDay(o.to || o.from), o.name || 'Fermeture']));
  const excX = exc.map(([a, b]) => `<WeekDay><DayType>0</DayType><DayWorking>0</DayWorking><TimePeriod><FromDate>${dayToIso(a)}T00:00:00</FromDate><ToDate>${dayToIso(b)}T23:59:00</ToDate></TimePeriod></WeekDay>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project">\n<SaveVersion>14</SaveVersion><Name>${xmlEsc(state.name)}</Name><Title>${xmlEsc(state.name)}</Title><Company>${xmlEsc(state.meta.client)}</Company><Manager>${xmlEsc(state.meta.manager)}</Manager>`
    + `<ScheduleFromStart>1</ScheduleFromStart><StartDate>${dt(PROJ.start)}</StartDate><FinishDate>${dt(PROJ.end, true)}</FinishDate><CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth><CurrencySymbol>€</CurrencySymbol><CurrencyCode>EUR</CurrencyCode>\n`
    + `<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${days}${excX}</WeekDays></Calendar></Calendars>\n<Tasks>\n${tasks.join('\n')}\n</Tasks>\n`
    + `<Resources>${state.res.map(r => `<Resource><UID>${ruid.get(r.id)}</UID><ID>${ruid.get(r.id)}</ID><Name>${xmlEsc(r.name)}</Name><Type>1</Type><Group>${xmlEsc(r.role)}</Group><MaxUnits>${(r.cap / 100).toFixed(2)}</MaxUnits><StandardRate>${(r.rate / 8).toFixed(2)}</StandardRate><StandardRateFormat>2</StandardRateFormat></Resource>`).join('')}</Resources>\n`
    + `<Assignments>${state.els.flatMap(t => t.res.map(a => [t, a])).map(([t, a], i) => `<Assignment><UID>${i + 1}</UID><TaskUID>${uidOf.get(t.id)}</TaskUID><ResourceUID>${ruid.get(a.id)}</ResourceUID><Units>${(a.u / 100).toFixed(2)}</Units></Assignment>`).join('')}</Assignments>\n</Project>\n`;
}
function fromMsp(xml, name){
  const doc = new DOMParser().parseFromString(xml, 'text/xml'); if (doc.querySelector('parsererror') || !doc.getElementsByTagName('Task').length) throw new Error('fichier MS Project illisible');
  const g = (el, k) => el.getElementsByTagName(k)[0]?.textContent ?? '';
  const st = blankState(g(doc.documentElement, 'Title') || g(doc.documentElement, 'Name') || name); st.meta.client = g(doc.documentElement, 'Company'); st.meta.manager = g(doc.documentElement, 'Manager');
  const map = {}, stack = [], links = []; let minS = Infinity;
  [...doc.getElementsByTagName('Tasks')[0].children].forEach(T => {
    if (g(T, 'IsNull') === '1') return; const lv = +g(T, 'OutlineLevel') || 1; if (lv === 0) return;
    const id = uid(), s = g(T, 'Start').slice(0, 10), f = g(T, 'Finish').slice(0, 10), ms = g(T, 'Milestone') === '1';
    const h = /PT(\d+(?:\.\d+)?)H(\d+)M/.exec(g(T, 'Duration')); let d = h ? Math.round((+h[1] + +h[2] / 60) / 8) : NaN;
    map[g(T, 'UID')] = id; stack[lv] = id; stack.length = lv + 1; minS = Math.min(minS, isoToDay(s));
    const t = {id, name:g(T, 'Name') || 'Tâche', s, d:ms ? 0 : d, _f:f, ms, p:+g(T, 'PercentComplete') || 0, par:lv > 1 ? stack[lv - 1] || '' : '', deps:[], res:[], col:'', prio:(+g(T, 'Priority') || 500) >= 900 ? 'crit' : (+g(T, 'Priority') || 500) >= 700 ? 'high' : (+g(T, 'Priority') || 500) <= 300 ? 'low' : 'normal', note:g(T, 'Notes'), c:false};
    st.els.push(t);
    [...T.getElementsByTagName('PredecessorLink')].forEach(L => links.push({to:id, from:g(L, 'PredecessorUID'), t:MSP_R[+g(L, 'Type')] || 'FS', lag:Math.round((+g(L, 'LinkLag') || 0) / 4800)}));
  });
  if (Number.isFinite(minS)) st.start = dayToIso(minS);
  CAL.build(st.cal, isoToDay(st.start));
  st.els.forEach(t => { if (!t.ms && !Number.isFinite(t.d)) t.d = Math.max(1, CAL.count(isoToDay(t.s), isoToDay(t._f))); delete t._f; });
  links.forEach(x => { const t = st.els.find(q => q.id === x.to); if (t && map[x.from]) t.deps.push({id:map[x.from], t:x.t, lag:x.lag}); });
  const rmap = {}; [...(doc.getElementsByTagName('Resources')[0]?.children || [])].forEach((R, i) => { const nm = g(R, 'Name'); if (!nm) return; const id = 'r' + uid().slice(1); rmap[g(R, 'UID')] = id; st.res.push({id, name:nm, role:g(R, 'Group'), col:COLORS[(i + 1) % COLORS.length][0], rate:Math.round((+g(R, 'StandardRate') || 0) * 8), cap:Math.round((+g(R, 'MaxUnits') || 1) * 100)}); });
  [...(doc.getElementsByTagName('Assignments')[0]?.children || [])].forEach(A => { const t = st.els.find(q => q.id === map[g(A, 'TaskUID')]), rid = rmap[g(A, 'ResourceUID')]; if (t && rid) t.res.push({id:rid, u:Math.round((+g(A, 'Units') || 1) * 100)}); });
  return migrate(st);
}
/* ---------- CSV (tableur) ---------- */
function toCsv(){
  const W1 = wbs(), rn = new Map(state.els.map((t, i) => [t.id, i + 1])), q = s => { s = String(s ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['ID', 'N°', 'Nom', 'Type', 'Début', 'Fin', 'Durée (j ouvrés)', 'Avancement (%)', 'Prédécesseurs', 'Ressources', 'Marge (j)', 'Critique', 'Coût (€)', 'Notes']];
  state.els.forEach(t => { const r = C[t.id]; rows.push([rn.get(t.id), W1[t.id], t.name, r.sum ? 'Récapitulative' : t.ms ? 'Jalon' : 'Tâche', fmtD(r.ds), fmtD(r.de), t.ms ? 0 : r.dur, r.p,
    t.deps.map(L => rn.get(L.id) + (L.t !== 'FS' || L.lag ? L.t + (L.lag ? (L.lag > 0 ? '+' : '') + L.lag : '') : '')).join(','), t.res.map(a => (state.res.find(x => x.id === a.id)?.name || '') + (a.u !== 100 ? ` (${a.u}%)` : '')).join(', '),
    r.sum ? '' : Math.max(0, r.slack), r.crit ? 'oui' : 'non', Math.round(r.cost || 0), t.note]); });
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
}
function parseCsvText(txt){
  txt = txt.replace(/^﻿/, ''); const first = txt.split(/\r?\n/)[0] || ''; const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++){ const c = txt[i];
    if (q){ if (c === '"'){ if (txt[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === sep){ row.push(cell); cell = ''; } else if (c === '\n' || c === '\r'){ if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; } else cell += c; }
  if (cell || row.length){ row.push(cell); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}
function parseDateFR(s){ s = String(s || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return isoToDay(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s))){ const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return isoToDay(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`); }
  return NaN; }
function fromCsv(txt, name){
  const rows = parseCsvText(txt); if (rows.length < 2) throw new Error('tableau vide');
  const H = rows[0].map(h => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...k) => H.findIndex(h => k.some(x => h === x || h.startsWith(x)));
  const cId = col('id'), cWbs = col('n°', 'no', 'wbs', 'outline number', 'numero'), cName = col('nom', 'name', 'tache', 'task'), cStart = col('debut', 'begin date', 'start', 'date de debut'),
    cEnd = col('fin', 'end date', 'finish', 'date de fin'), cDur = col('duree', 'duration'), cP = col('avancement', 'completion', '% complete', '%'), cPred = col('predecesseurs', 'predecessors'), cRes = col('ressources', 'resources'), cNote = col('notes', 'note'), cType = col('type');
  if (cName < 0) throw new Error('colonne « Nom » introuvable');
  const st = blankState(name), byWbs = {}, byNum = {}, pend = [], rmap = {};
  let minS = Infinity;
  rows.slice(1).forEach((r, i) => {
    const nm = (r[cName] || '').trim(); if (!nm) return;
    const id = uid(), s = parseDateFR(r[cStart]), e = parseDateFR(r[cEnd]), d = Math.round(num(r[cDur])), ty = (r[cType] || '').toLowerCase();
    const ms = /jalon|milestone/.test(ty) || d === 0;
    const w = (r[cWbs] || '').trim(), par = w.includes('.') ? byWbs[w.split('.').slice(0, -1).join('.')] || '' : '';
    const t = {id, name:nm, s:Number.isFinite(s) ? dayToIso(s) : '', _e:e, d:ms ? 0 : (Number.isFinite(d) && d > 0 ? d : NaN), ms, p:clamp(Math.round(num(r[cP])) || 0, 0, 100), par, deps:[], res:[], col:'', prio:'normal', note:(r[cNote] || '').trim(), c:false};
    if (w) byWbs[w] = id; byNum[(r[cId] || String(i + 1)).trim()] = id; if (Number.isFinite(s)) minS = Math.min(minS, s);
    if (cPred >= 0 && r[cPred]) pend.push([t, r[cPred]]);
    if (cRes >= 0 && r[cRes]) r[cRes].split(/[,;]/).map(x => x.trim()).filter(Boolean).forEach(x => { const m = /^(.*?)(?:\s*\((\d+)\s*%\))?$/.exec(x), nmR = m[1].trim(); let rid = rmap[nmR]; if (!rid){ rid = rmap[nmR] = 'r' + uid().slice(1); st.res.push({id:rid, name:nmR, role:'', col:COLORS[(st.res.length + 1) % COLORS.length][0], rate:0, cap:100}); } t.res.push({id:rid, u:+(m[2] || 100)}); });
    st.els.push(t);
  });
  if (Number.isFinite(minS)) st.start = dayToIso(minS);
  CAL.build(st.cal, isoToDay(st.start));
  st.els.forEach(t => { if (!t.s) t.s = st.start; if (!t.ms && !Number.isFinite(t.d)) t.d = Number.isFinite(t._e) ? Math.max(1, CAL.count(isoToDay(t.s), t._e)) : 1; delete t._e; });
  pend.forEach(([t, txt]) => String(txt).split(/[,;\s]+/).filter(Boolean).forEach(x => { const m = /^(\d+(?:\.\d+)*)\s*-?\s*(FS|SS|FF|SF|FD|DD|DF)?\s*([+-]\s*\d+)?/i.exec(x); if (!m) return; const p = byNum[m[1]] || byWbs[m[1]]; if (!p || p === t.id) return;
    const ty = ({FD:'FS', DD:'SS', DF:'SF'})[(m[2] || '').toUpperCase()] || (m[2] || 'FS').toUpperCase(); t.deps.push({id:p, t:ty, lag:m[3] ? +m[3].replace(/\s/g, '') : 0}); }));
  return migrate(st);
}
function parseFile(name, text){
  const n = String(name || '').toLowerCase(), base = String(name || 'Planning importé').replace(/\.(gan|xml|csv|json|mpp|xlsx|xlsm|xls)$/i, '');
  if (/\.mpp$/.test(n)) throw new Error('le format .mpp de Microsoft Project est fermé : enregistrez le projet en XML depuis MS Project (Fichier → Enregistrer sous → XML)');
  const t = String(text || '').trim();
  if (t.startsWith('{')) { const s = JSON.parse(t); return migrate(s); }
  if (/\.gan$/.test(n) || /<project[\s>][\s\S]*<tasks/i.test(t.slice(0, 4000)) && !/schemas\.microsoft\.com\/project/.test(t.slice(0, 600))) return fromGan(t, base);
  if (/\.xml$/.test(n) || /schemas\.microsoft\.com\/project/.test(t.slice(0, 600))) return fromMsp(t, base);
  try { return smartTable(parseCsvText(t), base); } catch(e){ try { return fromCsv(t, base); } catch(x){ throw e; } }
}
/* ---------- vue vectorielle du planning (image et impression) ---------- */
function ganttSVG(opt = {}){
  const rows = state.els, rh = 22, tw = opt.tw || 470, pad = 16, headH = 46, titleH = opt.title === false ? 0 : 74;
  const span = PROJ.end - PROJ.start + 1, a = PROJ.start - Math.max(2, Math.round(span * .02)), b = PROJ.end + Math.max(4, Math.round(span * .06));
  const cw = opt.cw || 1300, px = cw / (b - a + 1), x = d => tw + (d - a) * px, W = tw + cw + pad, H = titleH + headH + rows.length * rh + 40;
  const W1 = wbs(); let s = '';
  const F = 'font-family="Inter,Segoe UI,Arial,sans-serif"';
  if (titleH){ s += `<text x="${pad}" y="30" font-size="20" font-weight="700" fill="#0D1E45" ${F}>${xmlEsc(state.name)}</text><text x="${pad}" y="52" font-size="11.5" fill="#56637C" ${F}>${xmlEsc([state.meta.client, state.meta.manager].filter(Boolean).join(' · '))}${state.meta.client || state.meta.manager ? ' · ' : ''}Du ${fmtDL(PROJ.start)} au ${fmtDL(PROJ.end)} · ${PROJ.ef - PROJ.es + 1} jours ouvrés · avancement ${PROJ.p} %</text>`
    + `<text x="${W - pad}" y="30" font-size="11" text-anchor="end" fill="#56637C" ${F}>ARCHIPHASE · Studio Prism</text><text x="${W - pad}" y="48" font-size="11" text-anchor="end" fill="#56637C" ${F}>Édité le ${new Date().toLocaleDateString('fr-FR')}</text>`; }
  const y0 = titleH, yb = y0 + headH;
  // en-tête de la chronologie : mois puis semaines (ou années / mois selon la durée)
  const longP = span > 300; let x0 = dayDate(a), m = Date.UTC(x0.getUTCFullYear(), x0.getUTCMonth(), 1) / DAY;
  s += `<rect x="0" y="${y0}" width="${W}" height="${headH}" fill="#F1F5F9"/><rect x="${tw}" y="${yb}" width="${cw}" height="${rows.length * rh}" fill="#fff"/>`;
  if (px >= 2) for (let d = a; d <= b; d++) if (!CAL.w(d)) s += `<rect x="${x(d)}" y="${yb}" width="${px}" height="${rows.length * rh}" fill="#EEF2F6"/>`;
  while (m <= b){ const y = dayDate(m), n = Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + 1, 1) / DAY, xa = Math.max(x(m), tw), xb = Math.min(x(n), tw + cw);
    if (xb > xa){ s += `<line x1="${xa}" x2="${xa}" y1="${y0 + 22}" y2="${yb + rows.length * rh}" stroke="#D5DEE8"/>`; if (xb - xa > 26) s += `<text x="${(xa + xb) / 2}" y="${y0 + (longP ? 38 : 16)}" font-size="10.5" text-anchor="middle" fill="#334155" ${F}>${longP ? MOIS_C[y.getUTCMonth()] : MOIS[y.getUTCMonth()] + ' ' + y.getUTCFullYear()}</text>`; }
    m = n; }
  if (longP){ for (let y = dayDate(a).getUTCFullYear(); y <= dayDate(b).getUTCFullYear(); y++){ const xa = Math.max(x(Date.UTC(y, 0, 1) / DAY), tw), xb = Math.min(x(Date.UTC(y + 1, 0, 1) / DAY), tw + cw); if (xb > xa + 20) s += `<text x="${(xa + xb) / 2}" y="${y0 + 16}" font-size="11" font-weight="700" text-anchor="middle" fill="#0D1E45" ${F}>${y}</text>`; } }
  else for (let d = a - ((dow(a) + 6) % 7); d <= b; d += 7){ if (d < a) continue; const xa = x(d); s += `<line x1="${xa}" x2="${xa}" y1="${y0 + 26}" y2="${yb}" stroke="#D5DEE8"/>`; if (7 * px > 24) s += `<text x="${xa + 3.5 * px}" y="${y0 + 38}" font-size="9.5" text-anchor="middle" fill="#56637C" ${F}>S${isoWeek(d)}</text>`; }
  // tableau
  const cx = {wbs:pad, name:pad + 38, start:tw - 178, end:tw - 118, dur:tw - 58};
  s += `<text x="${cx.wbs}" y="${y0 + 30}" font-size="10" font-weight="700" fill="#334155" ${F}>N°</text><text x="${cx.name}" y="${y0 + 30}" font-size="10" font-weight="700" fill="#334155" ${F}>Tâche</text><text x="${cx.start}" y="${y0 + 30}" font-size="10" font-weight="700" fill="#334155" ${F}>Début</text><text x="${cx.end}" y="${y0 + 30}" font-size="10" font-weight="700" fill="#334155" ${F}>Fin</text><text x="${cx.dur}" y="${y0 + 30}" font-size="10" font-weight="700" fill="#334155" ${F}>Durée</text>`;
  const ys = {};
  rows.forEach((t, i) => { const r = C[t.id], y = yb + i * rh, cy = y + rh / 2, S = r.sum, [, c1, c2] = colOf(t); ys[t.id] = cy;
    if (i % 2) s += `<rect x="0" y="${y}" width="${tw}" height="${rh}" fill="#F8FAFC"/>`;
    s += `<line x1="0" x2="${W}" y1="${y + rh}" y2="${y + rh}" stroke="#EEF2F6"/>`;
    const nm = t.name.length > 44 - r.lvl * 2 ? t.name.slice(0, 43 - r.lvl * 2) + '…' : t.name;
    s += `<text x="${cx.wbs}" y="${cy + 3.5}" font-size="9.5" fill="#64748B" ${F}>${W1[t.id]}</text><text x="${cx.name + r.lvl * 12}" y="${cy + 3.5}" font-size="10.5" ${S ? 'font-weight="700" fill="#0D1E45"' : 'fill="#1E293B"'} ${F}>${xmlEsc(nm)}</text>`
      + `<text x="${cx.start}" y="${cy + 3.5}" font-size="9.5" fill="#334155" ${F}>${fmtD(r.ds)}</text><text x="${cx.end}" y="${cy + 3.5}" font-size="9.5" fill="#334155" ${F}>${fmtD(r.de)}</text><text x="${cx.dur}" y="${cy + 3.5}" font-size="9.5" fill="#334155" ${F}>${t.ms ? 'jalon' : r.dur + ' j'}</text>`;
    const xa = x(r.ds), xb = x(r.de + 1);
    if (t.ms) s += `<path d="M${xa} ${cy - 7}l7 7-7 7-7-7z" fill="#F28C28"/><text x="${xa + 11}" y="${cy + 3.5}" font-size="9.5" fill="#334155" ${F}>${fmtD(r.ds)}</text>`;
    else if (S) s += `<path d="M${xa} ${cy - 5}H${xb}V${cy + 3}L${xb - 5} ${cy - 1}H${xa + 5}L${xa} ${cy + 3}z" fill="#0D1E45"/>`;
    else { const crit = opt.crit && r.crit; s += `<rect x="${xa}" y="${cy - 6}" width="${Math.max(2, xb - xa)}" height="12" rx="3" fill="${crit ? '#E0524F' : c1}" opacity=".35"/><rect x="${xa}" y="${cy - 6}" width="${Math.max(0, (xb - xa) * t.p / 100)}" height="12" rx="3" fill="${crit ? '#B83A37' : c2}"/>`; }
  });
  // liens (simplifiés : fin → début)
  rows.forEach(t => t.deps.forEach(L => { const p = C[L.id], r = C[t.id]; if (!p || ys[L.id] == null) return; const xa = L.t === 'SS' || L.t === 'SF' ? x(p.ds) : x(p.de + 1), xb = L.t === 'FF' || L.t === 'SF' ? x(r.de + 1) : x(r.ds), ya = ys[L.id], yb2 = ys[t.id];
    s += `<path d="M${xa} ${ya}H${xa + 5}V${yb2 - (yb2 > ya ? 6 : -6)}" stroke="#7B8CA3" stroke-width=".8" fill="none"/><path d="M${xa + 5} ${yb2 - (yb2 > ya ? 6 : -6)}V${yb2}H${xb - 2}" stroke="#7B8CA3" stroke-width=".8" fill="none"/><path d="M${xb - 4} ${yb2 - 3}l4 3-4 3z" fill="#7B8CA3"/>`; }));
  const td = todayDay(); if (td >= a && td <= b) s += `<line x1="${x(td)}" x2="${x(td)}" y1="${y0 + 22}" y2="${yb + rows.length * rh}" stroke="#F28C28" stroke-width="1.4" stroke-dasharray="4 3"/><text x="${x(td) + 3}" y="${y0 + 20}" font-size="9" fill="#C85D17" ${F}>aujourd'hui</text>`;
  s += `<line x1="${tw}" x2="${tw}" y1="${y0}" y2="${yb + rows.length * rh}" stroke="#CBD5E1"/>`;
  const ly = yb + rows.length * rh + 22;
  s += `<g ${F} font-size="10" fill="#475569"><rect x="${pad}" y="${ly - 9}" width="20" height="10" rx="2" fill="#139AA6" opacity=".35"/><rect x="${pad}" y="${ly - 9}" width="10" height="10" rx="2" fill="#0E7F96"/><text x="${pad + 26}" y="${ly}">Tâche (partie foncée : réalisé)</text>`
    + `<path d="M${pad + 205} ${ly - 4}l5 5-5 5-5-5z" fill="#F28C28"/><text x="${pad + 216}" y="${ly}">Jalon</text><path d="M${pad + 262} ${ly - 8}H${pad + 292}V${ly - 2}L${pad + 288} ${ly - 5}H${pad + 266}L${pad + 262} ${ly - 2}z" fill="#0D1E45"/><text x="${pad + 298}" y="${ly}">Phase</text>`
    + (opt.crit ? `<rect x="${pad + 345}" y="${ly - 9}" width="20" height="10" rx="2" fill="#E0524F"/><text x="${pad + 371}" y="${ly}">Chemin critique</text>` : '') + `</g>`;
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${s}</svg>`, W, H};
}
async function exportPng(){
  const {svg, W, H} = ganttSVG({crit:state.view.crit, cw:Math.min(2400, Math.max(900, (PROJ.end - PROJ.start + 1) * 6))});
  const k = 2, img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const c = document.createElement('canvas'); c.width = W * k; c.height = H * k; const g = c.getContext('2d'); g.scale(k, k); g.drawImage(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); await downloadBlob(blob, fname('png')); toast('Image du planning téléchargée.');
}
function exportPrint(){
  const {svg} = ganttSVG({crit:state.view.crit, cw:1150, tw:440});
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(state.name)} — planning</title><style>@page{size:A3 landscape;margin:10mm}html,body{margin:0}body{font-family:Inter,Segoe UI,Arial,sans-serif}svg{width:100%;height:auto;display:block}.no{position:fixed;top:10px;right:10px;padding:10px 16px;border:0;border-radius:9px;background:#0D1E45;color:#fff;font:600 14px Inter,Arial;cursor:pointer}@media print{.no{display:none}}</style></head><body>${svg}<button class="no" onclick="print()">Imprimer · enregistrer en PDF</button><script>setTimeout(()=>print(),400)<\/script></body></html>`;
  const w = window.open('', '_blank'); if (w){ w.document.open(); w.document.write(html); w.document.close(); return; }
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); f.srcdoc = html; setTimeout(() => f.remove(), 60000);
}
function toIcs(){
  const ev = [], st = dayToIso(todayDay()).replace(/-/g, ''), d8 = d => dayToIso(d).replace(/-/g, ''), fold = s => s.replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n');
  state.els.forEach(t => { const r = C[t.id]; if (!(t.ms || r.sum)) return;
    ev.push(['BEGIN:VEVENT', `UID:${t.id}@archiphase.studio-prism`, `DTSTAMP:${st}T000000Z`, `DTSTART;VALUE=DATE:${d8(r.ds)}`, `DTEND;VALUE=DATE:${d8((t.ms ? r.ds : r.de) + 1)}`, `SUMMARY:${fold((t.ms ? '◆ ' : '') + t.name)}`, `DESCRIPTION:${fold(state.name + (t.note ? '\n' + t.note : ''))}`, 'END:VEVENT'].join('\r\n')); });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studio Prism//ARCHIPHASE//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${fold(state.name)}`, ...ev, 'END:VCALENDAR'].join('\r\n');
}
async function doExport(k){
  if (!canExport(k)) return;
  try {
    if (k === 'gan') await downloadBlob(new Blob([toGan()], {type:'application/xml'}), fname('gan'));
    else if (k === 'msp') await downloadBlob(new Blob([toMsp()], {type:'application/xml'}), fname('xml'));
    else if (k === 'csv') await downloadBlob(new Blob([toCsv()], {type:'text/csv;charset=utf-8'}), fname('csv'));
    else if (k === 'png') return await exportPng();
    else if (k === 'pdf') return exportPrint();
    else if (k === 'ics') await downloadBlob(new Blob([toIcs()], {type:'text/calendar'}), fname('ics'));
    else if (k === 'json') await downloadBlob(new Blob([JSON.stringify(state)], {type:'application/json'}), `${safeName(state.name)}-${stamp()}.archiphase.json`);
    toast('Fichier exporté.');
  } catch(e){ console.warn(e); toast('Export impossible : ' + (e.message || e)); }
}
/* miniature pour l'accueil (cartes des projets) */
function thumb(){
  try {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); g.fillStyle = '#F6F9FB'; g.fillRect(0, 0, 320, 180);
    const rows = state.els.slice(0, 16), a = PROJ.start, b = Math.max(PROJ.end, a + 5), sx = 300 / (b - a + 1), rh = Math.min(14, 168 / Math.max(1, rows.length));
    g.strokeStyle = '#E3E9F0'; for (let i = 0; i < 6; i++){ g.beginPath(); g.moveTo(10 + i * 60, 0); g.lineTo(10 + i * 60, 180); g.stroke(); }
    rows.forEach((t, i) => { const r = C[t.id], x = 10 + (r.ds - a) * sx, w = Math.max(3, (r.de - r.ds + 1) * sx), y = 6 + i * rh;
      if (t.ms){ g.fillStyle = '#F28C28'; g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x + rh / 2 - 1, y + rh / 2); g.lineTo(x, y + rh - 1); g.lineTo(x - rh / 2 + 1, y + rh / 2); g.fill(); }
      else if (r.sum){ g.fillStyle = '#0D1E45'; g.fillRect(x, y + rh * .3, w, rh * .3); }
      else { const [, c1, c2] = colOf(t); g.fillStyle = c1; g.globalAlpha = .45; g.fillRect(x, y + 2, w, rh - 4); g.globalAlpha = 1; g.fillStyle = c2; g.fillRect(x, y + 2, w * t.p / 100, rh - 4); } });
    const td = todayDay(); if (td >= a && td <= b){ g.strokeStyle = '#F28C28'; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(10 + (td - a) * sx, 0); g.lineTo(10 + (td - a) * sx, 180); g.stroke(); }
    return c.toDataURL('image/webp', .8);
  } catch(e){ return ''; }
}
