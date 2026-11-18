/* intro ARCHIPHASE : les quatre barres du Gantt se tracent en cascade, le jalon apparaît, puis le curseur « aujourd'hui » balaie la feuille
   et dévoile, sur son passage, le logo officiel (assets/logo-wide.webp). Les barres animées occupent exactement la place de celles du logo :
   quand le rideau est passé, elles s'effacent sans le moindre saut. Web Animations API : déterministe et « seekable ».
   Une fois par session (sessionStorage), ?intro=1 pour rejouer. Exposé : window.__spHide() (demande de fermeture : le splash reste jusqu'à la fin de la scène). */
(function(){
  var sp = document.getElementById('splash'); if (!sp) return;
  var T0 = performance.now(), EXIT = 3200, FADE = 600, KEY = 'prism-intro-archiphase';
  var EASE_IN = 'cubic-bezier(.22,.8,.2,1)', EASE_IO = 'cubic-bezier(.65,0,.35,1)';
  var stage = sp.querySelector('.sp-stage'), skip = sp.querySelector('.sp-skip');
  var anims = [], endAt = T0 + EXIT, hiding = false, closed = false, hideT = 0, played = false;
  function q(s){ return sp.querySelector(s); }
  function qa(s){ return [].slice.call(sp.querySelectorAll(s)); }
  function fit(){ try { stage.style.setProperty('--k', (stage.offsetWidth / 1200).toFixed(5)); } catch(e){} }
  function A(el, kf, o){ if (!el) return null; o.fill = o.fill || 'both'; var a = el.animate(kf, o); anims.push(a); return a; }
  function cancelAll(){ anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); anims = []; }
  function finalize(){ cancelAll(); sp.classList.remove('sp-play'); sp.classList.add('sp-static', 'sp-on'); if (skip) skip.hidden = true; }
  function close(){
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', fit);
    sp.classList.add('done');
    try { if (sp.contains(document.activeElement)) document.activeElement.blur(); } catch(e){}
    setTimeout(function(){ cancelAll(); sp.remove(); var bg = document.getElementById('spBg'); if (bg) bg.remove(); }, FADE + 100);
  }
  function hide(){ if (hiding || closed) return; hiding = true; hideT = setTimeout(close, Math.max(0, endAt - performance.now())); }
  window.__spHide = hide;
  function doSkip(){ if (closed || !played) return; played = false; finalize(); endAt = performance.now(); if (hiding){ clearTimeout(hideT); close(); } }
  function onKey(e){
    if (!played) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.target === document.body || sp.contains(e.target)) && e.target !== skip)){ e.preventDefault(); doSkip(); }
  }
  fit(); window.addEventListener('resize', fit);
  var seen = false, force = /[?&]intro=1(&|$)/.test(location.search);
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch(e){}
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}
  try { var ui = JSON.parse(localStorage.getItem('prism.ui') || '{}'); if (ui && ui.motion === false) reduce = true; } catch(e){}
  if (reduce || (seen && !force)){ endAt = T0 + 600; sp.classList.add('sp-static', 'sp-on'); return; }
  try {
    try { sessionStorage.setItem(KEY, '1'); } catch(e){}
    sp.classList.add('sp-play', 'sp-on'); if (skip){ skip.hidden = false; skip.addEventListener('click', doSkip); }
    document.addEventListener('keydown', onKey, true);
    played = true;
    // 1) la feuille quadrillée, puis les barres du Gantt se tracent en cascade (chaque tâche démarre quand la précédente avance)
    A(q('.sp-grid'), [{opacity: 0}, {opacity: 1}], {duration: 420, easing: 'ease-out'});
    qa('.sp-bar').forEach(function(b, i){
      A(b, [{transform: 'scaleX(0)', opacity: 0}, {transform: 'scaleX(.06)', opacity: 1, offset: .08}, {transform: 'scaleX(1)', opacity: 1}], {delay: 180 + i * 230, duration: 520, easing: EASE_IN});
    });
    A(q('.sp-ms'), [{transform: 'rotate(45deg) scale(0)', opacity: 0}, {transform: 'rotate(45deg) scale(1.25)', opacity: 1, offset: .6}, {transform: 'rotate(45deg) scale(1)', opacity: 1}], {delay: 1140, duration: 360, easing: EASE_IN});
    // 2) le curseur « aujourd'hui » balaie la feuille ; le rideau, accroché au curseur, dévoile le logo officiel
    var X0 = 120, X1 = 1290, TS = 1380, DS = 1150;
    var cur = q('.sp-cur');
    A(cur, [{opacity: 0}, {opacity: 1, offset: .12}, {opacity: 1, offset: .88}, {opacity: 0}], {delay: TS - 200, duration: DS + 260, fill: 'both'});
    A(cur, [{transform: 'translateX(' + X0 + 'px)'}, {transform: 'translateX(' + X1 + 'px)'}], {delay: TS, duration: DS, easing: EASE_IO});
    A(q('.sp-curtain'), [{transform: 'translateX(' + X0 + 'px)'}, {transform: 'translateX(' + X1 + 'px)'}], {delay: TS, duration: DS, easing: EASE_IO});
    // 3) une fois dévoilées, les barres officielles prennent le relais (mêmes positions) ; le chargement apparaît
    A(q('.sp-bars'), [{opacity: 1}, {opacity: 0}], {delay: TS + 260, duration: 260, fill: 'forwards'});
    var END = TS + DS + 60;
    A(q('.sp-load'), [{opacity: 0}, {opacity: 1}], {delay: END - 200, duration: 300});
    A(q('.sp-msg'), [{opacity: 0}, {opacity: 1}], {delay: END - 200, duration: 300});
    EXIT = END + 450; endAt = T0 + EXIT;
    var master = A(stage, [{opacity: 1}, {opacity: 1}], {duration: END});
    master.onfinish = function(){ played = false; if (skip) skip.hidden = true; };
  } catch(err){ played = false; try { finalize(); } catch(e){} endAt = T0 + 600; }
})();
