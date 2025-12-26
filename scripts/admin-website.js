/**
 * Admin Website Settings Page
 * Manage branding, colors, contact info, and more
 */

// Default settings
const defaultSettings = {
    companyName: 'Wicka',
    tagline: 'Style Meets Purpose',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#C4707A',
    secondaryColor: '#F5D0D5',
    contactEmail: 'wicka@protonmail.com',
    contactPhone: '',
    businessAddress: '',
    instagramUrl: 'https://instagram.com/fidget_street',
    tiktokUrl: 'https://tiktok.com/@fidget.street.official',
    facebookUrl: '',
    twitterUrl: '',
    defaultTitleSuffix: 'Wicka',
    defaultDescription: 'Style Meets Purpose by Wicka. Modern, aesthetic organisers and 3D-printed holders made by young designers.',
    ogImageUrl: '',
    freeShippingThreshold: 20,
    shippingCost: 3.49,
    currency: 'GBP',
    maxQuantity: 10,
    footerTagline: 'Style Meets Purpose made by young designers. Premium quality, affordable prices.',
    copyrightText: 'Wicka. All rights reserved.',
    footerNote: 'A Young Enterprise company'
};

const SETTINGS_KEY = 'wicka_website_settings';
const API_BASE = '/api';

// Get admin token
function getAdminToken() {
    return localStorage.getItem('admin_token');
}

// Load settings from API (with localStorage cache fallback)
async function loadSettings() {
    const token = getAdminToken();

    try {
        const response = await fetch(`${API_BASE}/admin-settings`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const settings = await response.json();
            // Cache in localStorage for faster subsequent loads
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return { ...defaultSettings, ...settings };
        }
    } catch (e) {
        console.error('Error fetching settings from API:', e);
    }

    // Fallback to localStorage cache
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : { ...defaultSettings };
    } catch (e) {
        console.error('Error loading settings from cache:', e);
        return { ...defaultSettings };
    }
}

// Save settings to API (and localStorage cache)
async function saveSettings(settings) {
    const token = getAdminToken();

    try {
        const response = await fetch(`${API_BASE}/admin-settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            // Update localStorage cache
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } else {
            const error = await response.json();
            console.error('API error:', error);
            return false;
        }
    } catch (e) {
        console.error('Error saving settings:', e);
        return false;
    }
}

// Reset settings via API
async function resetSettings() {
    const token = getAdminToken();

    try {
        const response = await fetch(`${API_BASE}/admin-settings`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Clear localStorage cache
            localStorage.removeItem(SETTINGS_KEY);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error resetting settings:', e);
        return false;
    }
}

// Populate form with settings
function populateForm(settings) {
    document.getElementById('company-name').value = settings.companyName || '';
    document.getElementById('tagline').value = settings.tagline || '';
    document.getElementById('logo-url').value = settings.logoUrl || '';
    document.getElementById('favicon-url').value = settings.faviconUrl || '';

    document.getElementById('primary-color').value = settings.primaryColor || '#C4707A';
    document.getElementById('primary-color-hex').value = settings.primaryColor || '#C4707A';
    document.getElementById('secondary-color').value = settings.secondaryColor || '#F5D0D5';
    document.getElementById('secondary-color-hex').value = settings.secondaryColor || '#F5D0D5';

    document.getElementById('contact-email').value = settings.contactEmail || '';
    document.getElementById('contact-phone').value = settings.contactPhone || '';
    document.getElementById('business-address').value = settings.businessAddress || '';

    document.getElementById('instagram-url').value = settings.instagramUrl || '';
    document.getElementById('tiktok-url').value = settings.tiktokUrl || '';
    document.getElementById('facebook-url').value = settings.facebookUrl || '';
    document.getElementById('twitter-url').value = settings.twitterUrl || '';

    document.getElementById('default-title-suffix').value = settings.defaultTitleSuffix || '';
    document.getElementById('default-description').value = settings.defaultDescription || '';
    document.getElementById('og-image-url').value = settings.ogImageUrl || '';

    document.getElementById('free-shipping-threshold').value = settings.freeShippingThreshold || 20;
    document.getElementById('shipping-cost').value = settings.shippingCost || 2.99;
    document.getElementById('currency').value = settings.currency || 'GBP';
    document.getElementById('max-quantity').value = settings.maxQuantity || 10;

    document.getElementById('footer-tagline').value = settings.footerTagline || '';
    document.getElementById('copyright-text').value = settings.copyrightText || '';
    document.getElementById('footer-note').value = settings.footerNote || '';

    // Update logo preview if custom
    if (settings.logoUrl) {
        document.getElementById('current-logo').src = settings.logoUrl;
    }
    if (settings.faviconUrl) {
        document.getElementById('current-favicon').src = settings.faviconUrl;
    }
    if (settings.ogImageUrl) {
        document.getElementById('og-image-preview').innerHTML = `<img src="${settings.ogImageUrl}" class="w-full h-full object-cover">`;
    }

    // Update color previews
    updateColorPreview();
}

// Get form values
function getFormValues() {
    return {
        companyName: document.getElementById('company-name').value,
        tagline: document.getElementById('tagline').value,
        logoUrl: document.getElementById('logo-url').value,
        faviconUrl: document.getElementById('favicon-url').value,
        primaryColor: document.getElementById('primary-color').value,
        secondaryColor: document.getElementById('secondary-color').value,
        contactEmail: document.getElementById('contact-email').value,
        contactPhone: document.getElementById('contact-phone').value,
        businessAddress: document.getElementById('business-address').value,
        instagramUrl: document.getElementById('instagram-url').value,
        tiktokUrl: document.getElementById('tiktok-url').value,
        facebookUrl: document.getElementById('facebook-url').value,
        twitterUrl: document.getElementById('twitter-url').value,
        defaultTitleSuffix: document.getElementById('default-title-suffix').value,
        defaultDescription: document.getElementById('default-description').value,
        ogImageUrl: document.getElementById('og-image-url').value,
        freeShippingThreshold: parseFloat(document.getElementById('free-shipping-threshold').value) || 20,
        shippingCost: parseFloat(document.getElementById('shipping-cost').value) || 2.99,
        currency: document.getElementById('currency').value,
        maxQuantity: parseInt(document.getElementById('max-quantity').value) || 10,
        footerTagline: document.getElementById('footer-tagline').value,
        copyrightText: document.getElementById('copyright-text').value,
        footerNote: document.getElementById('footer-note').value
    };
}

// Update color preview
function updateColorPreview() {
    const primary = document.getElementById('primary-color').value;
    const secondary = document.getElementById('secondary-color').value;

    document.getElementById('preview-btn-primary').style.backgroundColor = primary;
    document.getElementById('preview-link').style.color = primary;
    document.getElementById('preview-badge').style.backgroundColor = secondary;
}

// Show message
function showMessage(text, isError = false) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = `mb-6 p-4 rounded-lg ${isError ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`;
    msg.classList.remove('hidden');

    setTimeout(() => {
        msg.classList.add('hidden');
    }, 3000);
}

// Handle save
async function handleSave() {
    const saveBtn = document.getElementById('save-settings');
    const originalText = saveBtn.innerHTML;

    // Show loading state
    saveBtn.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Saving...</span>
    `;
    saveBtn.disabled = true;

    const settings = getFormValues();
    const success = await saveSettings(settings);

    // Restore button
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;

    if (success) {
        showMessage('Settings saved to database! Changes will appear site-wide shortly.');
        // Dispatch event for other tabs/windows
        window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
    } else {
        showMessage('Failed to save settings. Please check your connection and try again.', true);
    }
}

// Handle reset to defaults
async function handleReset() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will remove any custom logo, colors, and other customizations from the database.')) {
        return;
    }

    const resetBtn = document.getElementById('reset-defaults');
    const originalText = resetBtn.innerHTML;

    // Show loading state
    resetBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Resetting...</span>
    `;
    resetBtn.disabled = true;

    const success = await resetSettings();

    // Restore button
    resetBtn.innerHTML = originalText;
    resetBtn.disabled = false;

    if (success) {
        // Reset form to defaults
        populateForm(defaultSettings);

        // Reset logo preview - show placeholder if no logo set
        document.getElementById('current-logo').src = '';
        document.getElementById('current-favicon').src = '';
        document.getElementById('og-image-preview').innerHTML = `
            <svg class="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
        `;

        showMessage('Settings reset to defaults in database.');
    } else {
        showMessage('Failed to reset settings. Please try again.', true);
    }
}

// Resize image using Canvas API
function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        // SVG files don't need resizing
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                let { width, height } = img;

                // Calculate new dimensions maintaining aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Create canvas and resize
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to data URL (PNG for transparency support)
                const resizedDataUrl = canvas.toDataURL('image/png', 0.9);
                resolve(resizedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Handle file upload with automatic resizing
async function handleFileUpload(file, previewId, hiddenInputId) {
    // Size limits for different image types
    const sizeLimits = {
        'logo-url': { maxWidth: 250, maxHeight: 250 },
        'favicon-url': { maxWidth: 64, maxHeight: 64 },
        'og-image-url': { maxWidth: 1200, maxHeight: 630 }
    };

    const limits = sizeLimits[hiddenInputId] || { maxWidth: 800, maxHeight: 800 };

    try {
        showMessage('Processing image...', false);
        const resizedDataUrl = await resizeImage(file, limits.maxWidth, limits.maxHeight);

        document.getElementById(hiddenInputId).value = resizedDataUrl;

        if (previewId === 'og-image-preview') {
            document.getElementById(previewId).innerHTML = `<img src="${resizedDataUrl}" class="w-full h-full object-cover">`;
        } else {
            document.querySelector(`#${previewId} img`).src = resizedDataUrl;
        }

        showMessage(`Image uploaded and resized to max ${limits.maxWidth}x${limits.maxHeight}px`, false);
    } catch (error) {
        console.error('Error processing image:', error);
        showMessage('Failed to process image. Please try again.', true);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state
    showMessage('Loading settings...', false);

    // Load and populate settings from API
    const settings = await loadSettings();
    populateForm(settings);

    // Clear loading message
    document.getElementById('message').classList.add('hidden');

    // Color picker sync
    document.getElementById('primary-color').addEventListener('input', (e) => {
        document.getElementById('primary-color-hex').value = e.target.value;
        updateColorPreview();
    });
    document.getElementById('primary-color-hex').addEventListener('input', (e) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            document.getElementById('primary-color').value = e.target.value;
            updateColorPreview();
        }
    });
    document.getElementById('secondary-color').addEventListener('input', (e) => {
        document.getElementById('secondary-color-hex').value = e.target.value;
        updateColorPreview();
    });
    document.getElementById('secondary-color-hex').addEventListener('input', (e) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            document.getElementById('secondary-color').value = e.target.value;
            updateColorPreview();
        }
    });

    // Save buttons
    document.getElementById('save-settings').addEventListener('click', handleSave);
    document.getElementById('save-settings-mobile').addEventListener('click', handleSave);

    // Reset button
    document.getElementById('reset-defaults').addEventListener('click', handleReset);

    // File uploads
    document.getElementById('logo-upload-btn').addEventListener('click', () => {
        document.getElementById('logo-upload').click();
    });
    document.getElementById('logo-upload').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0], 'logo-preview', 'logo-url');
        }
    });

    document.getElementById('favicon-upload-btn').addEventListener('click', () => {
        document.getElementById('favicon-upload').click();
    });
    document.getElementById('favicon-upload').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0], 'favicon-preview', 'favicon-url');
        }
    });

    document.getElementById('og-image-upload-btn').addEventListener('click', () => {
        document.getElementById('og-image-upload').click();
    });
    document.getElementById('og-image-upload').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0], 'og-image-preview', 'og-image-url');
        }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        window.location.href = 'index.html';
    });
});
