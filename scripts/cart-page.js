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
    initDiscountCode();
    initGiftCard();
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
                <p class="text-soft-blue font-medium mt-2">£${item.price.toFixed(2)}</p>

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
                    <button class="text-navy-600 hover:text-soft-blue transition-colors text-sm remove-btn" data-id="${item.id}">Remove</button>
                </div>
            </div>
        </div>
    `}).join('');

    updateOrderSummary();
}

function updateOrderSummary() {
    // Use gift card totals which includes discount
    const totals = getCartTotalsWithGiftCard();

    document.getElementById('order-subtotal').textContent = `£${totals.subtotal.toFixed(2)}`;
    document.getElementById('order-shipping').textContent = totals.shipping === 0 ? 'FREE' : `£${totals.shipping.toFixed(2)}`;
    document.getElementById('order-total').textContent = `£${totals.total.toFixed(2)}`;

    // Update discount display
    const discountInputSection = document.getElementById('discount-input-section');
    const discountAppliedSection = document.getElementById('discount-applied-section');
    const discountCodeDisplay = document.getElementById('discount-code-display');
    const discountAmountEl = document.getElementById('discount-amount');

    if (totals.discountCode) {
        discountInputSection?.classList.add('hidden');
        discountAppliedSection?.classList.remove('hidden');
        if (discountCodeDisplay) discountCodeDisplay.textContent = totals.discountCode;
        // Display appropriate discount text based on type
        if (discountAmountEl) {
            if (totals.discountType === 'free_delivery') {
                discountAmountEl.textContent = 'Free Delivery';
            } else {
                discountAmountEl.textContent = `-£${totals.discountAmount.toFixed(2)}`;
            }
        }
    } else {
        discountInputSection?.classList.remove('hidden');
        discountAppliedSection?.classList.add('hidden');
    }

    // Update gift card display
    const giftCardInputSection = document.getElementById('gift-card-input-section');
    const giftCardAppliedSection = document.getElementById('gift-card-applied-section');
    const giftCardCodeDisplay = document.getElementById('gift-card-code-display');
    const giftCardBalance = document.getElementById('gift-card-balance');
    const giftCardAmountEl = document.getElementById('gift-card-amount');
    const giftCardRemaining = document.getElementById('gift-card-remaining');
    const giftCardRemainingAmount = document.getElementById('gift-card-remaining-amount');

    if (totals.giftCardCode) {
        giftCardInputSection?.classList.add('hidden');
        giftCardAppliedSection?.classList.remove('hidden');
        if (giftCardCodeDisplay) giftCardCodeDisplay.textContent = totals.giftCardCode;
        if (giftCardBalance) giftCardBalance.textContent = totals.giftCardBalance.toFixed(2);
        if (giftCardAmountEl) giftCardAmountEl.textContent = `-£${totals.giftCardAmount.toFixed(2)}`;

        // Show remaining balance if not using full card
        if (totals.giftCardRemainingAfterUse > 0) {
            giftCardRemaining?.classList.remove('hidden');
            if (giftCardRemainingAmount) giftCardRemainingAmount.textContent = totals.giftCardRemainingAfterUse.toFixed(2);
        } else {
            giftCardRemaining?.classList.add('hidden');
        }
    } else {
        giftCardInputSection?.classList.remove('hidden');
        giftCardAppliedSection?.classList.add('hidden');
    }

    // Update payment buttons visibility
    updatePaymentButtons(totals);
}

function updatePaymentButtons(totals) {
    const giftCardBtn = document.getElementById('pay-gift-card-btn');
    const stripeBtn = document.getElementById('pay-stripe-btn');
    const paypalContainer = document.getElementById('paypal-button-container');
    const orDivider = stripeBtn?.nextElementSibling; // The "or" divider

    if (totals.coversFullOrder && totals.giftCardCode) {
        // Gift card covers full order - show only gift card button
        giftCardBtn?.classList.remove('hidden');
        stripeBtn?.classList.add('hidden');
        paypalContainer?.classList.add('hidden');
        orDivider?.classList.add('hidden');
    } else {
        // Normal payment flow
        giftCardBtn?.classList.add('hidden');
        stripeBtn?.classList.remove('hidden');
        paypalContainer?.classList.remove('hidden');
        orDivider?.classList.remove('hidden');
    }
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
            const discount = getAppliedDiscount();
            const giftCard = getAppliedGiftCard();
            const totals = getCartTotalsWithGiftCard();

            const response = await fetch('/api/stripe-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    discountCode: discount?.code || null,
                    giftCardCode: giftCard?.code || null,
                    giftCardAmount: totals.giftCardAmount || null
                })
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

                const discount = getAppliedDiscount();
                const giftCard = getAppliedGiftCard();
                const totals = getCartTotalsWithGiftCard();

                const response = await fetch('/api/paypal-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cart,
                        discountCode: discount?.code || null,
                        giftCardCode: giftCard?.code || null,
                        giftCardAmount: totals.giftCardAmount || null
                    })
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
                    const discount = getAppliedDiscount();
                    const giftCard = getAppliedGiftCard();
                    const totals = getCartTotalsWithGiftCard();

                    const response = await fetch('/api/paypal-capture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderID: data.orderID,
                            items: cart,
                            discountCode: discount?.code || null,
                            giftCardCode: giftCard?.code || null,
                            giftCardAmount: totals.giftCardAmount || null
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        clearCart();
                        clearDiscount();
                        clearGiftCard();
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

// ============================================
// Discount Code Functions
// ============================================

function initDiscountCode() {
    const applyBtn = document.getElementById('apply-discount-btn');
    const removeBtn = document.getElementById('remove-discount-btn');
    const codeInput = document.getElementById('discount-code-input');
    const errorEl = document.getElementById('discount-error');

    // Check if discount was already applied
    updateOrderSummary();

    // Apply discount
    applyBtn?.addEventListener('click', async () => {
        const code = codeInput?.value?.trim();
        if (!code) {
            showDiscountError('Please enter a discount code');
            return;
        }

        applyBtn.disabled = true;
        applyBtn.textContent = 'Checking...';
        hideDiscountError();

        try {
            const totals = getCartTotals();
            const response = await fetch('/api/validate-discount', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, subtotal: totals.subtotal })
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                setAppliedDiscount({
                    code: data.code,
                    name: data.name,
                    discount_type: data.discount_type,
                    discount_value: data.discount_value
                });
                showToast(data.message, 'success');
                updateOrderSummary();
                codeInput.value = '';
            } else {
                showDiscountError(data.error || 'Invalid discount code');
            }
        } catch (error) {
            console.error('Discount validation error:', error);
            showDiscountError('Failed to validate code. Please try again.');
        } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Apply';
        }
    });

    // Remove discount
    removeBtn?.addEventListener('click', () => {
        clearDiscount();
        showToast('Discount code removed', 'info');
        updateOrderSummary();
    });

    // Allow Enter key to apply code
    codeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyBtn?.click();
        }
    });
}

function showDiscountError(message) {
    const errorEl = document.getElementById('discount-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function hideDiscountError() {
    const errorEl = document.getElementById('discount-error');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

// ============================================
// Gift Card Functions
// ============================================

function initGiftCard() {
    const applyBtn = document.getElementById('apply-gift-card-btn');
    const removeBtn = document.getElementById('remove-gift-card-btn');
    const codeInput = document.getElementById('gift-card-input');
    const giftCardPayBtn = document.getElementById('pay-gift-card-btn');

    // Check if gift card was already applied
    updateOrderSummary();

    // Apply gift card
    applyBtn?.addEventListener('click', async () => {
        const code = codeInput?.value?.trim();
        if (!code) {
            showGiftCardError('Please enter a gift card code');
            return;
        }

        applyBtn.disabled = true;
        applyBtn.textContent = 'Checking...';
        hideGiftCardError();

        try {
            const totals = getCartTotalsWithDiscount();
            const response = await fetch('/api/validate-gift-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, subtotal: totals.total })
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                setAppliedGiftCard({
                    code: data.code,
                    balance: data.balance,
                    applicable_amount: data.applicable_amount,
                    remaining_after_use: data.remaining_after_use,
                    covers_full_order: data.covers_full_order
                });
                showToast(data.message, 'success');
                updateOrderSummary();
                codeInput.value = '';
            } else {
                showGiftCardError(data.error || 'Invalid gift card code');
            }
        } catch (error) {
            console.error('Gift card validation error:', error);
            showGiftCardError('Failed to validate code. Please try again.');
        } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Apply';
        }
    });

    // Remove gift card
    removeBtn?.addEventListener('click', () => {
        clearGiftCard();
        showToast('Gift card removed', 'info');
        updateOrderSummary();
    });

    // Allow Enter key to apply code
    codeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyBtn?.click();
        }
    });

    // Auto-format gift card code as user types
    codeInput?.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Insert dashes in the format GC-XXXX-XXXX-XXXX
        if (value.startsWith('GC')) {
            let formatted = 'GC';
            const rest = value.slice(2);
            for (let i = 0; i < rest.length && i < 12; i++) {
                if (i % 4 === 0) formatted += '-';
                formatted += rest[i];
            }
            e.target.value = formatted;
        } else if (value.length > 0) {
            // If they didn't start with GC, add it
            e.target.value = 'GC-' + value.slice(0, 12).replace(/(.{4})/g, '$1-').replace(/-$/, '');
        }
    });

    // Gift card only payment button
    giftCardPayBtn?.addEventListener('click', async () => {
        if (!validateTerms()) return;

        const cart = getCart();
        if (cart.length === 0) {
            alert('Your cart is empty');
            return;
        }

        const giftCard = getAppliedGiftCard();
        if (!giftCard) {
            alert('No gift card applied');
            return;
        }

        giftCardPayBtn.disabled = true;
        giftCardPayBtn.innerHTML = '<span class="animate-pulse">Processing...</span>';

        try {
            const discount = getAppliedDiscount();
            const response = await fetch('/api/gift-card-only-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    giftCardCode: giftCard.code,
                    discountCode: discount?.code || null
                })
            });

            const data = await response.json();

            if (data.success) {
                clearCart();
                clearDiscount();
                clearGiftCard();
                window.location.href = `/success.html?order=${data.order_number}&gc_remaining=${data.remaining_balance}`;
            } else {
                throw new Error(data.error || 'Checkout failed');
            }
        } catch (error) {
            console.error('Gift card checkout error:', error);
            alert(error.message || 'Checkout failed. Please try again.');
            giftCardPayBtn.disabled = false;
            giftCardPayBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>Pay with Gift Card</span>';
        }
    });
}

function showGiftCardError(message) {
    const errorEl = document.getElementById('gift-card-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function hideGiftCardError() {
    const errorEl = document.getElementById('gift-card-error');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}
