/*
  Google Analytics 4, gated behind consent and deliberately loaded late.

  Nothing here runs on its own. It defines window.startAnalytics and waits;
  consent.js calls it only once the visitor has accepted, so no Google script
  is fetched and no analytics cookie is set for someone who has not agreed or
  has not answered yet. With JavaScript off, nothing loads at all.

  Two further departures from Google's own snippet:

  - Their snippet configures gtag from an inline <script>. That would force
    'unsafe-inline' into script-src, which would also admit every injected
    script. The configuration lives here instead, same-origin, which 'self'
    already covers.
  - gtag.js is large and runs on the main thread, so fetching it during page
    load competes with the hero image and adds work inside the window
    Lighthouse scores. It is fetched once the page has loaded and the browser
    is idle, or the moment the visitor interacts, whichever comes first.
    gtag.js replays whatever is already queued on dataLayer when it arrives,
    so the pageview survives the wait.

  Load order matters: this file must come before consent.js in the HTML, so
  that window.startAnalytics exists by the time consent.js looks for it.
*/
(function () {
  var MEASUREMENT_ID = "G-L82FEFSKJE";
  var IDLE_TIMEOUT = 3000;
  var FALLBACK_DELAY = 2000;
  var WAKE_EVENTS = ["pointerdown", "keydown", "scroll"];
  var listenerOptions = { once: true, passive: true, capture: true };
  var fetched = false;
  var started = false;

  function fetchGtag() {
    if (fetched) return;
    fetched = true;
    WAKE_EVENTS.forEach(function (name) {
      window.removeEventListener(name, fetchGtag, listenerOptions);
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  function whenIdle() {
    // The timeout matters: requestIdleCallback may never fire on its own in a
    // background tab, and a visit that is never in the foreground still counts.
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fetchGtag, { timeout: IDLE_TIMEOUT });
    } else {
      window.setTimeout(fetchGtag, FALLBACK_DELAY);
    }
  }

  /** Called by consent.js, and only when the visitor has accepted. */
  window.startAnalytics = function startAnalytics() {
    if (started) return;
    started = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    // Queue the pageview now; gtag.js will replay it when it loads.
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID);

    // Someone who scrolls or clicks is worth measuring straight away.
    WAKE_EVENTS.forEach(function (name) {
      window.addEventListener(name, fetchGtag, listenerOptions);
    });

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
  };
})();
