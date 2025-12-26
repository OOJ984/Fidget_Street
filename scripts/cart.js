/**
 * Fidget Street - Cart JavaScript
 * Client-side cart functionality using localStorage
 */

const CART_STORAGE_KEY = 'fidgetstreet_cart';

// ============================================
// Toast Notification System
// ============================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
        transform translate-x-full opacity-0 transition-all duration-300
        ${type === 'success' ? 'bg-green-600 text-white' : ''}
        ${type === 'error' ? 'bg-red-600 text-white' : ''}
        ${type === 'info' ? 'bg-gray-800 text-white border border-white/20' : ''}
    `.replace(/\s+/g, ' ').trim();

    // Icon based on type
    const icons = {
        success: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        info: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };

    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span class="text-sm font-medium">${escapeHtmlCart(message)}</span>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// Security Helpers
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe string
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtmlCart(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// Cart Core Functions
// ============================================

/**
 * Get cart from localStorage
 * @returns {Array} Cart items array
 */
function getCart() {
    try {
        const cart = localStorage.getItem(CART_STORAGE_KEY);
        return cart ? JSON.parse(cart) : [];
    } catch (error) {
        console.error('Error reading cart:', error);
        return [];
    }
}

/**
 * Save cart to localStorage
 * @param {Array} cart - Cart items array
 */
function saveCart(cart) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        updateCartCount();
    } catch (error) {
        console.error('Error saving cart:', error);
    }
}

/**
 * Add item to cart
 * @param {Object} item - Product object with id, title, price, quantity, variation, image
 */
function addToCart(item) {
    const cart = getCart();

    // Check if item already exists (same id and variation)
    const existingIndex = cart.findIndex(
        cartItem => cartItem.id === item.id && cartItem.variation === item.variation
    );

    if (existingIndex > -1) {
        // Update quantity
        cart[existingIndex].quantity += item.quantity;
        // Cap at 10 items
        cart[existingIndex].quantity = Math.min(cart[existingIndex].quantity, 10);
    } else {
        // Add new item
        cart.push({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            variation: item.variation || null,
            image: item.image || ''
        });
    }

    saveCart(cart);
    updateCartSidebar();

    // Show toast notification
    showToast(`${item.title} added to cart`, 'success');

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));

    return cart;
}

/**
 * Remove item from cart
 * @param {number} productId - Product ID to remove
 * @param {string} variation - Optional variation to match
 */
function removeFromCart(productId, variation = null) {
    let cart = getCart();

    // Find item before removing for toast message
    const removedItem = cart.find(item => {
        if (variation) {
            return item.id === productId && item.variation === variation;
        }
        return item.id === productId;
    });

    cart = cart.filter(item => {
        if (variation) {
            return !(item.id === productId && item.variation === variation);
        }
        return item.id !== productId;
    });

    saveCart(cart);
    updateCartSidebar();

    // Show toast notification
    if (removedItem) {
        showToast(`${removedItem.title} removed from cart`, 'info');
    }

    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));

    return cart;
}

/**
 * Update item quantity in cart
 * @param {number} productId - Product ID
 * @param {number} quantity - New quantity
 * @param {string} variation - Optional variation to match
 */
function updateCartItemQuantity(productId, quantity, variation = null) {
    const cart = getCart();

    const itemIndex = cart.findIndex(item => {
        if (variation) {
            return item.id === productId && item.variation === variation;
        }
        return item.id === productId;
    });

    if (itemIndex > -1) {
        if (quantity <= 0) {
            cart.splice(itemIndex, 1);
        } else {
            cart[itemIndex].quantity = Math.min(quantity, 10);
        }
    }

    saveCart(cart);
    updateCartSidebar();

    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));

    return cart;
}

/**
 * Clear entire cart
 */
function clearCart() {
    localStorage.removeItem(CART_STORAGE_KEY);
    updateCartCount();
    updateCartSidebar();

    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: [] } }));
}

/**
 * Get cart totals
 * @returns {Object} Object with itemCount, subtotal, shipping, total
 */
function getCartTotals() {
    const cart = getCart();

    // Get shipping settings from website settings (if available)
    const freeShippingThreshold = typeof getFreeShippingThreshold === 'function'
        ? getFreeShippingThreshold()
        : 25;
    const shippingCost = typeof getShippingCost === 'function'
        ? getShippingCost()
        : 3.49;

    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCost;
    const total = subtotal + shipping;

    return {
        itemCount,
        subtotal,
        shipping,
        total,
        freeShippingThreshold
    };
}

// ============================================
// Discount Code Functions
// ============================================

const DISCOUNT_STORAGE_KEY = 'fidgetstreet_discount';
const GIFT_CARD_STORAGE_KEY = 'fidgetstreet_giftcard';

/**
 * Get applied discount from localStorage
 * @returns {Object|null} Discount object or null
 */
function getAppliedDiscount() {
    try {
        const discount = localStorage.getItem(DISCOUNT_STORAGE_KEY);
        return discount ? JSON.parse(discount) : null;
    } catch (error) {
        console.error('Error reading discount:', error);
        return null;
    }
}

/**
 * Save discount to localStorage
 * @param {Object} discount - Discount object with code, type, value, amount
 */
function setAppliedDiscount(discount) {
    try {
        if (discount) {
            localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(discount));
        } else {
            localStorage.removeItem(DISCOUNT_STORAGE_KEY);
        }
        window.dispatchEvent(new CustomEvent('discountUpdated', { detail: { discount } }));
    } catch (error) {
        console.error('Error saving discount:', error);
    }
}

/**
 * Clear applied discount
 */
function clearDiscount() {
    localStorage.removeItem(DISCOUNT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('discountUpdated', { detail: { discount: null } }));
}

/**
 * Get cart totals including discount
 * @returns {Object} Object with itemCount, subtotal, discount, shipping, total
 */
function getCartTotalsWithDiscount() {
    const baseTotals = getCartTotals();
    const discount = getAppliedDiscount();

    let discountAmount = 0;
    let isFreeDelivery = false;

    if (discount) {
        if (discount.discount_type === 'percentage') {
            discountAmount = (baseTotals.subtotal * discount.discount_value) / 100;
        } else if (discount.discount_type === 'fixed') {
            discountAmount = discount.discount_value;
        } else if (discount.discount_type === 'free_delivery') {
            isFreeDelivery = true;
            // No price discount for free_delivery, just free shipping
        }

        // Ensure discount doesn't exceed subtotal (not applicable for free_delivery)
        if (discount.discount_type !== 'free_delivery') {
            discountAmount = Math.min(discountAmount, baseTotals.subtotal);
        }
        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;
    }

    const discountedSubtotal = baseTotals.subtotal - discountAmount;
    // For free_delivery discount, shipping is always 0
    const shipping = isFreeDelivery ? 0 : (discountedSubtotal >= baseTotals.freeShippingThreshold ? 0 : baseTotals.shipping);
    const total = discountedSubtotal + shipping;

    return {
        ...baseTotals,
        discountCode: discount?.code || null,
        discountType: discount?.discount_type || null,
        discountValue: discount?.discount_value || 0,
        discountAmount,
        total: Math.max(0, total)
    };
}

// ============================================
// Gift Card Functions
// ============================================

/**
 * Get applied gift card from localStorage
 * @returns {Object|null} Gift card object or null
 */
function getAppliedGiftCard() {
    try {
        const giftCard = localStorage.getItem(GIFT_CARD_STORAGE_KEY);
        return giftCard ? JSON.parse(giftCard) : null;
    } catch (error) {
        console.error('Error reading gift card:', error);
        return null;
    }
}

/**
 * Save gift card to localStorage
 * @param {Object} giftCard - Gift card object with code, balance, applicable_amount, etc.
 */
function setAppliedGiftCard(giftCard) {
    try {
        if (giftCard) {
            localStorage.setItem(GIFT_CARD_STORAGE_KEY, JSON.stringify(giftCard));
        } else {
            localStorage.removeItem(GIFT_CARD_STORAGE_KEY);
        }
        window.dispatchEvent(new CustomEvent('giftCardUpdated', { detail: { giftCard } }));
    } catch (error) {
        console.error('Error saving gift card:', error);
    }
}

/**
 * Clear applied gift card
 */
function clearGiftCard() {
    localStorage.removeItem(GIFT_CARD_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('giftCardUpdated', { detail: { giftCard: null } }));
}

/**
 * Get cart totals including discount AND gift card
 * @returns {Object} Object with all totals and applied codes
 */
function getCartTotalsWithGiftCard() {
    const totals = getCartTotalsWithDiscount();
    const giftCard = getAppliedGiftCard();

    if (!giftCard) {
        return {
            ...totals,
            giftCardCode: null,
            giftCardBalance: 0,
            giftCardAmount: 0,
            giftCardRemainingAfterUse: 0,
            coversFullOrder: false
        };
    }

    // Calculate how much of the gift card to use
    const orderTotal = totals.total;
    const giftCardBalance = parseFloat(giftCard.balance) || 0;
    const giftCardAmount = Math.min(giftCardBalance, orderTotal);
    const remainingAfterUse = Math.round((giftCardBalance - giftCardAmount) * 100) / 100;
    const finalTotal = Math.max(0, orderTotal - giftCardAmount);
    const coversFullOrder = giftCardBalance >= orderTotal;

    return {
        ...totals,
        giftCardCode: giftCard.code,
        giftCardBalance: giftCardBalance,
        giftCardAmount: Math.round(giftCardAmount * 100) / 100,
        giftCardRemainingAfterUse: remainingAfterUse,
        coversFullOrder: coversFullOrder,
        total: Math.round(finalTotal * 100) / 100
    };
}

// ============================================
// UI Update Functions
// ============================================

/**
 * Update cart count badge in navigation
 */
function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Desktop cart count
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        if (count > 0) {
            cartCountEl.textContent = count > 99 ? '99+' : count;
            cartCountEl.classList.remove('hidden');
        } else {
            cartCountEl.classList.add('hidden');
        }
    }

    // Mobile cart count
    const mobileCartCount = document.getElementById('mobile-cart-count');
    if (mobileCartCount) {
        mobileCartCount.textContent = count;
    }
}

/**
 * Update cart sidebar contents
 */
function updateCartSidebar() {
    const cartItems = document.getElementById('cart-items');
    const cartSubtotal = document.getElementById('cart-subtotal');

    if (!cartItems) return;

    const cart = getCart();
    const totals = getCartTotals();

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
                <p class="text-gray-500">Your cart is empty</p>
                <a href="products.html" class="hover:underline text-sm mt-2 inline-block" style="color: #71c7e1;">Start Shopping</a>
            </div>
        `;
    } else {
        cartItems.innerHTML = cart.map(item => {
            const safeTitle = escapeHtmlCart(item.title);
            const safeVariation = escapeHtmlCart(item.variation);
            const imageHtml = item.image
                ? `<img src="${item.image}" alt="${safeTitle}" class="w-full h-full object-cover">`
                : '<div class="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200"></div>';
            return `
            <div class="flex gap-4 pb-4 border-b border-gray-200" data-item-id="${item.id}">
                <div class="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    ${imageHtml}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-sm truncate text-gray-800">${safeTitle}</h4>
                    ${item.variation ? `<p class="text-xs text-gray-500">${safeVariation}</p>` : ''}
                    <p class="text-sm mt-1" style="color: #71c7e1;">£${item.price.toFixed(2)}</p>
                    <div class="flex items-center justify-between mt-2">
                        <div class="flex items-center space-x-2">
                            <button class="cart-qty-btn w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors" data-action="decrease" data-id="${item.id}">−</button>
                            <span class="text-sm text-gray-800">${item.quantity}</span>
                            <button class="cart-qty-btn w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors" data-action="increase" data-id="${item.id}">+</button>
                        </div>
                        <button class="text-red-500 hover:text-red-600 text-xs cart-remove-btn" data-id="${item.id}">Remove</button>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    if (cartSubtotal) {
        cartSubtotal.textContent = `£${totals.subtotal.toFixed(2)}`;
    }
}

// ============================================
// Cart Sidebar Toggle
// ============================================

function initCartSidebar() {
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartClose = document.getElementById('cart-close');
    const cartToggle = document.getElementById('cart-toggle');

    if (!cartSidebar) return;

    function openCart() {
        cartSidebar.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            cartPanel?.classList.remove('translate-x-full');
        }, 10);
        updateCartSidebar();
    }

    function closeCart() {
        cartPanel?.classList.add('translate-x-full');
        setTimeout(() => {
            cartSidebar.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }

    // Open cart on toggle button click
    cartToggle?.addEventListener('click', openCart);

    // Open cart on custom event
    window.addEventListener('openCart', openCart);

    // Close cart
    cartClose?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);

    // Handle quantity and remove buttons in sidebar
    cartSidebar.addEventListener('click', (e) => {
        const qtyBtn = e.target.closest('.cart-qty-btn');
        const removeBtn = e.target.closest('.cart-remove-btn');

        if (qtyBtn) {
            const action = qtyBtn.dataset.action;
            const id = parseInt(qtyBtn.dataset.id);
            const cart = getCart();
            const item = cart.find(i => i.id === id);

            if (item) {
                if (action === 'increase') {
                    updateCartItemQuantity(id, item.quantity + 1, item.variation);
                } else if (action === 'decrease') {
                    if (item.quantity === 1) {
                        removeFromCart(id, item.variation);
                    } else {
                        updateCartItemQuantity(id, item.quantity - 1, item.variation);
                    }
                }
            }
        }

        if (removeBtn) {
            const id = parseInt(removeBtn.dataset.id);
            removeFromCart(id);
        }
    });

    // Escape key closes cart
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !cartSidebar.classList.contains('hidden')) {
            closeCart();
        }
    });
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    updateCartSidebar();
    initCartSidebar();
});

// ============================================
// Button Animation
// ============================================

/**
 * Animate a button with success feedback
 * @param {HTMLElement} button - Button element to animate
 */
function animateCartButton(button) {
    if (!button) return;

    // Store original content
    const originalHTML = button.innerHTML;
    const originalDisabled = button.disabled;

    // Add animation class
    button.classList.add('animate-cart-success');

    // Show checkmark icon briefly
    button.innerHTML = `
        <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
    `;
    button.disabled = true;

    // Restore after animation
    setTimeout(() => {
        button.classList.remove('animate-cart-success');
        button.innerHTML = originalHTML;
        button.disabled = originalDisabled;
    }, 600);
}

// Make functions globally available
window.getCart = getCart;
window.saveCart = saveCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.clearCart = clearCart;
window.getCartTotals = getCartTotals;
window.updateCartCount = updateCartCount;
window.showToast = showToast;
window.animateCartButton = animateCartButton;
window.getAppliedDiscount = getAppliedDiscount;
window.setAppliedDiscount = setAppliedDiscount;
window.clearDiscount = clearDiscount;
window.getCartTotalsWithDiscount = getCartTotalsWithDiscount;
window.getAppliedGiftCard = getAppliedGiftCard;
window.setAppliedGiftCard = setAppliedGiftCard;
window.clearGiftCard = clearGiftCard;
window.getCartTotalsWithGiftCard = getCartTotalsWithGiftCard;
