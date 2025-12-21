/**
 * Wicka - Main JavaScript
 * Global functionality for navigation, search, and UI interactions
 */

// ============================================
// Security Helpers
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe string
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// Mobile Navigation
// ============================================
function initMobileNav() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
            mobileMenu.classList.toggle('hidden');

            // Update icon
            const icon = mobileMenuToggle.querySelector('svg');
            if (!isExpanded) {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
            } else {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>';
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// ============================================
// Search Modal
// ============================================
function initSearch() {
    const searchToggle = document.getElementById('search-toggle');
    const searchModal = document.getElementById('search-modal');
    const searchClose = document.getElementById('search-close');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchToggle || !searchModal) return;

    let products = [];

    // Load products for search (uses shared cached API)
    async function loadProducts() {
        try {
            products = await window.API.fetchProducts();
        } catch (error) {
            console.error('Error loading products for search:', error);
        }
    }

    // Delay search product loading to prioritize page content
    setTimeout(loadProducts, 100);

    function openSearch() {
        searchModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput.focus(), 100);
    }

    function closeSearch() {
        searchModal.classList.add('hidden');
        document.body.style.overflow = '';
        searchInput.value = '';
        searchResults.innerHTML = '';
    }

    searchToggle.addEventListener('click', openSearch);
    searchClose?.addEventListener('click', closeSearch);
    searchOverlay?.addEventListener('click', closeSearch);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
            closeSearch();
        }
    });

    // Search functionality
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.toLowerCase().trim();

        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(() => {
            const results = products.filter(product => {
                return product.title.toLowerCase().includes(query) ||
                       product.description.toLowerCase().includes(query) ||
                       product.tags.some(tag => tag.toLowerCase().includes(query));
            }).slice(0, 5);

            if (results.length === 0) {
                searchResults.innerHTML = `
                    <p class="text-gray-400 text-center py-8">No products found for "${escapeHtml(query)}"</p>
                `;
            } else {
                searchResults.innerHTML = results.map(product => `
                    <a href="product.html?slug=${encodeURIComponent(product.slug)}" class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800 transition-colors">
                        <div class="w-16 h-16 bg-gray-800 rounded-lg flex-shrink-0">
                            <!-- IMAGE_PLACEHOLDER: Search result thumbnail -->
                        </div>
                        <div>
                            <h4 class="font-medium">${escapeHtml(product.title)}</h4>
                            <p class="text-rose-gold text-sm">£${product.price_gbp.toFixed(2)}</p>
                        </div>
                    </a>
                `).join('');
            }
        }, 300);
    });
}

// ============================================
// Scroll Effects
// ============================================
function initScrollEffects() {
    const nav = document.querySelector('nav');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav?.classList.add('shadow-lg');
        } else {
            nav?.classList.remove('shadow-lg');
        }
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

// ============================================
// Product Card Component
// ============================================
function createProductCard(product) {
    const stockBadge = getStockBadge(product.stock);
    const tagBadges = getTagBadges(product.tags);
    const safeTitle = escapeHtml(product.title);
    const safeSlug = encodeURIComponent(product.slug);
    const isWishlisted = typeof isInWishlist === 'function' && isInWishlist(product.id);

    const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;
    const imageHtml = imageUrl
        ? `<img src="${imageUrl}" alt="${safeTitle}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async">`
        : `<div class="w-full h-full bg-gradient-to-br from-navy-100 to-navy-200 group-hover:scale-105 transition-transform duration-500"></div>`;

    return `
        <article class="product-card group">
            <!-- Image container with heart button outside the link -->
            <div class="relative mb-4">
                <a href="product.html?slug=${safeSlug}" class="block">
                    <div class="aspect-square overflow-hidden rounded-lg bg-navy-100">
                        ${imageHtml}
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                    </div>
                </a>
                <!-- Badges on top left -->
                <div class="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
                    ${stockBadge}
                    ${tagBadges}
                </div>
                <!-- Wishlist Heart Icon on top right - OUTSIDE the link -->
                <button
                    type="button"
                    class="wishlist-heart absolute top-3 right-3 z-20 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all hover:scale-110"
                    data-product-id="${product.id}"
                    data-product-title="${safeTitle}"
                    data-product-price="${product.price_gbp}"
                    data-product-slug="${safeSlug}"
                    data-product-image="${imageUrl || ''}"
                    aria-label="Add to wishlist"
                >
                    <svg class="w-5 h-5 heart-icon" viewBox="0 0 24 24" fill="${isWishlisted ? '#ec4899' : 'none'}" stroke="${isWishlisted ? '#ec4899' : '#6b7280'}" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </button>
            </div>
            <a href="product.html?slug=${safeSlug}" class="block">
                <h3 class="font-medium text-navy group-hover:text-rose-gold transition-colors mb-1">${safeTitle}</h3>
                <p class="text-rose-gold font-medium">£${product.price_gbp.toFixed(2)}</p>
            </a>
            <div class="flex flex-col gap-2 mt-3">
                <a
                    href="product.html?slug=${safeSlug}"
                    class="view-details-btn w-full py-2 text-sm border border-navy/20 rounded-lg hover:bg-navy hover:border-navy hover:text-white transition-colors block text-center text-navy"
                >
                    View Details
                </a>
                <button
                    class="add-to-cart-quick w-full py-2 text-sm border rounded-lg transition-colors flex items-center justify-center gap-2 text-white hover:opacity-90"
                    style="background-color: #71c7e1; border-color: #71c7e1;"
                    data-product-id="${product.id}"
                    data-product-title="${safeTitle}"
                    data-product-price="${product.price_gbp}"
                    ${product.stock === 0 ? 'disabled style="background-color: #9ca3af; border-color: #9ca3af;"' : ''}
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                    ${product.stock === 0 ? 'Sold Out' : 'Add to Cart'}
                </button>
            </div>
        </article>
    `;
}

function getStockBadge(stock) {
    if (stock === 0) {
        return '<span class="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">Sold Out</span>';
    }
    if (stock <= 5) {
        return `<span class="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-medium">Only ${stock} left</span>`;
    }
    return '';
}

function getTagBadges(tags) {
    let badges = '';
    if (tags.includes('new')) {
        badges += '<span class="bg-rose-gold text-white px-2 py-1 rounded-full text-xs font-medium">New</span>';
    } else if (tags.includes('bestseller')) {
        badges += '<span class="bg-pastel-pink text-black px-2 py-1 rounded-full text-xs font-medium">Bestseller</span>';
    }
    return badges;
}

// ============================================
// Quick Add to Cart
// ============================================
function initQuickAdd() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cart-quick');
        if (btn && !btn.disabled) {
            e.preventDefault();
            e.stopPropagation();

            const productId = parseInt(btn.dataset.productId);
            const title = btn.dataset.productTitle;
            const price = parseFloat(btn.dataset.productPrice);

            const cartItem = {
                id: productId,
                title: title,
                price: price,
                quantity: 1,
                variation: null,
                image: ''
            };

            if (typeof addToCart === 'function') {
                addToCart(cartItem);

                // Animate button with checkmark feedback
                if (typeof animateCartButton === 'function') {
                    animateCartButton(btn);
                }
            }
        }
    });
}

// ============================================
// Smooth Scroll for Anchor Links
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// Accessibility Helpers
// ============================================
function initAccessibility() {
    // Skip link functionality
    const skipLink = document.querySelector('[href="#main-content"]');
    skipLink?.addEventListener('click', (e) => {
        const main = document.getElementById('main-content');
        if (main) {
            main.setAttribute('tabindex', '-1');
            main.focus();
        }
    });

    // Focus trap for modals
    document.querySelectorAll('[role="dialog"]').forEach(modal => {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    });
}

// ============================================
// Service Worker - COMPLETELY DISABLED
// ============================================
function initServiceWorker() {
    // Do nothing - service workers disabled
}

// ============================================
// Initialize All
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initSearch();
    initScrollEffects();
    initQuickAdd();
    initSmoothScroll();
    initAccessibility();
    initServiceWorker();
});

// Make functions globally available
window.createProductCard = createProductCard;
window.escapeHtml = escapeHtml;
