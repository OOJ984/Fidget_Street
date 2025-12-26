/**
 * Lightweight Page View Analytics
 * Tracks page views without cookies or personal data
 */

(function() {
    // Don't track in admin pages or localhost dev
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return;

    // Get or create session ID (persists for browser session only)
    let sessionId = sessionStorage.getItem('fs_session');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('fs_session', sessionId);
    }

    // Send page view after DOM ready
    function trackPageView() {
        const data = {
            path: path,
            title: document.title,
            referrer: document.referrer || null,
            sessionId: sessionId
        };

        // Use sendBeacon for reliable tracking (doesn't block page)
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/.netlify/functions/track', JSON.stringify(data));
        } else {
            // Fallback for older browsers
            fetch('/.netlify/functions/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                keepalive: true
            }).catch(() => {}); // Silently fail
        }
    }

    // Track on page load
    if (document.readyState === 'complete') {
        trackPageView();
    } else {
        window.addEventListener('load', trackPageView);
    }
})();
