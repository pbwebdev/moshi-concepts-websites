/*
  Google Analytics 4, deliberately loaded late.

  Google's own snippet puts an async tag in the head and configures it from an
  inline <script>. Two problems here. The inline block would force
  'unsafe-inline' into the script-src policy, which would also re-open the door
  to every injected script. And gtag.js is a large file that runs on the main
  thread, so fetching it during page load competes with the hero image for
  bandwidth and adds work inside the window Lighthouse scores.

  So the configuration lives here, same-origin, and Google's script is fetched
  only once the page has loaded and the browser is idle, or the moment the
  visitor interacts, whichever comes first. The pageview is still recorded,
  because gtag.js drains anything already queued on dataLayer when it arrives.
  It is simply sent a moment later than it would have been.
*/
(function () {
  var MEASUREMENT_ID = "G-L82FEFSKJE";
  var IDLE_TIMEOUT = 3000;
  var FALLBACK_DELAY = 2000;
  var WAKE_EVENTS = ["pointerdown", "keydown", "scroll"];
  var listenerOptions = { once: true, passive: true, capture: true };
  var started = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Queue the pageview now. gtag.js replays the queue when it loads, so
  // nothing is lost by sending the script for later.
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  function start() {
    if (started) return;
    started = true;
    WAKE_EVENTS.forEach(function (name) {
      window.removeEventListener(name, start, listenerOptions);
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  // Someone who scrolls or clicks is worth measuring straight away.
  WAKE_EVENTS.forEach(function (name) {
    window.addEventListener(name, start, listenerOptions);
  });

  function whenIdle() {
    // The timeout matters: requestIdleCallback may never fire on its own in a
    // background tab, and a visit that is never in the foreground still counts.
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT });
    } else {
      window.setTimeout(start, FALLBACK_DELAY);
    }
  }

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
})();
