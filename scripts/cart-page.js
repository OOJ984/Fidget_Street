/**
 * Cart Page Functionality
 * Handles cart display, quantity updates, and payment integration
 */

let cartPageProductsCache = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadProductsForCart();
    renderCartPage();
    setupCartPage();
    initPaymentButtons();
});

async function loadProductsForCart() {
    try {
        if (window.API && window.API.fetchProducts) {
            cartPageProductsCache = await window.API.fetchProducts();
        }
    } catch (e) {
        console.warn('Could not fetch products for cart images:', e);
    }
}

function getProductImage(itemId) {
    if (cartPageProductsCache) {
        const product = cartPageProductsCache.find(p => p.id === itemId);
        if (product && product.images && product.images.length > 0) {
            return product.images[0];
        }
    }
    return null;
}

function renderCartPage() {
    const cart = getCart();
    const emptyCart = document.getElementById('empty-cart');
    const cartContent = document.getElementById('cart-content');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartItemCount = document.getElementById('cart-item-count');

    if (cart.length === 0) {
        emptyCart.classList.remove('hidden');
        cartContent.classList.add('hidden');
        return;
    }

    emptyCart.classList.add('hidden');
    cartContent.classList.remove('hidden');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartItemCount.textContent = totalItems;

    cartItemsList.innerHTML = cart.map(item => {
        const imageUrl = getProductImage(item.id) || item.image;
        return `
        <div class="flex gap-4 p-4 bg-navy-50 border border-navy/10 rounded-lg" data-item-id="${item.id}">
            <div class="w-24 h-24 bg-navy-100 rounded-lg overflow-hidden flex-shrink-0">
                ${imageUrl ? `<img src="${imageUrl}" alt="${item.title}" class="w-full h-full object-cover">` : `<div class="w-full h-full bg-gradient-to-br from-navy-100 to-navy-200"></div>`}
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-medium truncate text-navy">${item.title}</h3>
                ${item.variation ? `<p class="text-sm text-navy-600 mt-1">${item.variation}</p>` : ''}
                <p class="text-rose-gold font-medium mt-2">£${item.price.toFixed(2)}</p>

                <div class="flex items-center justify-between mt-4">
                    <div class="flex items-center space-x-2">
                        <button class="qty-btn w-8 h-8 rounded bg-navy-100 hover:bg-navy-200 transition-colors flex items-center justify-center text-navy" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
                        </button>
                        <span class="w-8 text-center text-navy">${item.quantity}</span>
                        <button class="qty-btn w-8 h-8 rounded bg-navy-100 hover:bg-navy-200 transition-colors flex items-center justify-center text-navy" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                    <button class="text-navy-600 hover:text-rose-gold transition-colors text-sm remove-btn" data-id="${item.id}">Remove</button>
                </div>
            </div>
        </div>
    `}).join('');

    updateOrderSummary();
}

function updateOrderSummary() {
    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 20 ? 0 : 2.99;
    const total = subtotal + shipping;

    document.getElementById('order-subtotal').textContent = `£${subtotal.toFixed(2)}`;
    document.getElementById('order-shipping').textContent = shipping === 0 ? 'FREE' : `£${shipping.toFixed(2)}`;
    document.getElementById('order-total').textContent = `£${total.toFixed(2)}`;
}

function setupCartPage() {
    document.getElementById('cart-items-list').addEventListener('click', (e) => {
        const qtyBtn = e.target.closest('.qty-btn');
        const removeBtn = e.target.closest('.remove-btn');

        if (qtyBtn) {
            const action = qtyBtn.dataset.action;
            const id = parseInt(qtyBtn.dataset.id);
            const cart = getCart();
            const item = cart.find(i => i.id === id);

            if (item) {
                if (action === 'increase') {
                    item.quantity = Math.min(item.quantity + 1, 10);
                } else if (action === 'decrease') {
                    item.quantity = Math.max(item.quantity - 1, 1);
                }
                saveCart(cart);
                renderCartPage();
                updateCartCount();
            }
        }

        if (removeBtn) {
            const id = parseInt(removeBtn.dataset.id);
            removeFromCart(id);
            renderCartPage();
        }
    });

    document.getElementById('clear-cart').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your cart?')) {
            clearCart();
            renderCartPage();
        }
    });
}

function validateTerms() {
    const termsCheckbox = document.getElementById('checkout-terms');
    const termsError = document.getElementById('terms-error');

    if (!termsCheckbox.checked) {
        termsError.classList.remove('hidden');
        termsCheckbox.focus();
        return false;
    }

    termsError.classList.add('hidden');
    return true;
}

function initPaymentButtons() {
    // Stripe Checkout
    document.getElementById('pay-stripe-btn').addEventListener('click', async () => {
        if (!validateTerms()) return;

        const cart = getCart();
        if (cart.length === 0) {
            alert('Your cart is empty');
            return;
        }

        const btn = document.getElementById('pay-stripe-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Redirecting to checkout...</span>';

        try {
            const response = await fetch('/api/stripe-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart })
            });

            const data = await response.json();

            if (data.url) {
                sessionStorage.setItem('pending_cart', JSON.stringify(cart));
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to create checkout session');
            }
        } catch (error) {
            console.error('Stripe checkout error:', error);
            alert('Checkout failed. Please try again.');
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg><span>Pay with Card</span>';
        }
    });

    // PayPal Button
    if (typeof paypal !== 'undefined') {
        paypal.Buttons({
            style: {
                layout: 'horizontal',
                color: 'gold',
                shape: 'rect',
                label: 'paypal',
                height: 45
            },
            createOrder: async function() {
                if (!validateTerms()) {
                    throw new Error('Please agree to the terms to continue');
                }

                const cart = getCart();
                if (cart.length === 0) {
                    throw new Error('Your cart is empty');
                }

                const response = await fetch('/api/paypal-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: cart })
                });

                const data = await response.json();
                if (data.orderID) {
                    return data.orderID;
                }
                throw new Error(data.error || 'Failed to create PayPal order');
            },
            onApprove: async function(data) {
                try {
                    const cart = getCart();

                    const response = await fetch('/api/paypal-capture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderID: data.orderID,
                            items: cart
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        clearCart();
                        window.location.href = `/success.html?order=${result.order_number}`;
                    } else {
                        throw new Error(result.error || 'Payment failed');
                    }
                } catch (error) {
                    console.error('PayPal capture error:', error);
                    alert('Payment processing failed. Please try again.');
                }
            },
            onError: function(err) {
                console.error('PayPal error:', err);
                alert('PayPal encountered an error. Please try again.');
            }
        }).render('#paypal-button-container');
    }
}

// Close modal on overlay click
document.getElementById('order-modal-overlay')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});
