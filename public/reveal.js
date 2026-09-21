/* Sections fade up as they come into view: the fallback path.

   Browsers with scroll-driven animations do this in CSS instead, on the
   compositor, and this file returns immediately there. What is left is
   Safari and Firefox, where an observer is the only option.

   The hiding is applied here rather than in the stylesheet, on purpose. If
   the CSS hid these sections unconditionally, a visitor with JavaScript off
   would get a blank page below the hero. Instead the page renders complete,
   and this hides only what is still below the fold, which nobody is looking
   at yet.

   Skipped when the OS asks for reduced motion, and when the browser has no
   IntersectionObserver, in both cases leaving the page as it renders. */
(function () {
  // Where the stylesheet's scroll-driven animation applies, it has already
  // done this in CSS, tied to scroll position rather than to this callback.
  if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SELECTOR = '#build, #platform, #vision, #company, #contact, .footer';
  var sections = document.querySelectorAll(SELECTOR);
  if (!sections.length) return;

  var viewport = window.innerHeight || document.documentElement.clientHeight;

  var observer = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.classList.add('reveal--in');
        // One way only: a section that has arrived stays arrived.
        observer.unobserve(entries[i].target);
      }
    },
    // The root is stretched below the viewport so a section starts fading
    // before it scrolls into sight and has settled by the time it is being
    // read. Firing exactly at the edge makes the first line of a section
    // visibly chase the scroll, which reads as lag rather than as motion.
    { rootMargin: '0px 0px 20% 0px', threshold: 0 },
  );

  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    // Anything already on screen is left alone. Hiding it now would be a
    // visible flicker, and it has already been seen.
    if (section.getBoundingClientRect().top < viewport) continue;
    section.classList.add('reveal');
    observer.observe(section);
  }
})();
