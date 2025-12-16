/**
 * Wicka Newsletter Subscription
 * Handles popup and footer subscription forms
 */

const NEWSLETTER_KEY = 'wicka_newsletter';
const POPUP_DELAY = 3000; // Show popup after 3 seconds
const POPUP_SCROLL_THRESHOLD = 0.4; // Or after scrolling 40% of page

// Check if user has already subscribed or dismissed popup
function hasInteracted() {
    try {
        const data = localStorage.getItem(NEWSLETTER_KEY);
        if (!data) return false;
        const parsed = JSON.parse(data);
        // If subscribed, never show again
        if (parsed.subscribed) return true;
        // If dismissed, check if it was more than 7 days ago
        if (parsed.dismissed) {
            const daysSince = (Date.now() - parsed.dismissed) / (1000 * 60 * 60 * 24);
            return daysSince < 7;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// Mark popup as dismissed
function dismissPopup() {
    try {
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify({
            dismissed: Date.now()
        }));
    } catch (e) {}
}

// Mark as subscribed
function markSubscribed() {
    try {
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify({
            subscribed: true
        }));
    } catch (e) {}
}

// Create and inject the popup HTML
function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'newsletter-popup';
    popup.className = 'fixed inset-0 z-[100] hidden items-center justify-center p-4';
    popup.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="newsletter-overlay"></div>
        <div class="relative rounded-2xl max-w-md w-full p-8 transform scale-95 opacity-0 transition-all duration-300" id="newsletter-modal" style="background-color: #d9e2ec;">
            <button id="newsletter-close" class="absolute top-4 right-4 transition-colors" style="color: #1e3a5f;" aria-label="Close">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>

            <div class="text-center mb-6">
                <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style="background-color: #bcccdc;">
                    <svg class="w-8 h-8" style="color: #1e3a5f;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                </div>
                <h3 class="font-serif text-2xl font-semibold mb-2" style="color: #1e3a5f;">Stay in the Loop</h3>
                <p class="text-sm" style="color: #334e68;">Get exclusive discounts, new arrivals & offers straight to your inbox.</p>
            </div>

            <form id="newsletter-popup-form" class="space-y-4">
                <div>
                    <input type="email" id="newsletter-popup-email" placeholder="Enter your email" required
                        class="w-full px-4 py-3 bg-white border border-black/20 rounded-lg text-black placeholder-black/50 focus:outline-none focus:border-black transition-colors">
                </div>
                <button type="submit" class="w-full text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2" style="background-color: #1e3a5f;">
                    <span>Subscribe</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                    </svg>
                </button>
                <p class="text-center text-xs" style="color: #486581;">No spam, unsubscribe anytime.</p>
            </form>

            <div id="newsletter-popup-success" class="hidden text-center">
                <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style="background-color: #bcccdc;">
                    <svg class="w-8 h-8" style="color: #1e3a5f;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <h3 class="font-serif text-2xl font-semibold mb-2" style="color: #1e3a5f;">You're In!</h3>
                <p style="color: #334e68;">Thanks for subscribing. Check your inbox for a welcome surprise.</p>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    return popup;
}

// Show the popup with animation
function showPopup() {
    const popup = document.getElementById('newsletter-popup');
    if (!popup) return;

    popup.classList.remove('hidden');
    popup.classList.add('flex');

    // Trigger animation
    requestAnimationFrame(() => {
        const modal = document.getElementById('newsletter-modal');
        modal.classList.remove('scale-95', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    });
}

// Hide the popup with animation
function hidePopup() {
    const popup = document.getElementById('newsletter-popup');
    const modal = document.getElementById('newsletter-modal');
    if (!popup || !modal) return;

    modal.classList.add('scale-95', 'opacity-0');
    modal.classList.remove('scale-100', 'opacity-100');

    setTimeout(() => {
        popup.classList.add('hidden');
        popup.classList.remove('flex');
    }, 300);
}

// Handle subscription
async function subscribe(email, formType) {
    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            markSubscribed();
            return { success: true, message: data.message };
        } else {
            return { success: false, message: data.error || 'Failed to subscribe' };
        }
    } catch (e) {
        console.error('Subscribe error:', e);
        return { success: false, message: 'Connection error. Please try again.' };
    }
}

// Initialize popup
function initPopup() {
    // Don't show popup on admin pages or cart
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('cart')) {
        return;
    }

    if (hasInteracted()) return;

    createPopup();

    let popupShown = false;

    // Show after delay
    const timeoutId = setTimeout(() => {
        if (!popupShown && !hasInteracted()) {
            popupShown = true;
            showPopup();
        }
    }, POPUP_DELAY);

    // Or show after scrolling
    const scrollHandler = () => {
        if (popupShown || hasInteracted()) return;

        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        if (scrollPercent > POPUP_SCROLL_THRESHOLD) {
            popupShown = true;
            clearTimeout(timeoutId);
            showPopup();
            window.removeEventListener('scroll', scrollHandler);
        }
    };
    window.addEventListener('scroll', scrollHandler);

    // Close handlers
    document.getElementById('newsletter-close')?.addEventListener('click', () => {
        dismissPopup();
        hidePopup();
    });

    document.getElementById('newsletter-overlay')?.addEventListener('click', () => {
        dismissPopup();
        hidePopup();
    });

    // Form handler
    document.getElementById('newsletter-popup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('newsletter-popup-email').value;
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
        btn.disabled = true;

        const result = await subscribe(email, 'popup');

        if (result.success) {
            document.getElementById('newsletter-popup-form').classList.add('hidden');
            document.getElementById('newsletter-popup-success').classList.remove('hidden');
            setTimeout(hidePopup, 3000);
        } else {
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert(result.message);
        }
    });
}

// Initialize footer form
function initFooterForm() {
    const form = document.getElementById('newsletter-footer-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('input[type="email"]');
        const btn = form.querySelector('button[type="submit"]');
        const message = document.getElementById('newsletter-footer-message');
        const email = emailInput.value;

        const originalText = btn.innerHTML;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
        btn.disabled = true;

        const result = await subscribe(email, 'footer');

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (message) {
            message.textContent = result.message;
            message.className = result.success
                ? 'text-sm mt-2 text-green-400'
                : 'text-sm mt-2 text-red-400';
            message.classList.remove('hidden');
        }

        if (result.success) {
            emailInput.value = '';
            setTimeout(() => {
                if (message) message.classList.add('hidden');
            }, 5000);
        }
    });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initPopup();
        initFooterForm();
    });
} else {
    initPopup();
    initFooterForm();
}
