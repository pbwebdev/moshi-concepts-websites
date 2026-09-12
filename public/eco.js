/* Trust-layer ring: cursor parallax (progressive enhancement).
   The CSS places everything; this only sets --px/--py on the diagram, which
   the nodes, orbit and hub read at different depths. Skipped on touch
   devices, when the OS asks for reduced motion, and below the desktop
   breakpoint where the ring becomes a list. */
(function () {
  var eco = document.querySelector('.eco');
  if (!eco) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var desktop = window.matchMedia('(min-width: 960px)');
  var MAX = 10;                 // max nudge in px at the diagram's edge
  var tx = 0, ty = 0;           // target
  var cx = 0, cy = 0;           // current (eased)
  var raf = null;

  function tick() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    eco.style.setProperty('--px', cx.toFixed(2) + 'px');
    eco.style.setProperty('--py', cy.toFixed(2) + 'px');
    raf = (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05)
      ? requestAnimationFrame(tick) : null;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

  function onMove(e) {
    if (!desktop.matches) return;
    var r = eco.getBoundingClientRect();
    if (!r.width) return;
    var nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    var ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    tx = Math.max(-1, Math.min(1, nx)) * MAX;
    ty = Math.max(-1, Math.min(1, ny)) * MAX;
    schedule();
  }
  function onLeave() { tx = 0; ty = 0; schedule(); }

  // Track across the whole section so the effect feels ambient, and ease
  // back to rest when the pointer leaves.
  var area = eco.closest('.trust') || eco;
  area.addEventListener('pointermove', onMove, { passive: true });
  area.addEventListener('pointerleave', onLeave, { passive: true });
})();
