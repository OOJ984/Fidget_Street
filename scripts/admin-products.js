/**
 * Admin Products Page
 * Product management with image uploads and variations
 *
 * IMPORTANT: Do NOT declare a variable named 'supabase' - it conflicts with
 * the global window.supabase object from the Supabase CDN. Use 'supabaseClient' instead.
 */

let products = [];
let productImages = []; // Current default images for the product being edited
let variationImages = {}; // Images per variation: { "Gold": ["url1"], "Silver": ["url2"] }
let libraryImages = []; // All images from the media library
let selectedLibraryImages = []; // Currently selected images in the picker
let pickerTargetVariation = null; // Which variation is the picker for (null = default images)
let supabaseClient = null;
let availableColors = []; // All colors from the colors table
let selectedColors = []; // Currently selected colors for the product being edited

// Initialize Supabase client from API config
async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    try {
        const response = await fetch('/api/supabase-config');
        const config = await response.json();
        supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        return supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    // Initialize Supabase before other operations
    await initSupabase();

    document.getElementById('user-name').textContent = user.name || user.email;
    document.getElementById('logout-btn').addEventListener('click', logout);

    await Promise.all([loadProducts(), loadColors()]);
    setupEventListeners();
    setupColorsDropdown();
});

// Load available colors from the API
async function loadColors() {
    try {
        const response = await fetch('/.netlify/functions/colors');
        if (!response.ok) throw new Error('Failed to load colors');
        availableColors = await response.json();
        renderColorsDropdown();
    } catch (error) {
        console.error('Error loading colors:', error);
        availableColors = [];
    }
}

// Render the colors dropdown list
function renderColorsDropdown() {
    const colorsList = document.getElementById('colors-list');
    if (!colorsList) return;

    if (availableColors.length === 0) {
        colorsList.innerHTML = `
            <p class="px-4 py-2 text-sm text-navy-500">No colours available.</p>
            <a href="colors.html" class="block px-4 py-2 text-sm text-soft-blue hover:bg-navy-50">+ Add colours</a>
        `;
        return;
    }

    colorsList.innerHTML = availableColors.map(color => {
        const isSelected = selectedColors.includes(color.name);
        const swatchStyle = color.hex_code
            ? `background-color: ${color.hex_code};`
            : 'background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff);';
        const stockBadge = !color.in_stock
            ? '<span class="text-xs text-red-500 ml-auto">Out of Stock</span>'
            : '';

        return `
            <label class="flex items-center gap-3 px-4 py-2 hover:bg-navy-50 cursor-pointer ${!color.in_stock ? 'opacity-50' : ''}">
                <input type="checkbox" value="${escapeHtml(color.name)}"
                    ${isSelected ? 'checked' : ''}
                    class="color-checkbox w-4 h-4 rounded border-navy/30 text-soft-blue focus:ring-soft-blue">
                <span class="w-5 h-5 rounded-full flex-shrink-0 border border-navy/20" style="${swatchStyle}"></span>
                <span class="text-sm">${escapeHtml(color.name)}</span>
                ${stockBadge}
            </label>
        `;
    }).join('');
}

// Setup colors dropdown event listeners
function setupColorsDropdown() {
    const toggle = document.getElementById('colors-toggle');
    const menu = document.getElementById('colors-menu');
    const colorsList = document.getElementById('colors-list');

    if (!toggle || !menu) return;

    // Toggle dropdown
    toggle.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // Handle checkbox changes
    colorsList.addEventListener('change', (e) => {
        if (e.target.classList.contains('color-checkbox')) {
            const colorName = e.target.value;
            if (e.target.checked) {
                if (!selectedColors.includes(colorName)) {
                    selectedColors.push(colorName);
                }
            } else {
                selectedColors = selectedColors.filter(c => c !== colorName);
            }
            updateColorsDisplay();
            updateSelectedColorsTags();
        }
    });
}

// Update the colors display text
function updateColorsDisplay() {
    const display = document.getElementById('colors-display');
    const hiddenInput = document.getElementById('product-colors');

    if (selectedColors.length === 0) {
        display.textContent = 'Select colours...';
        display.classList.add('text-navy-500');
        display.classList.remove('text-navy-900');
    } else {
        display.textContent = selectedColors.join(', ');
        display.classList.remove('text-navy-500');
        display.classList.add('text-navy-900');
    }

    hiddenInput.value = JSON.stringify(selectedColors);
}

// Update selected colors tags below dropdown
function updateSelectedColorsTags() {
    const container = document.getElementById('selected-colors');
    if (!container) return;

    container.innerHTML = selectedColors.map(colorName => {
        const color = availableColors.find(c => c.name === colorName);
        const swatchStyle = color?.hex_code
            ? `background-color: ${color.hex_code};`
            : 'background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff);';

        return `
            <span class="inline-flex items-center gap-1.5 px-2 py-1 bg-navy-100 rounded-full text-sm">
                <span class="w-3 h-3 rounded-full border border-navy/20" style="${swatchStyle}"></span>
                ${escapeHtml(colorName)}
                <button type="button" onclick="removeColor('${escapeHtml(colorName)}')" class="text-navy-400 hover:text-red-500">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </span>
        `;
    }).join('');
}

// Remove a color from selection
function removeColor(colorName) {
    selectedColors = selectedColors.filter(c => c !== colorName);
    updateColorsDisplay();
    updateSelectedColorsTags();
    renderColorsDropdown(); // Update checkboxes
}

async function loadProducts() {
    try {
        const response = await adminFetch('/api/admin-products');
        if (!response) {
            document.getElementById('products-list').innerHTML = '<p class="text-red-500 text-center py-8">Authentication failed. Please log in again.</p>';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            document.getElementById('products-list').innerHTML = `<p class="text-red-500 text-center py-8">Error: ${data.error || 'Failed to load products'}</p>`;
            return;
        }

        products = data;
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('products-list').innerHTML = `<p class="text-red-500 text-center py-8">Error loading products: ${error.message}</p>`;
    }
}

function renderProducts() {
    if (products.length === 0) {
        document.getElementById('products-list').innerHTML = '<p class="text-gray-400 text-center py-8">No products yet</p>';
        return;
    }

    document.getElementById('products-list').innerHTML = `
        <table class="w-full">
            <thead>
                <tr class="text-left text-sm text-gray-400">
                    <th class="pb-4 font-medium">Product</th>
                    <th class="pb-4 font-medium">Category</th>
                    <th class="pb-4 font-medium">Price</th>
                    <th class="pb-4 font-medium">Stock</th>
                    <th class="pb-4 font-medium">Status</th>
                    <th class="pb-4 font-medium">Actions</th>
                </tr>
            </thead>
            <tbody class="text-sm">
                ${products.map(product => {
                    const saleStatus = getSaleStatus(product);
                    const priceDisplay = renderPriceWithSale(product, saleStatus);
                    const saleBadge = renderSaleBadge(saleStatus);

                    return `
                    <tr class="border-t border-white/10">
                        <td class="py-4">
                            <div class="font-medium">${escapeHtml(product.title)}</div>
                            <div class="text-xs text-gray-500">${product.slug}</div>
                        </td>
                        <td class="py-4 text-gray-400">${product.category}</td>
                        <td class="py-4">${priceDisplay}</td>
                        <td class="py-4">${product.stock}</td>
                        <td class="py-4">
                            <div class="flex flex-wrap gap-1">
                                <span class="px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}">
                                    ${product.is_active ? 'Active' : 'Inactive'}
                                </span>
                                ${saleBadge}
                            </div>
                        </td>
                        <td class="py-4">
                            <button class="text-soft-blue hover:underline mr-3 edit-btn" data-id="${product.id}">Edit</button>
                            <button class="text-red-400 hover:underline delete-btn" data-id="${product.id}">Delete</button>
                        </td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;
}

function renderPriceWithSale(product, saleStatus) {
    if (saleStatus !== 'active') {
        return `£${product.price_gbp.toFixed(2)}`;
    }

    // Calculate sale price
    let salePrice;
    if (product.sale_percentage) {
        salePrice = product.price_gbp * (1 - product.sale_percentage / 100);
    } else if (product.sale_price_gbp) {
        salePrice = product.sale_price_gbp;
    } else {
        return `£${product.price_gbp.toFixed(2)}`;
    }

    return `<span class="line-through text-gray-500">£${product.price_gbp.toFixed(2)}</span> <span class="text-coral font-medium">£${salePrice.toFixed(2)}</span>`;
}

function renderSaleBadge(saleStatus) {
    if (!saleStatus) return '';

    const badges = {
        active: '<span class="px-2 py-1 rounded-full text-xs bg-coral/20 text-coral">SALE</span>',
        scheduled: '<span class="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">Scheduled</span>',
        expired: '<span class="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">Sale Expired</span>'
    };

    return badges[saleStatus] || '';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============ Sale Pricing Functions ============

function toggleSaleOptions() {
    const isOnSale = document.getElementById('product-on-sale').checked;
    const saleOptions = document.getElementById('sale-options');

    if (isOnSale) {
        saleOptions.classList.remove('hidden');
        updateSalePreview();
    } else {
        saleOptions.classList.add('hidden');
        // Reset schedule checkbox when sale is turned off
        document.getElementById('schedule-sale').checked = false;
        document.getElementById('schedule-options').classList.add('hidden');
    }
}

function toggleScheduleOptions() {
    const isScheduled = document.getElementById('schedule-sale').checked;
    const scheduleOptions = document.getElementById('schedule-options');

    if (isScheduled) {
        scheduleOptions.classList.remove('hidden');
    } else {
        scheduleOptions.classList.add('hidden');
        // Clear schedule fields
        document.getElementById('sale-starts').value = '';
        document.getElementById('sale-ends').value = '';
    }
}

function updateSaleTypeLabel() {
    const saleType = document.getElementById('sale-type').value;
    const label = document.getElementById('sale-value-label');
    const input = document.getElementById('sale-value');

    if (saleType === 'percentage') {
        label.textContent = 'Percentage Off (%)';
        input.step = '1';
        input.max = '99';
        input.placeholder = 'e.g. 20';
    } else {
        label.textContent = 'Sale Price (£)';
        input.step = '0.01';
        input.removeAttribute('max');
        input.placeholder = '';
    }

    updateSalePreview();
}

function updateSalePreview() {
    const originalPrice = parseFloat(document.getElementById('product-price').value) || 0;
    const saleType = document.getElementById('sale-type').value;
    const saleValue = parseFloat(document.getElementById('sale-value').value) || 0;
    const preview = document.getElementById('sale-preview');

    if (originalPrice <= 0 || saleValue <= 0) {
        preview.classList.add('hidden');
        return;
    }

    let salePrice;
    let savings;

    if (saleType === 'percentage') {
        if (saleValue >= 100) {
            preview.classList.add('hidden');
            return;
        }
        salePrice = originalPrice * (1 - saleValue / 100);
        savings = saleValue;
    } else {
        if (saleValue >= originalPrice) {
            preview.classList.add('hidden');
            return;
        }
        salePrice = saleValue;
        savings = Math.round((1 - salePrice / originalPrice) * 100);
    }

    document.getElementById('preview-original').textContent = `£${originalPrice.toFixed(2)}`;
    document.getElementById('preview-sale').textContent = ` → £${salePrice.toFixed(2)}`;
    document.getElementById('preview-savings').textContent = ` (Save ${savings}%)`;
    preview.classList.remove('hidden');
}

function getSaleStatus(product) {
    const now = new Date();
    const startsAt = product.sale_starts_at ? new Date(product.sale_starts_at) : null;
    const endsAt = product.sale_ends_at ? new Date(product.sale_ends_at) : null;

    if (!product.is_on_sale) return null;
    if (endsAt && endsAt < now) return 'expired';
    if (startsAt && startsAt > now) return 'scheduled';
    return 'active';
}

function resetSaleFields() {
    document.getElementById('product-on-sale').checked = false;
    document.getElementById('sale-type').value = 'fixed';
    document.getElementById('sale-value').value = '';
    document.getElementById('schedule-sale').checked = false;
    document.getElementById('sale-starts').value = '';
    document.getElementById('sale-ends').value = '';
    document.getElementById('sale-options').classList.add('hidden');
    document.getElementById('schedule-options').classList.add('hidden');
    document.getElementById('sale-preview').classList.add('hidden');
    updateSaleTypeLabel();
}

function populateSaleFields(product) {
    if (product.is_on_sale) {
        document.getElementById('product-on-sale').checked = true;
        document.getElementById('sale-options').classList.remove('hidden');

        // Determine sale type based on which field is set
        if (product.sale_percentage) {
            document.getElementById('sale-type').value = 'percentage';
            document.getElementById('sale-value').value = product.sale_percentage;
        } else if (product.sale_price_gbp) {
            document.getElementById('sale-type').value = 'fixed';
            document.getElementById('sale-value').value = product.sale_price_gbp;
        }

        updateSaleTypeLabel();
        updateSalePreview();

        // Schedule fields
        if (product.sale_starts_at || product.sale_ends_at) {
            document.getElementById('schedule-sale').checked = true;
            document.getElementById('schedule-options').classList.remove('hidden');

            if (product.sale_starts_at) {
                // Convert to local datetime-local format
                const startsDate = new Date(product.sale_starts_at);
                document.getElementById('sale-starts').value = formatDatetimeLocal(startsDate);
            }
            if (product.sale_ends_at) {
                const endsDate = new Date(product.sale_ends_at);
                document.getElementById('sale-ends').value = formatDatetimeLocal(endsDate);
            }
        }
    } else {
        resetSaleFields();
    }
}

function formatDatetimeLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setupEventListeners() {
    // Add product button
    document.getElementById('add-product-btn').addEventListener('click', () => openModal());

    // Close modal
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);

    // Form submit
    document.getElementById('product-form').addEventListener('submit', handleSubmit);

    // Image upload
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);

    // Variations input - update variation images section when variations change
    document.getElementById('product-variations').addEventListener('input', debounce(updateVariationImagesSection, 300));

    // Sale pricing toggles and listeners
    document.getElementById('product-on-sale').addEventListener('change', toggleSaleOptions);
    document.getElementById('schedule-sale').addEventListener('change', toggleScheduleOptions);
    document.getElementById('sale-type').addEventListener('change', updateSaleTypeLabel);
    document.getElementById('sale-value').addEventListener('input', updateSalePreview);
    document.getElementById('product-price').addEventListener('input', updateSalePreview);

    // Image picker
    document.getElementById('select-from-library-btn').addEventListener('click', () => openImagePicker(null));
    document.getElementById('close-picker').addEventListener('click', closeImagePicker);
    document.getElementById('picker-overlay').addEventListener('click', closeImagePicker);
    document.getElementById('picker-cancel').addEventListener('click', closeImagePicker);
    document.getElementById('picker-confirm').addEventListener('click', confirmImageSelection);

    // Picker search
    let pickerSearchTimeout;
    document.getElementById('picker-search').addEventListener('input', (e) => {
        clearTimeout(pickerSearchTimeout);
        pickerSearchTimeout = setTimeout(() => loadLibraryImages(e.target.value), 300);
    });

    // Edit/Delete buttons
    document.getElementById('products-list').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const product = products.find(p => p.id === parseInt(editBtn.dataset.id));
            if (product) openModal(product);
        }

        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.id);
            if (confirm('Are you sure you want to delete this product?')) {
                await deleteProduct(id);
            }
        }
    });
}

// Image handling functions
async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxImages = 50;
    if (productImages.length + files.length > maxImages) {
        alert(`Maximum ${maxImages} images/videos allowed`);
        return;
    }

    const statusEl = document.getElementById('upload-status');
    statusEl.textContent = 'Uploading...';

    for (const file of files) {
        try {
            const url = await uploadImage(file);
            if (url) {
                productImages.push(url);
            }
        } catch (err) {
            console.error('Upload failed:', err);
        }
    }

    statusEl.textContent = '';
    renderImagePreviews();
    e.target.value = ''; // Reset input
}

async function uploadImage(file) {
    console.log('Uploading file:', file.name, 'Size:', file.size);

    try {
        // Use secure upload endpoint (authenticates with JWT, uses service_role)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'products');

        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin-upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Upload error:', result);
            alert(`Upload failed: ${result.error || 'Unknown error'}`);
            return null;
        }

        console.log('Upload success:', result);
        return result.url;
    } catch (err) {
        console.error('Upload exception:', err);
        alert(`Upload exception: ${err.message}`);
        return null;
    }
}

// Check if URL is a video
function isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
}

function renderImagePreviews() {
    const container = document.getElementById('image-preview');
    container.innerHTML = productImages.map((url, index) => {
        if (isVideoUrl(url)) {
            return `
                <div class="relative group">
                    <video src="${url}" class="w-full h-20 object-cover rounded-lg" muted></video>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <svg class="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <button type="button" onclick="removeImage(${index})" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                </div>
            `;
        }
        return `
            <div class="relative group">
                <img src="${url}" alt="Product image ${index + 1}" class="w-full h-20 object-cover rounded-lg">
                <button type="button" onclick="removeImage(${index})" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
            </div>
        `;
    }).join('');
}

function removeImage(index) {
    productImages.splice(index, 1);
    renderImagePreviews();
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Update variation images section based on variations input
function updateVariationImagesSection() {
    const variationsInput = document.getElementById('product-variations').value;
    const variations = variationsInput.split(',').map(v => v.trim()).filter(v => v);
    const section = document.getElementById('variation-images-section');

    if (variations.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    renderVariationImagesSection(variations);
}

// Render per-variation image upload sections
function renderVariationImagesSection(variations) {
    const container = document.getElementById('variation-images-container');

    container.innerHTML = variations.map(variation => {
        const images = variationImages[variation] || [];
        return `
            <div class="bg-black/50 rounded-lg p-4" data-variation="${escapeHtml(variation)}">
                <div class="flex items-center justify-between mb-3">
                    <span class="font-medium text-sm">${escapeHtml(variation)}</span>
                    <div class="flex gap-2">
                        <button type="button" onclick="openVariationImagePicker('${escapeHtml(variation)}')" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                            From Library
                        </button>
                        <label class="cursor-pointer px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                            <input type="file" accept="image/*,video/*" multiple class="hidden variation-image-upload" data-variation="${escapeHtml(variation)}">
                            Upload
                        </label>
                    </div>
                </div>
                <div class="variation-image-preview grid grid-cols-4 gap-2" data-variation="${escapeHtml(variation)}">
                    ${images.map((url, index) => {
                        if (isVideoUrl(url)) {
                            return `
                                <div class="relative group">
                                    <video src="${url}" class="w-full h-16 object-cover rounded" muted></video>
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <svg class="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    </div>
                                    <button type="button" onclick="removeVariationImage('${escapeHtml(variation)}', ${index})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                </div>
                            `;
                        }
                        return `
                            <div class="relative group">
                                <img src="${url}" alt="${escapeHtml(variation)} image ${index + 1}" class="w-full h-16 object-cover rounded">
                                <button type="button" onclick="removeVariationImage('${escapeHtml(variation)}', ${index})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${images.length === 0 ? '<p class="text-xs text-gray-500">No images/videos for this variation</p>' : ''}
            </div>
        `;
    }).join('');

    // Add event listeners for variation image uploads
    container.querySelectorAll('.variation-image-upload').forEach(input => {
        input.addEventListener('change', handleVariationImageUpload);
    });
}

// Handle variation-specific image upload
async function handleVariationImageUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const variation = e.target.dataset.variation;
    const maxImages = 50;

    if (!variationImages[variation]) {
        variationImages[variation] = [];
    }

    if (variationImages[variation].length + files.length > maxImages) {
        alert(`Maximum ${maxImages} images/videos per variation`);
        return;
    }

    // Show uploading indicator
    const container = e.target.closest('[data-variation]');
    const preview = container.querySelector('.variation-image-preview');
    preview.innerHTML = '<p class="text-xs text-gray-400 col-span-4">Uploading...</p>';

    for (const file of files) {
        try {
            const url = await uploadImage(file);
            if (url) {
                variationImages[variation].push(url);
            }
        } catch (err) {
            console.error('Variation image upload failed:', err);
        }
    }

    e.target.value = ''; // Reset input

    // Re-render the variation images section
    const variationsInput = document.getElementById('product-variations').value;
    const variations = variationsInput.split(',').map(v => v.trim()).filter(v => v);
    renderVariationImagesSection(variations);
}

// Remove image from a specific variation
function removeVariationImage(variation, index) {
    if (variationImages[variation]) {
        variationImages[variation].splice(index, 1);
        if (variationImages[variation].length === 0) {
            delete variationImages[variation];
        }
    }

    const variationsInput = document.getElementById('product-variations').value;
    const variations = variationsInput.split(',').map(v => v.trim()).filter(v => v);
    renderVariationImagesSection(variations);
}

function openModal(product = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');

    document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';

    if (product) {
        form['id'].value = product.id;
        form['title'].value = product.title;
        form['slug'].value = product.slug;
        form['description'].value = product.description || '';
        form['dimensions'].value = product.dimensions || '';
        form['price_gbp'].value = product.price_gbp;
        form['stock'].value = product.stock;
        form['category'].value = product.category;
        form['tags'].value = (product.tags || []).join(', ');
        form['variations'].value = (product.variations || []).join(', ');
        form['is_active'].checked = product.is_active;
        form['trading_station_url'].value = product.trading_station_url || '';
        // Load existing images
        productImages = product.images || [];
        // Load existing variation images
        variationImages = product.variation_images || {};
        // Load existing colors
        selectedColors = product.colors || [];
        // Populate sale fields
        populateSaleFields(product);
    } else {
        form.reset();
        form['id'].value = '';
        form['is_active'].checked = true;
        productImages = [];
        variationImages = {};
        selectedColors = [];
        // Reset sale fields
        resetSaleFields();
    }

    renderImagePreviews();
    // Update variation images section if there are variations
    updateVariationImagesSection();
    // Update colors display
    renderColorsDropdown();
    updateColorsDisplay();
    updateSelectedColorsTags();
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form['id'].value;

    // Collect sale data
    const isOnSale = document.getElementById('product-on-sale').checked;
    const saleType = document.getElementById('sale-type').value;
    const saleValue = parseFloat(document.getElementById('sale-value').value) || null;
    const isScheduled = document.getElementById('schedule-sale').checked;
    const saleStarts = document.getElementById('sale-starts').value;
    const saleEnds = document.getElementById('sale-ends').value;

    const productData = {
        title: form['title'].value,
        slug: form['slug'].value || undefined,
        description: form['description'].value,
        dimensions: form['dimensions'].value || null,
        price_gbp: parseFloat(form['price_gbp'].value),
        stock: parseInt(form['stock'].value, 10),
        category: form['category'].value,
        tags: form['tags'].value ? form['tags'].value.split(',').map(t => t.trim()).filter(t => t) : [],
        colors: selectedColors,
        variations: form['variations'].value ? form['variations'].value.split(',').map(v => v.trim()).filter(v => v) : [],
        images: productImages,
        variation_images: variationImages,
        is_active: form['is_active'].checked,
        trading_station_url: form['trading_station_url'].value || null,
        // Sale fields
        is_on_sale: isOnSale,
        sale_price_gbp: isOnSale && saleType === 'fixed' ? saleValue : null,
        sale_percentage: isOnSale && saleType === 'percentage' ? saleValue : null,
        sale_starts_at: isOnSale && isScheduled && saleStarts ? new Date(saleStarts).toISOString() : null,
        sale_ends_at: isOnSale && isScheduled && saleEnds ? new Date(saleEnds).toISOString() : null
    };

    if (id) productData.id = parseInt(id, 10);

    try {
        const response = await adminFetch('/api/admin-products', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(productData)
        });

        if (!response || !response.ok) {
            const error = await response?.json();
            throw new Error(error?.error || 'Failed to save product');
        }

        closeModal();
        await loadProducts();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteProduct(id) {
    try {
        const response = await adminFetch(`/api/admin-products?id=${id}`, {
            method: 'DELETE'
        });

        if (!response || !response.ok) {
            throw new Error('Failed to delete product');
        }

        await loadProducts();
    } catch (error) {
        alert(error.message);
    }
}

// ============ Image Picker Functions ============

async function loadLibraryImages(search = '') {
    try {
        const params = new URLSearchParams({ folder: 'products' });
        if (search) params.append('search', search);

        const response = await adminFetch(`/api/admin-media?${params}`);
        if (!response) return;

        const data = await response.json();
        libraryImages = data.images || [];
        renderPickerGrid();
    } catch (error) {
        console.error('Error loading library:', error);
    }
}

function openImagePicker(variation = null) {
    pickerTargetVariation = variation;
    selectedLibraryImages = [];
    document.getElementById('picker-search').value = '';
    document.getElementById('picker-selected-count').textContent = '0 selected';
    document.getElementById('image-picker-modal').classList.remove('hidden');
    loadLibraryImages();
}

function closeImagePicker() {
    document.getElementById('image-picker-modal').classList.add('hidden');
    pickerTargetVariation = null;
    selectedLibraryImages = [];
}

function renderPickerGrid() {
    const grid = document.getElementById('picker-grid');

    if (libraryImages.length === 0) {
        grid.innerHTML = '<p class="text-gray-400 text-center py-8 col-span-full">No images in library. Upload some in the Media page first.</p>';
        return;
    }

    // Determine which images are already used
    const currentImages = pickerTargetVariation
        ? (variationImages[pickerTargetVariation] || [])
        : productImages;

    grid.innerHTML = libraryImages.map(img => {
        const isSelected = selectedLibraryImages.includes(img.url);
        const isAlreadyUsed = currentImages.includes(img.url);

        return `
            <div class="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-soft-blue' : ''} ${isAlreadyUsed ? 'opacity-50' : 'hover:ring-2 hover:ring-white/50'}"
                 data-url="${escapeHtml(img.url)}"
                 data-name="${escapeHtml(img.name)}"
                 ${isAlreadyUsed ? 'data-used="true"' : ''}>
                <img src="${img.url}" alt="${escapeHtml(img.name)}" class="w-full h-full object-cover">
                ${isSelected ? '<div class="absolute inset-0 bg-soft-blue/20 flex items-center justify-center"><svg class="w-8 h-8 text-soft-blue" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
                ${isAlreadyUsed ? '<div class="absolute bottom-0 left-0 right-0 bg-black/80 text-xs text-center py-1">Already added</div>' : ''}
            </div>
        `;
    }).join('');

    // Add click handlers
    grid.querySelectorAll('[data-url]').forEach(el => {
        if (el.dataset.used) return; // Skip already used images

        el.addEventListener('click', () => {
            const url = el.dataset.url;
            const index = selectedLibraryImages.indexOf(url);

            if (index === -1) {
                // Check max images
                const currentCount = pickerTargetVariation
                    ? (variationImages[pickerTargetVariation] || []).length
                    : productImages.length;
                const maxImages = 50;

                if (currentCount + selectedLibraryImages.length >= maxImages) {
                    alert(`Maximum ${maxImages} images/videos allowed`);
                    return;
                }

                selectedLibraryImages.push(url);
            } else {
                selectedLibraryImages.splice(index, 1);
            }

            document.getElementById('picker-selected-count').textContent = `${selectedLibraryImages.length} selected`;
            renderPickerGrid();
        });
    });
}

function confirmImageSelection() {
    if (selectedLibraryImages.length === 0) {
        closeImagePicker();
        return;
    }

    if (pickerTargetVariation) {
        // Adding to a variation
        if (!variationImages[pickerTargetVariation]) {
            variationImages[pickerTargetVariation] = [];
        }
        variationImages[pickerTargetVariation].push(...selectedLibraryImages);

        // Re-render variation images
        const variationsInput = document.getElementById('product-variations').value;
        const variations = variationsInput.split(',').map(v => v.trim()).filter(v => v);
        renderVariationImagesSection(variations);
    } else {
        // Adding to default images
        productImages.push(...selectedLibraryImages);
        renderImagePreviews();
    }

    closeImagePicker();
}

// Add "Select from Library" to variation sections
function openVariationImagePicker(variation) {
    openImagePicker(variation);
}
