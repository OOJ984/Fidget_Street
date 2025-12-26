/**
 * Product Detail Page Functionality
 * Handles single product display, variations, and add to cart
 */

let currentProduct = null;
let selectedVariation = null;
let selectedColor = null;
let defaultImages = [];
let variationImages = {};
let availableColors = []; // Colors from the colors table with stock status

// Format description with line breaks and bullet points
function formatDescription(text) {
    if (!text) return '';

    // Escape HTML to prevent XSS
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Split into lines
    const lines = escaped.split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
        const trimmed = line.trim();

        // Check if line is a bullet point (starts with -, *, •)
        const bulletMatch = trimmed.match(/^[-*•]\s*(.+)/);

        if (bulletMatch) {
            if (!inList) {
                html += '<ul class="list-disc list-inside space-y-1 my-2">';
                inList = true;
            }
            html += `<li>${bulletMatch[1]}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (trimmed === '') {
                html += '<br>';
            } else {
                html += `<p class="mb-2">${trimmed}</p>`;
            }
        }
    });

    if (inList) {
        html += '</ul>';
    }

    return html;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productSlug = urlParams.get('slug') || urlParams.get('id');

    if (!productSlug) {
        window.location.href = 'products.html';
        return;
    }

    await loadProduct(productSlug);
    setupQuantityControls();
    setupAddToCart();
    setupAddToWishlist();
});

async function loadProduct(slug) {
    try {
        // Load products and colors in parallel
        const [productsResponse, colorsResponse] = await Promise.all([
            fetch('/api/products'),
            fetch('/.netlify/functions/colors')
        ]);

        const products = await productsResponse.json();
        availableColors = colorsResponse.ok ? await colorsResponse.json() : [];

        currentProduct = products.find(p => p.slug === slug || p.id.toString() === slug);

        if (!currentProduct) {
            window.location.href = 'products.html';
            return;
        }

        renderProduct(currentProduct);
        loadRelatedProducts(products, currentProduct);
        updatePageMeta(currentProduct);
    } catch (error) {
        console.error('Error loading product:', error);
    }
}

function renderProduct(product) {
    document.getElementById('breadcrumb-product').textContent = product.title;
    document.getElementById('product-title').textContent = product.title;
    document.title = `Fidget Street | ${product.title}`;

    defaultImages = product.images && product.images.length > 0 ? product.images : [];
    variationImages = product.variation_images || {};

    updateGallery(defaultImages);

    document.getElementById('product-price').textContent = `£${product.price_gbp.toFixed(2)}`;
    document.getElementById('product-category').textContent = product.category.replace('-', ' ');
    // Populate dropdowns
    const descDropdown = document.getElementById('product-description-dropdown');
    if (descDropdown) descDropdown.innerHTML = formatDescription(product.description);
    const dimsDropdown = document.getElementById('product-dimensions-dropdown');
    if (dimsDropdown) dimsDropdown.textContent = product.dimensions || 'Dimensions coming soon';
    const materialsEl = document.getElementById('product-materials');
    if (materialsEl) materialsEl.textContent = product.materials.join(', ');

    const availabilityEl = document.getElementById('product-availability');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (product.stock === 0) {
        if (availabilityEl) {
            availabilityEl.textContent = 'Sold Out';
            availabilityEl.classList.add('text-red-400');
        }
        if (addToCartBtn) {
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else if (product.stock <= 5) {
        if (availabilityEl) {
            availabilityEl.textContent = `Only ${product.stock} left`;
            availabilityEl.classList.add('text-yellow-400');
        }
    } else {
        if (availabilityEl) {
            availabilityEl.textContent = 'In Stock';
            availabilityEl.classList.add('text-green-400');
        }
    }

    const stockBadge = document.getElementById('stock-badge');
    if (stockBadge && product.stock === 0) {
        stockBadge.innerHTML = '<span class="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">Sold Out</span>';
    } else if (stockBadge && product.stock <= 5) {
        stockBadge.innerHTML = `<span class="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-medium">Only ${product.stock} left</span>`;
    }

    const tagsContainer = document.getElementById('product-tags');
    if (tagsContainer) {
        product.tags.forEach(tag => {
            if (tag === 'new') {
                tagsContainer.innerHTML += '<span class="bg-soft-blue text-black px-3 py-1 rounded-full text-sm font-medium">New</span>';
            } else if (tag === 'bestseller') {
                tagsContainer.innerHTML += '<span class="bg-pastel-pink text-black px-3 py-1 rounded-full text-sm font-medium">Bestseller</span>';
            }
        });
    }

    // Render colors if product has colors
    if (product.colors && product.colors.length > 0) {
        const colorsContainer = document.getElementById('colors-container');
        const colorsEl = document.getElementById('colors');
        const stockWarning = document.getElementById('color-stock-warning');

        if (colorsContainer && colorsEl) {
            colorsContainer.classList.remove('hidden');
            colorsEl.innerHTML = '';

            product.colors.forEach((colorName, index) => {
                const colorData = availableColors.find(c => c.name === colorName);
                const isOutOfStock = colorData && !colorData.in_stock;
                const hexCode = colorData?.hex_code;

                const btn = document.createElement('button');
                btn.className = `flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    index === 0 ? 'border-soft-blue bg-soft-blue/10' : 'border-navy/20 hover:border-navy/40'
                } ${isOutOfStock ? 'opacity-50' : ''}`;

                // Color swatch
                const swatch = document.createElement('span');
                swatch.className = 'w-5 h-5 rounded-full border border-navy/20 flex-shrink-0';
                if (hexCode) {
                    swatch.style.backgroundColor = hexCode;
                } else {
                    swatch.style.background = 'linear-gradient(45deg, #ff0000, #00ff00, #0000ff)';
                }
                btn.appendChild(swatch);

                // Color name
                const nameSpan = document.createElement('span');
                nameSpan.textContent = colorName;
                btn.appendChild(nameSpan);

                // Out of stock indicator
                if (isOutOfStock) {
                    const outSpan = document.createElement('span');
                    outSpan.className = 'text-xs text-red-500';
                    outSpan.textContent = '(Out of Stock)';
                    btn.appendChild(outSpan);
                }

                btn.addEventListener('click', () => {
                    document.querySelectorAll('#colors button').forEach(b => {
                        b.classList.remove('border-soft-blue', 'bg-soft-blue/10');
                        b.classList.add('border-navy/20');
                    });
                    btn.classList.remove('border-navy/20');
                    btn.classList.add('border-soft-blue', 'bg-soft-blue/10');
                    selectedColor = colorName;

                    // Check stock and update add to cart button
                    updateAddToCartButton();
                });

                colorsEl.appendChild(btn);
            });

            // Select first color by default
            selectedColor = product.colors[0];
            updateAddToCartButton();
        }
    }

    if (product.variations && product.variations.length > 0) {
        const variationsContainer = document.getElementById('variations-container');
        const variationsEl = document.getElementById('variations');
        if (variationsContainer && variationsEl) {
            variationsContainer.classList.remove('hidden');

            product.variations.forEach((variation, index) => {
                const btn = document.createElement('button');
                btn.className = `px-4 py-2 border rounded-lg transition-colors ${index === 0 ? 'border-soft-blue text-soft-blue' : 'border-white/20 text-gray-400 hover:border-white/40'}`;
                btn.textContent = variation;
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#variations button').forEach(b => {
                        b.classList.remove('border-soft-blue', 'text-soft-blue');
                        b.classList.add('border-white/20', 'text-gray-400');
                    });
                    btn.classList.remove('border-white/20', 'text-gray-400');
                    btn.classList.add('border-soft-blue', 'text-soft-blue');
                    selectedVariation = variation;

                    const varImages = variationImages[variation];
                    if (varImages && varImages.length > 0) {
                        updateGallery(varImages);
                    } else {
                        updateGallery(defaultImages);
                    }
                });
                variationsEl.appendChild(btn);
            });

            selectedVariation = product.variations[0];

            const firstVarImages = variationImages[product.variations[0]];
            if (firstVarImages && firstVarImages.length > 0) {
                updateGallery(firstVarImages);
            }
        }
    }

    const qtyInput = document.getElementById('quantity');
    if (qtyInput) qtyInput.max = Math.min(product.stock, 10);
}

// Check if URL is a video
function isVideoUrl(url) {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
}

// Render main media (image or video)
function renderMainMedia(url, productTitle) {
    if (isVideoUrl(url)) {
        return `
            <video id="main-video" src="${url}" class="w-full h-full object-cover" muted loop playsinline>
                Your browser does not support video.
            </video>
            <div id="video-play-overlay" class="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer transition-opacity">
                <svg class="w-16 h-16 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        `;
    }
    return `<img src="${url}" alt="${productTitle}" class="w-full h-full object-cover" fetchpriority="high">`;
}

// Render thumbnail (image or video)
function renderThumbnail(url, index, productTitle, isActive) {
    const borderClass = isActive ? 'border-soft-blue' : 'border-transparent hover:border-white/30';
    if (isVideoUrl(url)) {
        return `
            <button class="aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 ${borderClass} transition-colors relative" data-index="${index}" data-video="true">
                <video src="${url}" class="w-full h-full object-cover" muted preload="metadata"></video>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg class="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </button>
        `;
    }
    return `
        <button class="aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 ${borderClass} transition-colors" data-index="${index}">
            <img src="${url}" alt="${productTitle} view ${index + 1}" class="w-full h-full object-cover" loading="lazy" decoding="async">
        </button>
    `;
}

function updateGallery(images) {
    const mainImageContainer = document.getElementById('main-image');
    const thumbnailGallery = document.getElementById('thumbnail-gallery');

    if (images.length === 0) {
        mainImageContainer.innerHTML = `
            <div class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <svg class="w-24 h-24 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
            </div>`;
        thumbnailGallery.innerHTML = '';
        return;
    }

    const productTitle = currentProduct?.title || 'Product';

    mainImageContainer.innerHTML = renderMainMedia(images[0], productTitle);
    setupVideoHover();

    thumbnailGallery.innerHTML = images.map((img, index) => renderThumbnail(img, index, productTitle, index === 0)).join('');

    thumbnailGallery.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            mainImageContainer.innerHTML = renderMainMedia(images[index], productTitle);
            setupVideoHover();
            thumbnailGallery.querySelectorAll('button').forEach(b => {
                b.classList.remove('border-soft-blue');
                b.classList.add('border-transparent');
            });
            btn.classList.remove('border-transparent');
            btn.classList.add('border-soft-blue');
        });
    });
}

// Setup hover-to-play for main video
function setupVideoHover() {
    const video = document.getElementById('main-video');
    const overlay = document.getElementById('video-play-overlay');
    const container = document.getElementById('main-image');

    if (!video || !overlay) return;

    // Click overlay to start playing
    overlay.addEventListener('click', () => {
        video.play();
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    });

    // Hover to play
    container.addEventListener('mouseenter', () => {
        video.play();
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    });

    // Mouse leave to pause
    container.addEventListener('mouseleave', () => {
        video.pause();
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    });
}

function loadRelatedProducts(products, currentProduct) {
    const relatedContainer = document.getElementById('related-products');
    if (!relatedContainer) return;

    const related = products
        .filter(p => p.id !== currentProduct.id && p.category === currentProduct.category)
        .slice(0, 3);

    if (related.length === 0) {
        // Fall back to random products if no same-category products found
        const others = products.filter(p => p.id !== currentProduct.id).slice(0, 3);
        others.forEach(product => {
            relatedContainer.innerHTML += createProductCard(product);
        });
    } else {
        related.forEach(product => {
            relatedContainer.innerHTML += createProductCard(product);
        });
    }
}

function updatePageMeta(product) {
    document.querySelector('meta[property="og:title"]').content = `Fidget Street | ${product.title}`;
    document.querySelector('meta[property="og:description"]').content = product.description;
    document.querySelector('meta[name="description"]').content = product.description;
    injectProductSchema(product);
}

function injectProductSchema(product) {
    const existing = document.getElementById('product-schema');
    if (existing) existing.remove();

    const schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.title,
        "description": product.description,
        "image": product.images && product.images.length > 0 ? product.images[0] : null,
        "brand": {
            "@type": "Brand",
            "name": "Fidget Street"
        },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "GBP",
            "price": product.price_gbp,
            "availability": product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            "seller": {
                "@type": "Organization",
                "name": "Fidget Street"
            }
        },
        "category": product.category,
        "material": product.materials ? product.materials.join(", ") : undefined
    };

    Object.keys(schema).forEach(key => {
        if (schema[key] === undefined || schema[key] === null) {
            delete schema[key];
        }
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    injectBreadcrumbSchema(product);
}

function injectBreadcrumbSchema(product) {
    const existing = document.getElementById('breadcrumb-schema');
    if (existing) existing.remove();

    const schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://fidgetstreet.netlify.app/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Shop",
                "item": "https://fidgetstreet.netlify.app/products.html"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": product.title,
                "item": window.location.href
            }
        ]
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'breadcrumb-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}

function setupQuantityControls() {
    const qtyInput = document.getElementById('quantity');
    const decreaseBtn = document.getElementById('qty-decrease');
    const increaseBtn = document.getElementById('qty-increase');

    decreaseBtn.addEventListener('click', () => {
        const current = parseInt(qtyInput.value);
        if (current > 1) qtyInput.value = current - 1;
    });

    increaseBtn.addEventListener('click', () => {
        const current = parseInt(qtyInput.value);
        const max = parseInt(qtyInput.max);
        if (current < max) qtyInput.value = current + 1;
    });

    qtyInput.addEventListener('change', () => {
        const max = parseInt(qtyInput.max);
        if (qtyInput.value < 1) qtyInput.value = 1;
        if (qtyInput.value > max) qtyInput.value = max;
    });
}

// Check if selected color is in stock and update the add to cart button
function updateAddToCartButton() {
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const stockWarning = document.getElementById('color-stock-warning');

    if (!addToCartBtn) return;

    // Check if selected color is out of stock
    if (selectedColor) {
        const colorData = availableColors.find(c => c.name === selectedColor);
        const isOutOfStock = colorData && !colorData.in_stock;

        if (isOutOfStock) {
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
            addToCartBtn.querySelector('span').textContent = 'Out of Stock';
            if (stockWarning) stockWarning.classList.remove('hidden');
        } else {
            addToCartBtn.disabled = false;
            addToCartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            addToCartBtn.querySelector('span').textContent = 'Add to Cart';
            if (stockWarning) stockWarning.classList.add('hidden');
        }
    }
}

function setupAddToCart() {
    const addToCartBtn = document.getElementById('add-to-cart-btn');

    addToCartBtn.addEventListener('click', () => {
        if (!currentProduct || currentProduct.stock === 0) return;

        // Check if selected color is out of stock
        if (selectedColor) {
            const colorData = availableColors.find(c => c.name === selectedColor);
            if (colorData && !colorData.in_stock) {
                return; // Don't add to cart if color is out of stock
            }
        }

        const quantity = parseInt(document.getElementById('quantity').value);

        let cartImage = null;
        if (selectedVariation && variationImages[selectedVariation] && variationImages[selectedVariation].length > 0) {
            cartImage = variationImages[selectedVariation][0];
        } else if (defaultImages.length > 0) {
            cartImage = defaultImages[0];
        }

        const cartItem = {
            id: currentProduct.id,
            title: currentProduct.title,
            price: currentProduct.price_gbp,
            quantity: quantity,
            variation: selectedVariation,
            color: selectedColor,
            image: cartImage
        };

        addToCart(cartItem);
        animateCartButton(addToCartBtn);
        showCartNotification();
    });
}

function showCartNotification() {
    const notification = document.getElementById('cart-notification');
    notification.classList.remove('translate-y-full', 'opacity-0');

    setTimeout(() => {
        notification.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}

function setupBuyNow() {
    const buyNowBtn = document.getElementById('buy-now-btn');
    const buyNowMessage = document.getElementById('buy-now-message');

    if (!currentProduct) return;

    if (currentProduct.trading_station_url) {
        buyNowBtn.href = currentProduct.trading_station_url;
        buyNowBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
    } else {
        buyNowBtn.href = '#';
        buyNowBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        buyNowBtn.querySelector('span').textContent = 'Coming Soon';
        if (buyNowMessage) {
            buyNowMessage.textContent = 'This product will be available on YE Trading Station soon';
        }
        buyNowBtn.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }
}

function setupAddToWishlist() {
    const addToWishlistBtn = document.getElementById('add-to-wishlist-btn');
    if (!addToWishlistBtn) return;

    // Update button state on load
    updateWishlistButtonState();

    addToWishlistBtn.addEventListener('click', () => {
        if (!currentProduct) return;

        let productImage = null;
        if (selectedVariation && variationImages[selectedVariation] && variationImages[selectedVariation].length > 0) {
            productImage = variationImages[selectedVariation][0];
        } else if (defaultImages.length > 0) {
            productImage = defaultImages[0];
        }

        const product = {
            id: currentProduct.id,
            title: currentProduct.title,
            price: currentProduct.price_gbp,
            slug: currentProduct.slug,
            image: productImage
        };

        const wasInWishlist = typeof isInWishlist === 'function' && isInWishlist(currentProduct.id);

        if (wasInWishlist) {
            // Remove from wishlist
            if (typeof removeFromWishlist === 'function') {
                removeFromWishlist(currentProduct.id);
            }
        } else {
            // Add to wishlist
            if (typeof addToWishlist === 'function') {
                addToWishlist(product);
            }
            // Open the wishlist sidebar
            openWishlistSidebar();
        }

        updateWishlistButtonState();
    });
}

function updateWishlistButtonState() {
    const addToWishlistBtn = document.getElementById('add-to-wishlist-btn');
    if (!addToWishlistBtn || !currentProduct) return;

    const inWishlist = typeof isInWishlist === 'function' && isInWishlist(currentProduct.id);
    const svg = addToWishlistBtn.querySelector('svg');
    const span = addToWishlistBtn.querySelector('span');

    if (inWishlist) {
        addToWishlistBtn.style.backgroundColor = '#fce7f3';
        addToWishlistBtn.style.borderColor = '#ec4899';
        addToWishlistBtn.style.color = '#ec4899';
        if (svg) {
            svg.setAttribute('fill', '#ec4899');
        }
        if (span) {
            span.textContent = 'In Wishlist';
        }
    } else {
        addToWishlistBtn.style.backgroundColor = '#fdf2f8';
        addToWishlistBtn.style.borderColor = '#ec4899';
        addToWishlistBtn.style.color = '#ec4899';
        if (svg) {
            svg.setAttribute('fill', 'none');
        }
        if (span) {
            span.textContent = 'Add to Wishlist';
        }
    }
}

function openWishlistSidebar() {
    const wishlistSidebar = document.getElementById('wishlist-sidebar');
    const wishlistPanel = document.getElementById('wishlist-panel');

    if (wishlistSidebar && wishlistPanel) {
        wishlistSidebar.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            wishlistPanel.classList.remove('translate-x-full');
        }, 10);
        // Render wishlist items if function exists
        if (typeof renderWishlistItems === 'function') {
            renderWishlistItems();
        }
    }
}
