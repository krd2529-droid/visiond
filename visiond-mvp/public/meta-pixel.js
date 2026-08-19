(function () {
  document.currentScript?.setAttribute("data-feature", "META-PIXEL-001");
  const PIXEL_ID = "37636461872667879";
  if (!window.fbq) {
    const fbq = (window.fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    });
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }
  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
  window.visiondPixel = {
    id: PIXEL_ID,
    track(eventName, parameters, options) {
      if (typeof window.fbq !== "function") return;
      const eventOptions =
        typeof options === "string" ? { eventID: options } : options;
      if (eventOptions && eventOptions.eventID) {
        window.fbq("track", eventName, parameters || {}, eventOptions);
        return;
      }
      window.fbq("track", eventName, parameters || {});
    },
  };
})();
