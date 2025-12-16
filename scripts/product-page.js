/**
 * Product Detail Page Functionality
 * Handles single product display, variations, and add to cart
 */

let currentProduct = null;
let selectedVariation = null;
let defaultImages = [];
let variationImages = {};

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
});

async function loadProduct(slug) {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();

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
    document.title = `Wicka | ${product.title}`;

    defaultImages = product.images && product.images.length > 0 ? product.images : [];
    variationImages = product.variation_images || {};

    updateGallery(defaultImages);

    document.getElementById('product-price').textContent = `£${product.price_gbp.toFixed(2)}`;
    document.getElementById('product-category').textContent = product.category.replace('-', ' ');
    document.getElementById('product-description').textContent = product.description;
    document.getElementById('product-materials').textContent = product.materials.join(', ');
    document.getElementById('product-dimensions').textContent = product.dimensions;

    const availabilityEl = document.getElementById('product-availability');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (product.stock === 0) {
        availabilityEl.textContent = 'Sold Out';
        availabilityEl.classList.add('text-red-400');
        if (addToCartBtn) {
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else if (product.stock <= 5) {
        availabilityEl.textContent = `Only ${product.stock} left`;
        availabilityEl.classList.add('text-yellow-400');
    } else {
        availabilityEl.textContent = 'In Stock';
        availabilityEl.classList.add('text-green-400');
    }

    const stockBadge = document.getElementById('stock-badge');
    if (product.stock === 0) {
        stockBadge.innerHTML = '<span class="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">Sold Out</span>';
    } else if (product.stock <= 5) {
        stockBadge.innerHTML = `<span class="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-medium">Only ${product.stock} left</span>`;
    }

    const tagsContainer = document.getElementById('product-tags');
    product.tags.forEach(tag => {
        if (tag === 'new') {
            tagsContainer.innerHTML += '<span class="bg-rose-gold text-black px-3 py-1 rounded-full text-sm font-medium">New</span>';
        } else if (tag === 'bestseller') {
            tagsContainer.innerHTML += '<span class="bg-pastel-pink text-black px-3 py-1 rounded-full text-sm font-medium">Bestseller</span>';
        }
    });

    if (product.variations && product.variations.length > 0) {
        const variationsContainer = document.getElementById('variations-container');
        const variationsEl = document.getElementById('variations');
        variationsContainer.classList.remove('hidden');

        product.variations.forEach((variation, index) => {
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 border rounded-lg transition-colors ${index === 0 ? 'border-rose-gold text-rose-gold' : 'border-white/20 text-gray-400 hover:border-white/40'}`;
            btn.textContent = variation;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#variations button').forEach(b => {
                    b.classList.remove('border-rose-gold', 'text-rose-gold');
                    b.classList.add('border-white/20', 'text-gray-400');
                });
                btn.classList.remove('border-white/20', 'text-gray-400');
                btn.classList.add('border-rose-gold', 'text-rose-gold');
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

    document.getElementById('quantity').max = Math.min(product.stock, 10);
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

    mainImageContainer.innerHTML = `<img src="${images[0]}" alt="${productTitle}" class="w-full h-full object-cover" fetchpriority="high">`;

    thumbnailGallery.innerHTML = images.map((img, index) => `
        <button class="aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 ${index === 0 ? 'border-rose-gold' : 'border-transparent hover:border-white/30'} transition-colors" data-index="${index}">
            <img src="${img}" alt="${productTitle} view ${index + 1}" class="w-full h-full object-cover" loading="lazy" decoding="async">
        </button>
    `).join('');

    thumbnailGallery.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            mainImageContainer.innerHTML = `<img src="${images[index]}" alt="${productTitle}" class="w-full h-full object-cover">`;
            thumbnailGallery.querySelectorAll('button').forEach(b => {
                b.classList.remove('border-rose-gold');
                b.classList.add('border-transparent');
            });
            btn.classList.remove('border-transparent');
            btn.classList.add('border-rose-gold');
        });
    });
}

function loadRelatedProducts(products, currentProduct) {
    const relatedContainer = document.getElementById('related-products');
    const related = products
        .filter(p => p.id !== currentProduct.id && p.category === currentProduct.category)
        .slice(0, 3);

    if (related.length === 0) {
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
    document.querySelector('meta[property="og:title"]').content = `Wicka | ${product.title}`;
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
            "name": "Wicka"
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
                "name": "Wicka"
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
                "item": "https://wicka.co.uk/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Shop",
                "item": "https://wicka.co.uk/products.html"
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

function setupAddToCart() {
    const addToCartBtn = document.getElementById('add-to-cart-btn');

    addToCartBtn.addEventListener('click', () => {
        if (!currentProduct || currentProduct.stock === 0) return;

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
