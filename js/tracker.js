/* ============================================
   EVALIS AI — ANALYTICS TRACKER v1.0
   Tracks: Page views, sessions, scroll depth,
   CTA clicks, referrers, device info
   ============================================ */

(function() {
  'use strict';

  const API = 'https://evalis-api.evalisglobal.workers.dev';
  const SESSION_KEY = 'evalis_session';
  const VISITOR_KEY = 'evalis_vid';

  // Generate unique IDs
  function uid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => ((Math.random()*16)|0).toString(16));
  }

  // Get or create visitor ID (persists across sessions)
  function getVisitorId() {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) { vid = uid(); localStorage.setItem(VISITOR_KEY, vid); }
    return vid;
  }

  // Get or create session ID (resets after 30 min inactivity)
  function getSessionId() {
    let s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    const now = Date.now();
    if (!s || (now - s.last) > 1800000) {
      s = { id: uid(), start: now, last: now, views: 0 };
    }
    s.last = now;
    s.views++;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }

  // Device & browser info
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'desktop';
    if (/Mobile|Android|iPhone/i.test(ua)) device = 'mobile';
    else if (/Tablet|iPad/i.test(ua)) device = 'tablet';

    let browser = 'other';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
    else if (ua.includes('Firefox')) browser = 'firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
    else if (ua.includes('Edg')) browser = 'edge';

    return { device, browser, screenW: screen.width, screenH: screen.height, lang: navigator.language };
  }

  // Track scroll depth
  let maxScroll = 0;
  function trackScroll() {
    const scrollPct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    if (scrollPct > maxScroll) maxScroll = Math.min(scrollPct, 100);
  }
  window.addEventListener('scroll', trackScroll, { passive: true });

  // Send tracking data
  async function sendTrack(eventType, data = {}) {
    try {
      const session = getSessionId();
      await fetch(`${API}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventType,
          visitor_id: getVisitorId(),
          session_id: session.id,
          page: window.location.pathname,
          referrer: document.referrer || 'direct',
          ...getDeviceInfo(),
          ...data,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) { /* silent fail */ }
  }

  // ── Track Page View ──
  sendTrack('pageview', { title: document.title });

  // ── Track CTA Clicks ──
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a, button');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const text = link.textContent.trim().substring(0, 50);
    const classes = link.className || '';

    // Track primary CTAs
    if (classes.includes('btn-primary') || classes.includes('btn-nav') ||
        href.includes('contact') || href.includes('wa.me') ||
        href.includes('careers') || text.includes('Start') || text.includes('Join')) {
      sendTrack('cta_click', { cta_text: text, cta_href: href });
    }
  });

  // ── Track Time on Page & Scroll Depth on Unload ──
  const pageStart = Date.now();
  function sendExitData() {
    const duration = Math.round((Date.now() - pageStart) / 1000);
    // Use sendBeacon for reliability on page exit
    const payload = JSON.stringify({
      event: 'page_exit',
      visitor_id: getVisitorId(),
      session_id: getSessionId().id,
      page: window.location.pathname,
      duration_seconds: duration,
      scroll_depth: maxScroll,
      timestamp: new Date().toISOString()
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API}/api/track`, payload);
    }
  }

  window.addEventListener('beforeunload', sendExitData);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendExitData();
  });

  // ── Track Form Submissions ──
  document.addEventListener('submit', (e) => {
    const form = e.target;
    sendTrack('form_submit', {
      form_action: form.action || 'unknown',
      form_page: window.location.pathname
    });
  });

  console.log('[Evalis Tracker] Active — visitor:', getVisitorId());

})();
