/**
 * Wishlist Functionality
 * Handles wishlist storage, display, and interactions
 */

const WISHLIST_KEY = 'fidgetstreet_wishlist';

// ============================================
// Wishlist Storage
// ============================================

function getWishlist() {
    try {
        const wishlist = localStorage.getItem(WISHLIST_KEY);
        return wishlist ? JSON.parse(wishlist) : [];
    } catch (e) {
        console.error('Error reading wishlist:', e);
        return [];
    }
}

function saveWishlist(wishlist) {
    try {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        updateWishlistCount();
        updateWishlistUI();
    } catch (e) {
        console.error('Error saving wishlist:', e);
    }
}

function isInWishlist(productId) {
    const wishlist = getWishlist();
    return wishlist.some(item => item.id === productId);
}

function addToWishlist(product) {
    const wishlist = getWishlist();
    if (!wishlist.some(item => item.id === product.id)) {
        wishlist.push(product);
        saveWishlist(wishlist);
        return true;
    }
    return false;
}

function removeFromWishlist(productId) {
    let wishlist = getWishlist();
    wishlist = wishlist.filter(item => item.id !== productId);
    saveWishlist(wishlist);
}

function toggleWishlist(button) {
    const productId = parseInt(button.dataset.productId);
    const product = {
        id: productId,
        title: button.dataset.productTitle,
        price: parseFloat(button.dataset.productPrice),
        slug: button.dataset.productSlug,
        image: button.dataset.productImage
    };

    if (isInWishlist(productId)) {
        removeFromWishlist(productId);
        updateButtonState(productId, false);
    } else {
        addToWishlist(product);
        updateButtonState(productId, true);
    }
}

function updateButtonState(productId, isWishlisted) {
    // Update all heart buttons for this product (corner icons)
    document.querySelectorAll(`.wishlist-heart[data-product-id="${productId}"]`).forEach(btn => {
        const svg = btn.querySelector('svg');
        if (isWishlisted) {
            svg.setAttribute('fill', '#ec4899');
            svg.setAttribute('stroke', '#ec4899');
            btn.setAttribute('aria-label', 'Remove from wishlist');
        } else {
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#6b7280');
            btn.setAttribute('aria-label', 'Add to wishlist');
        }
    });

    // Update all wishlist buttons for this product (text buttons)
    document.querySelectorAll(`.wishlist-btn[data-product-id="${productId}"]`).forEach(btn => {
        if (isWishlisted) {
            btn.classList.remove('border-pink-200', 'text-pink-500', 'hover:bg-pink-50');
            btn.classList.add('bg-pink-50', 'border-pink-300', 'text-pink-600');
            btn.innerHTML = `
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="#ec4899" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                In Wishlist
            `;
        } else {
            btn.classList.remove('bg-pink-50', 'border-pink-300', 'text-pink-600');
            btn.classList.add('border-pink-200', 'text-pink-500', 'hover:bg-pink-50');
            btn.innerHTML = `
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                Add to Wishlist
            `;
        }
    });
}

// ============================================
// Wishlist Count Badge
// ============================================

function updateWishlistCount() {
    const wishlist = getWishlist();
    const countBadge = document.getElementById('wishlist-count');

    if (countBadge) {
        if (wishlist.length > 0) {
            countBadge.textContent = wishlist.length;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }
    }
}

// ============================================
// Wishlist Sidebar
// ============================================

function initWishlistSidebar() {
    const wishlistToggle = document.getElementById('wishlist-toggle');
    const wishlistSidebar = document.getElementById('wishlist-sidebar');
    const wishlistClose = document.getElementById('wishlist-close');
    const wishlistOverlay = document.getElementById('wishlist-overlay');
    const wishlistPanel = document.getElementById('wishlist-panel');

    if (!wishlistToggle || !wishlistSidebar) return;

    function openWishlist() {
        wishlistSidebar.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            wishlistPanel.classList.remove('translate-x-full');
        }, 10);
        renderWishlistItems();
    }

    function closeWishlist() {
        wishlistPanel.classList.add('translate-x-full');
        setTimeout(() => {
            wishlistSidebar.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }

    wishlistToggle.addEventListener('click', openWishlist);
    wishlistClose?.addEventListener('click', closeWishlist);
    wishlistOverlay?.addEventListener('click', closeWishlist);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !wishlistSidebar.classList.contains('hidden')) {
            closeWishlist();
        }
    });

    // Event delegation for wishlist sidebar buttons
    wishlistSidebar.addEventListener('click', (e) => {
        // Handle Add to Cart button
        const addToCartBtn = e.target.closest('.wishlist-add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            const productId = parseInt(addToCartBtn.dataset.productId);
            const title = addToCartBtn.dataset.productTitle;
            const price = parseFloat(addToCartBtn.dataset.productPrice);
            const image = addToCartBtn.dataset.productImage;

            const cartItem = {
                id: productId,
                title: title,
                price: price,
                quantity: 1,
                variation: null,
                image: image
            };

            if (typeof addToCart === 'function') {
                addToCart(cartItem);
            }
        }

        // Handle Remove button
        const removeBtn = e.target.closest('.wishlist-remove-btn');
        if (removeBtn) {
            e.preventDefault();
            const productId = parseInt(removeBtn.dataset.productId);
            removeFromWishlist(productId);
            renderWishlistItems();
            updateButtonState(productId, false);
        }
    });
}

function renderWishlistItems() {
    const container = document.getElementById('wishlist-items');
    if (!container) return;

    const wishlist = getWishlist();

    if (wishlist.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center px-6">
                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-600 mb-2">Your wishlist is empty</h3>
                <p class="text-gray-400 text-sm">Click the heart on products to add them here!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = wishlist.map(item => `
        <div class="flex gap-4 p-4 border-b border-gray-100" data-wishlist-item="${item.id}">
            <a href="product.html?slug=${encodeURIComponent(item.slug)}" class="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                ${item.image
                    ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover">`
                    : '<div class="w-full h-full bg-gradient-to-br from-soft-blue/20 to-mint/20"></div>'
                }
            </a>
            <div class="flex-1 min-w-0">
                <a href="product.html?slug=${encodeURIComponent(item.slug)}" class="font-medium text-gray-800 hover:text-soft-blue transition-colors line-clamp-2">${escapeHtml(item.title)}</a>
                <p class="font-medium mt-1" style="color: #71c7e1;">£${item.price.toFixed(2)}</p>
                <div class="flex gap-2 mt-2 items-center">
                    <button
                        class="wishlist-add-to-cart-btn text-xs text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 hover:opacity-90"
                        style="background-color: #71c7e1;"
                        data-product-id="${item.id}"
                        data-product-title="${escapeHtml(item.title)}"
                        data-product-price="${item.price}"
                        data-product-image="${item.image || ''}"
                    >
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                        </svg>
                        Add to Cart
                    </button>
                    <button class="wishlist-remove-btn text-xs text-red-500 hover:underline" data-product-id="${item.id}">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
}

function removeFromWishlistAndUpdate(productId) {
    removeFromWishlist(productId);
    renderWishlistItems();
    updateButtonState(productId, false);
}

// Add item from wishlist to cart
function addWishlistItemToCart(productId, title, price, image) {
    const cartItem = {
        id: productId,
        title: title,
        price: price,
        quantity: 1,
        variation: null,
        image: image
    };

    // Use the global addToCart function from cart.js
    if (typeof addToCart === 'function') {
        addToCart(cartItem);
    }
}

function updateWishlistUI() {
    renderWishlistItems();
}

// ============================================
// Initialize
// ============================================

// Click handler for heart buttons (delegated event listener)
function initWishlistButtons() {
    document.addEventListener('click', (e) => {
        const heartBtn = e.target.closest('.wishlist-heart');
        if (heartBtn) {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(heartBtn);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateWishlistCount();
    initWishlistSidebar();
    initWishlistButtons();
});

// Make functions globally available
window.isInWishlist = isInWishlist;
window.addToWishlist = addToWishlist;
window.removeFromWishlist = removeFromWishlist;
window.toggleWishlist = toggleWishlist;
window.removeFromWishlistAndUpdate = removeFromWishlistAndUpdate;
window.addWishlistItemToCart = addWishlistItemToCart;
window.renderWishlistItems = renderWishlistItems;
