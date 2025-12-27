/**
 * Admin Media Library Page
 * Image management with upload, rename, delete functionality
 *
 * IMPORTANT: Do NOT declare a variable named 'supabase' - it conflicts with
 * the global window.supabase object from the Supabase CDN. Use 'supabaseClient' instead.
 */

let images = [];
let selectedImage = null;
let supabaseClient = null;

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

    await loadImages();
    setupEventListeners();
});

async function loadImages(search = '') {
    try {
        const params = new URLSearchParams({ folder: 'products' });
        if (search) params.append('search', search);

        const response = await adminFetch(`/api/admin-media?${params}`);
        if (!response) {
            document.getElementById('media-grid').innerHTML = '<p class="text-red-500 text-center py-8 col-span-full">Authentication failed. Please log in again.</p>';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            document.getElementById('media-grid').innerHTML = `<p class="text-red-500 text-center py-8 col-span-full">Error: ${data.error || 'Failed to load images'}</p>`;
            return;
        }

        images = data.images || [];
        renderImages();
    } catch (error) {
        console.error('Error loading images:', error);
        document.getElementById('media-grid').innerHTML = `<p class="text-red-500 text-center py-8 col-span-full">Error loading images: ${error.message}</p>`;
    }
}

function renderImages() {
    const grid = document.getElementById('media-grid');
    document.getElementById('image-count').textContent = `${images.length} images`;

    if (images.length === 0) {
        grid.innerHTML = '<p class="text-gray-400 text-center py-8 col-span-full">No images yet. Upload some!</p>';
        return;
    }

    grid.innerHTML = images.map(img => `
        <div class="group relative aspect-square bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-soft-blue transition-all" data-path="${escapeHtml(img.path)}" data-url="${escapeHtml(img.url)}" data-name="${escapeHtml(img.name)}">
            <img src="${img.url}" alt="${escapeHtml(img.name)}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span class="text-xs text-center px-2 truncate">${escapeHtml(img.name)}</span>
            </div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupEventListeners() {
    // Search
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadImages(e.target.value), 300);
    });

    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        loadImages();
    });

    // Upload
    document.getElementById('upload-input').addEventListener('change', handleUpload);

    // Image click
    document.getElementById('media-grid').addEventListener('click', (e) => {
        const card = e.target.closest('[data-path]');
        if (card) {
            openModal(card.dataset);
        }
    });

    // Modal close
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);

    // Copy URL
    document.getElementById('copy-url-btn').addEventListener('click', copyUrl);
    document.getElementById('modal-url').addEventListener('click', copyUrl);

    // Delete
    document.getElementById('delete-image-btn').addEventListener('click', deleteImage);

    // Rename
    document.getElementById('rename-btn').addEventListener('click', renameImage);
}

async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const progressContainer = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    progressContainer.classList.remove('hidden');
    let completed = 0;

    const token = localStorage.getItem('admin_token');

    for (const file of files) {
        try {
            // Use secure upload endpoint
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'products');

            const response = await fetch('/api/admin-upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            completed++;
            const percent = Math.round((completed / files.length) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Uploaded ${completed}/${files.length}`;
        } catch (err) {
            console.error('Upload failed:', err);
            showToast(`Failed to upload ${file.name}: ${err.message}`);
        }
    }

    progressText.textContent = 'Complete!';
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        progressBar.style.width = '0%';
    }, 1500);

    e.target.value = '';
    await loadImages();
    showToast(`Uploaded ${completed} image${completed !== 1 ? 's' : ''}`);
}

function openModal(data) {
    selectedImage = data;
    document.getElementById('modal-filename').textContent = data.name;
    document.getElementById('modal-image').src = data.url;
    document.getElementById('modal-url').value = data.url;
    // Set rename input to filename without extension
    const nameWithoutExt = data.name.substring(0, data.name.lastIndexOf('.')) || data.name;
    document.getElementById('modal-rename').value = nameWithoutExt;
    document.getElementById('image-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('image-modal').classList.add('hidden');
    selectedImage = null;
}

function copyUrl() {
    const url = document.getElementById('modal-url').value;
    navigator.clipboard.writeText(url).then(() => {
        showToast('URL copied to clipboard');
    }).catch(() => {
        // Fallback for older browsers
        document.getElementById('modal-url').select();
        document.execCommand('copy');
        showToast('URL copied to clipboard');
    });
}

async function deleteImage() {
    if (!selectedImage) return;

    if (!confirm(`Delete "${selectedImage.name}"? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await adminFetch(`/api/admin-media?path=${encodeURIComponent(selectedImage.path)}`, {
            method: 'DELETE'
        });

        if (!response || !response.ok) {
            throw new Error('Failed to delete');
        }

        closeModal();
        await loadImages();
        showToast('Image deleted');
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete image');
    }
}

async function renameImage() {
    if (!selectedImage) return;

    const newName = document.getElementById('modal-rename').value.trim();
    if (!newName) {
        showToast('Please enter a name');
        return;
    }

    // Check if name actually changed (without extension)
    const currentName = selectedImage.name.substring(0, selectedImage.name.lastIndexOf('.')) || selectedImage.name;
    if (newName === currentName) {
        showToast('Name unchanged');
        return;
    }

    try {
        const response = await adminFetch('/api/admin-media', {
            method: 'PUT',
            body: JSON.stringify({
                oldPath: selectedImage.path,
                newName: newName
            })
        });

        if (!response || !response.ok) {
            const error = await response?.json();
            throw new Error(error?.error || 'Failed to rename');
        }

        const result = await response.json();
        closeModal();
        await loadImages();

        if (result.productsUpdated > 0) {
            showToast(`Renamed! Updated ${result.productsUpdated} product${result.productsUpdated !== 1 ? 's' : ''}`);
        } else {
            showToast('Image renamed');
        }
    } catch (error) {
        console.error('Rename error:', error);
        showToast(error.message || 'Failed to rename image');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.remove('translate-y-full', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}
