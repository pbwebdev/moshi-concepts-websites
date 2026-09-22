/* Content blocks fade up as they come into view.

   The list below is the point of this file. Animating whole sections looked
   like nothing happening: a section's box begins well above its first line of
   text, so the fade was spent on padding and the heading arrived opaque. These
   are the blocks a reader actually looks at, and each fades on its own arrival.

   Anything already on screen when this runs is left alone. Hiding it at that
   point would be a visible flicker of content the visitor has already seen,
   and it is the reason nothing here is hidden by the stylesheet instead: with
   no JavaScript the page renders complete rather than blank. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GROUPS = [
    '.sec-head',
    '.flow__steps > *',
    '.flow__specs > .spec',
    '.trust__text',
    '.trust__media',
    '.rail__title',
    '.rail__steps > li',
    '.cards > .card',
    '.notes > .note',
    '.who__text',
    '.founder',
    '.cta__text',
    '.cta__form',
    '.footer__row',
    '.footer__backed',
    '.footer__bottom',
  ];

  // Matches .reveal--d1 to .reveal--d4 in the stylesheet.
  var MAX_STEP = 4;

  var viewport = window.innerHeight || document.documentElement.clientHeight;

  function arrive(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      var block = entries[i].target;
      block.classList.add('reveal--in');
      // One way only: a block that has arrived stays arrived.
      arriving.unobserve(block);
      settled.unobserve(block);
    }
  }

  // The usual trigger: the root is pulled up from the bottom edge so a block
  // starts moving once it is properly on screen, not while it is still
  // clipped by the fold.
  var arriving = new IntersectionObserver(arrive, { rootMargin: '0px 0px -12% 0px', threshold: 0 });

  // The safety net, and it is not optional. The last blocks on the page sit
  // in that bottom 12% when the document is scrolled as far as it goes, so
  // they can never enter the root above and would stay invisible for good.
  // Anything fully in view has arrived by any reasonable definition.
  var settled = new IntersectionObserver(arrive, { threshold: 1 });

  for (var g = 0; g < GROUPS.length; g++) {
    var nodes = document.querySelectorAll(GROUPS[g]);
    // Siblings are contiguous in document order, so the stagger counter only
    // has to reset when the parent changes.
    var parent = null;
    var step = 0;

    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (node.parentNode === parent) step++;
      else {
        parent = node.parentNode;
        step = 0;
      }

      if (node.getBoundingClientRect().top < viewport) continue;
      node.classList.add('reveal');
      if (step > 0) node.classList.add('reveal--d' + Math.min(step, MAX_STEP));
      arriving.observe(node);
      settled.observe(node);
    }
  }
})();
