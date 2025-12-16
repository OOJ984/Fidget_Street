/**
 * Admin Products Page
 * Product management with image uploads and variations
 */

let products = [];
let productImages = []; // Current default images for the product being edited
let variationImages = {}; // Images per variation: { "Gold": ["url1"], "Silver": ["url2"] }
let libraryImages = []; // All images from the media library
let selectedLibraryImages = []; // Currently selected images in the picker
let pickerTargetVariation = null; // Which variation is the picker for (null = default images)
let supabase = null;

// Initialize Supabase client from API config
async function initSupabase() {
    if (supabase) return supabase;

    try {
        const response = await fetch('/api/supabase-config');
        const config = await response.json();
        supabase = window.supabase.createClient(config.url, config.anonKey);
        return supabase;
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

    await loadProducts();
    setupEventListeners();
});

async function loadProducts() {
    try {
        const response = await adminFetch('/api/admin-products');
        if (!response) return;

        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
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
                ${products.map(product => `
                    <tr class="border-t border-white/10">
                        <td class="py-4">
                            <div class="font-medium">${escapeHtml(product.title)}</div>
                            <div class="text-xs text-gray-500">${product.slug}</div>
                        </td>
                        <td class="py-4 text-gray-400">${product.category}</td>
                        <td class="py-4">£${product.price_gbp.toFixed(2)}</td>
                        <td class="py-4">${product.stock}</td>
                        <td class="py-4">
                            <span class="px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}">
                                ${product.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td class="py-4">
                            <button class="text-rose-gold hover:underline mr-3 edit-btn" data-id="${product.id}">Edit</button>
                            <button class="text-red-400 hover:underline delete-btn" data-id="${product.id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    const maxImages = 4;
    if (productImages.length + files.length > maxImages) {
        alert(`Maximum ${maxImages} images allowed`);
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
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    console.log('Uploading file:', filePath, 'Size:', file.size);

    try {
        const { data, error } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error details:', JSON.stringify(error, null, 2));
            alert(`Upload failed: ${error.message || error.error || 'Unknown error'}`);
            return null;
        }

        console.log('Upload success:', data);

        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        console.log('Public URL:', urlData.publicUrl);
        return urlData.publicUrl;
    } catch (err) {
        console.error('Upload exception:', err);
        alert(`Upload exception: ${err.message}`);
        return null;
    }
}

function renderImagePreviews() {
    const container = document.getElementById('image-preview');
    container.innerHTML = productImages.map((url, index) => `
        <div class="relative group">
            <img src="${url}" alt="Product image ${index + 1}" class="w-full h-20 object-cover rounded-lg">
            <button type="button" onclick="removeImage(${index})" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
        </div>
    `).join('');
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
                            <input type="file" accept="image/*" multiple class="hidden variation-image-upload" data-variation="${escapeHtml(variation)}">
                            Upload
                        </label>
                    </div>
                </div>
                <div class="variation-image-preview grid grid-cols-4 gap-2" data-variation="${escapeHtml(variation)}">
                    ${images.map((url, index) => `
                        <div class="relative group">
                            <img src="${url}" alt="${escapeHtml(variation)} image ${index + 1}" class="w-full h-16 object-cover rounded">
                            <button type="button" onclick="removeVariationImage('${escapeHtml(variation)}', ${index})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                        </div>
                    `).join('')}
                </div>
                ${images.length === 0 ? '<p class="text-xs text-gray-500">No images for this variation</p>' : ''}
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
    const maxImages = 4;

    if (!variationImages[variation]) {
        variationImages[variation] = [];
    }

    if (variationImages[variation].length + files.length > maxImages) {
        alert(`Maximum ${maxImages} images per variation`);
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
    } else {
        form.reset();
        form['id'].value = '';
        form['is_active'].checked = true;
        productImages = [];
        variationImages = {};
    }

    renderImagePreviews();
    // Update variation images section if there are variations
    updateVariationImagesSection();
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form['id'].value;

    const productData = {
        title: form['title'].value,
        slug: form['slug'].value || undefined,
        description: form['description'].value,
        price_gbp: parseFloat(form['price_gbp'].value),
        stock: parseInt(form['stock'].value, 10),
        category: form['category'].value,
        tags: form['tags'].value ? form['tags'].value.split(',').map(t => t.trim()).filter(t => t) : [],
        variations: form['variations'].value ? form['variations'].value.split(',').map(v => v.trim()).filter(v => v) : [],
        images: productImages,
        variation_images: variationImages,
        is_active: form['is_active'].checked,
        trading_station_url: form['trading_station_url'].value || null
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
            <div class="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-rose-gold' : ''} ${isAlreadyUsed ? 'opacity-50' : 'hover:ring-2 hover:ring-white/50'}"
                 data-url="${escapeHtml(img.url)}"
                 data-name="${escapeHtml(img.name)}"
                 ${isAlreadyUsed ? 'data-used="true"' : ''}>
                <img src="${img.url}" alt="${escapeHtml(img.name)}" class="w-full h-full object-cover">
                ${isSelected ? '<div class="absolute inset-0 bg-rose-gold/20 flex items-center justify-center"><svg class="w-8 h-8 text-rose-gold" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
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
                const maxImages = 4;

                if (currentCount + selectedLibraryImages.length >= maxImages) {
                    alert(`Maximum ${maxImages} images allowed`);
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
