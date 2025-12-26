/**
 * Fidget Street - Website Settings Loader
 * Loads and applies custom website settings
 *
 * Strategy: Cache with background refresh
 * 1. Load from localStorage cache immediately (fast first paint)
 * 2. Apply settings to page
 * 3. Fetch from API in background
 * 4. If settings changed, update cache and re-apply
 */

const SETTINGS_KEY = 'fidgetstreet_website_settings';
const SETTINGS_TIMESTAMP_KEY = 'fidgetstreet_website_settings_ts';
const CACHE_MAX_AGE = 0; // Always fetch fresh - settings can change anytime

// Default settings (fallback values)
const defaultSettings = {
    companyName: 'Fidget Street',
    tagline: 'Everyday Satisfaction',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#71c7e1',
    secondaryColor: '#A8E0A2',
    contactEmail: 'hello@fidgetstreet.co.uk',
    contactPhone: '',
    businessAddress: '',
    instagramUrl: 'https://www.instagram.com/fidget_street/',
    facebookUrl: '',
    twitterUrl: '',
    defaultTitleSuffix: 'Fidget Street',
    defaultDescription: 'Eco-friendly fidget toys for focus, fun, and stress relief. Safe for ages 6+. Made from plant-based PLA plastic.',
    ogImageUrl: '',
    freeShippingThreshold: 30,
    shippingCost: 3.49,
    currency: 'GBP',
    maxQuantity: 10,
    footerTagline: 'Everyday Satisfaction - Eco-friendly fidget toys for all ages.',
    copyrightText: 'Fidget Street. All rights reserved.',
    footerNote: ''
};

/**
 * Load settings from localStorage cache
 * @returns {Object} Settings object with defaults applied
 */
function loadFromCache() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : { ...defaultSettings };
    } catch (e) {
        console.warn('Error loading website settings from cache:', e);
        return { ...defaultSettings };
    }
}

/**
 * Save settings to localStorage cache
 */
function saveToCache(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        localStorage.setItem(SETTINGS_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
        console.warn('Error saving settings to cache:', e);
    }
}

/**
 * Check if cache is stale
 */
function isCacheStale() {
    try {
        const timestamp = localStorage.getItem(SETTINGS_TIMESTAMP_KEY);
        if (!timestamp) return true;
        return (Date.now() - parseInt(timestamp, 10)) > CACHE_MAX_AGE;
    } catch (e) {
        return true;
    }
}

/**
 * Fetch settings from API
 */
async function fetchFromAPI() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn('Error fetching settings from API:', e);
    }
    return null;
}

/**
 * Check if two settings objects are different
 */
function settingsChanged(oldSettings, newSettings) {
    // Compare key fields that affect visual display
    const keys = ['primaryColor', 'secondaryColor', 'logoUrl', 'faviconUrl', 'companyName',
                  'footerTagline', 'copyrightText', 'footerNote', 'freeShippingThreshold', 'shippingCost'];
    return keys.some(key => oldSettings[key] !== newSettings[key]);
}

/**
 * Load settings (from cache first, then API in background)
 * @returns {Object} Settings object
 */
function loadWebsiteSettings() {
    return loadFromCache();
}

/**
 * Apply settings to the current page
 * @param {Object} settings - Settings to apply (optional, loads from cache if not provided)
 */
function applyWebsiteSettings(settings) {
    if (!settings) {
        settings = loadFromCache();
    }

    // Apply custom colors via CSS custom properties
    applyColors(settings);

    // Apply custom logo if set
    applyLogo(settings);

    // Apply custom favicon if set
    applyFavicon(settings);

    // Apply company name
    applyCompanyName(settings);

    // Apply footer content
    applyFooterContent(settings);

    // Make settings available globally
    window.websiteSettings = settings;

    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('settingsLoaded', { detail: settings }));
}

/**
 * Background refresh - fetch from API and update if changed
 */
async function refreshSettingsInBackground() {
    // Don't refresh if cache is fresh
    if (!isCacheStale()) {
        return;
    }

    const currentSettings = loadFromCache();
    const newSettings = await fetchFromAPI();

    if (newSettings) {
        // Save to cache
        saveToCache(newSettings);

        // If settings changed, re-apply
        if (settingsChanged(currentSettings, newSettings)) {
            applyWebsiteSettings({ ...defaultSettings, ...newSettings });
        }
    }
}

/**
 * Apply custom colors via CSS variables
 */
function applyColors(settings) {
    const root = document.documentElement;

    // Only apply if different from default
    if (settings.primaryColor && settings.primaryColor !== '#71c7e1') {
        // Set CSS custom property for primary color
        root.style.setProperty('--color-soft-blue', settings.primaryColor);

        // Create a style element for Tailwind color overrides
        const styleId = 'custom-colors';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        // Generate lighter/darker variants
        const hsl = hexToHSL(settings.primaryColor);
        const variants = generateColorVariants(hsl);

        styleEl.textContent = `
            /* Custom Primary Color Overrides */
            .text-soft-blue { color: ${settings.primaryColor} !important; }
            .bg-soft-blue { background-color: ${settings.primaryColor} !important; }
            .border-soft-blue { border-color: ${settings.primaryColor} !important; }
            .hover\\:text-soft-blue:hover { color: ${settings.primaryColor} !important; }
            .hover\\:bg-soft-blue:hover { background-color: ${settings.primaryColor} !important; }
            .hover\\:border-soft-blue:hover { border-color: ${settings.primaryColor} !important; }
            .focus\\:border-soft-blue:focus { border-color: ${settings.primaryColor} !important; }
            .focus\\:ring-soft-blue:focus { --tw-ring-color: ${settings.primaryColor} !important; }
            .btn-primary { background-color: ${settings.primaryColor} !important; }
            .btn-primary:hover { background-color: ${variants.light} !important; }
            ::selection { background-color: ${settings.primaryColor} !important; }
            ${settings.secondaryColor ? `
            .bg-pastel-pink { background-color: ${settings.secondaryColor} !important; }
            .text-pastel-pink { color: ${settings.secondaryColor} !important; }
            ` : ''}
        `;
    }
}

/**
 * Apply custom logo
 */
function applyLogo(settings) {
    if (settings.logoUrl) {
        // Find the site logo
        const logos = document.querySelectorAll('img[alt="Fidget Street Logo"]');
        logos.forEach(logo => {
            logo.src = settings.logoUrl;
        });
    }
}

/**
 * Apply custom favicon
 */
function applyFavicon(settings) {
    if (settings.faviconUrl) {
        // Find or create favicon link
        let favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
            favicon.href = settings.faviconUrl;
        }

        // Also update apple-touch-icon if present
        let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleTouchIcon) {
            appleTouchIcon.href = settings.faviconUrl;
        }
    }
}

/**
 * Apply company name where appropriate
 */
function applyCompanyName(settings) {
    if (settings.companyName && settings.companyName !== 'Fidget Street') {
        // Update any company name displays (be careful not to break existing content)
        // This is intentionally conservative to avoid breaking the design
        // Future: Update title tags and meta descriptions dynamically
    }
}

/**
 * Apply footer content
 */
function applyFooterContent(settings) {
    // Update copyright year automatically
    const year = new Date().getFullYear();

    // Footer tagline
    const footerTagline = document.querySelector('footer p.text-gray-400');
    if (footerTagline && settings.footerTagline) {
        footerTagline.textContent = settings.footerTagline;
    }

    // Copyright text
    const copyrightEl = document.querySelector('footer .text-gray-500');
    if (copyrightEl && settings.copyrightText) {
        copyrightEl.textContent = `© ${year} ${settings.copyrightText}`;
    }

    // Footer note
    const footerNote = document.querySelectorAll('footer .text-gray-500')[1];
    if (footerNote && settings.footerNote) {
        footerNote.textContent = settings.footerNote;
    }
}

/**
 * Convert hex color to HSL
 */
function hexToHSL(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex
 */
function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate color variants (lighter, darker)
 */
function generateColorVariants(hsl) {
    return {
        light: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 10, 90)),
        dark: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 10, 10)),
        lighter: hslToHex(hsl.h, hsl.s * 0.5, Math.min(hsl.l + 30, 95)),
    };
}

/**
 * Get shipping threshold from settings
 */
function getFreeShippingThreshold() {
    const settings = loadFromCache();
    return settings.freeShippingThreshold || 20;
}

/**
 * Get shipping cost from settings
 */
function getShippingCost() {
    const settings = loadFromCache();
    return settings.shippingCost || 2.99;
}

/**
 * Get max quantity per item
 */
function getMaxQuantity() {
    const settings = loadFromCache();
    return settings.maxQuantity || 10;
}

/**
 * Get currency symbol
 */
function getCurrencySymbol() {
    const settings = loadFromCache();
    const symbols = { GBP: '£', USD: '$', EUR: '€' };
    return symbols[settings.currency] || '£';
}

// Auto-apply settings when DOM is ready
async function initSettings() {
    const hasCache = localStorage.getItem(SETTINGS_KEY) !== null;

    if (hasCache) {
        // Cache exists - apply immediately, refresh in background
        applyWebsiteSettings();
        refreshSettingsInBackground();
    } else {
        // No cache - fetch from API first to avoid flash of default content
        const apiSettings = await fetchFromAPI();
        if (apiSettings) {
            saveToCache(apiSettings);
            applyWebsiteSettings({ ...defaultSettings, ...apiSettings });
        } else {
            // API failed, use defaults
            applyWebsiteSettings();
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettings);
} else {
    initSettings();
}

// Export functions globally
window.loadWebsiteSettings = loadWebsiteSettings;
window.applyWebsiteSettings = applyWebsiteSettings;
window.refreshSettingsInBackground = refreshSettingsInBackground;
window.getFreeShippingThreshold = getFreeShippingThreshold;
window.getShippingCost = getShippingCost;
window.getMaxQuantity = getMaxQuantity;
window.getCurrencySymbol = getCurrencySymbol;
