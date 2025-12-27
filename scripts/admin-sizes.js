/**
 * Admin Sizes Management
 */

let sizes = [];
let editingSizeId = null;
let deletingSizeId = null;

// DOM Elements
const sizesContainer = document.getElementById('sizes-container');
const sizeModal = document.getElementById('size-modal');
const deleteModal = document.getElementById('delete-modal');
const sizeForm = document.getElementById('size-form');

// Stats elements
const totalCount = document.getElementById('total-count');

// Form elements
const modalTitle = document.getElementById('modal-title');
const sizeIdInput = document.getElementById('size-id');
const sizeNameInput = document.getElementById('size-name');
const shortCodeInput = document.getElementById('short-code');
const displayOrderInput = document.getElementById('display-order');
const errorMessage = document.getElementById('error-message');

// Delete modal elements
const deleteSizeName = document.getElementById('delete-size-name');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSizes();
    setupEventListeners();
});

function setupEventListeners() {
    // Add button
    document.getElementById('add-size-btn').addEventListener('click', () => openModal());

    // Modal close buttons
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);

    // Delete modal buttons
    document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

    // Form submit
    sizeForm.addEventListener('submit', handleSubmit);

    // Close modals on overlay click
    sizeModal.addEventListener('click', (e) => {
        if (e.target === sizeModal) closeModal();
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Event delegation for dynamically created buttons (CSP-compliant)
    sizesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (action === 'edit') {
            editSize(id);
        } else if (action === 'delete') {
            deleteSize(id);
        }
    });
}

async function loadSizes() {
    try {
        const response = await adminFetch('/api/admin-sizes');

        if (!response || !response.ok) {
            throw new Error('Failed to load sizes');
        }

        sizes = await response.json();
        updateStats();
        renderSizes();
    } catch (error) {
        console.error('Error loading sizes:', error);
        sizesContainer.innerHTML = `
            <div class="text-center py-12 text-navy-600">
                <p>Failed to load sizes. Please refresh the page.</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}

function updateStats() {
    totalCount.textContent = sizes.length;
}

function renderSizes() {
    if (sizes.length === 0) {
        sizesContainer.innerHTML = `
            <div class="text-center py-12 text-navy-600">
                <p>No sizes yet. Click "Add Size" to create your first one.</p>
            </div>
        `;
        return;
    }

    const html = `
        <table class="w-full">
            <thead class="bg-navy-100/50">
                <tr>
                    <th class="text-left px-6 py-4 text-sm font-semibold text-navy-700">Order</th>
                    <th class="text-left px-6 py-4 text-sm font-semibold text-navy-700">Name</th>
                    <th class="text-left px-6 py-4 text-sm font-semibold text-navy-700">Short Code</th>
                    <th class="text-right px-6 py-4 text-sm font-semibold text-navy-700">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-navy/10">
                ${sizes.map(size => `
                    <tr class="hover:bg-navy-100/30 transition-colors">
                        <td class="px-6 py-4 text-sm text-navy-600">${size.display_order || 0}</td>
                        <td class="px-6 py-4">
                            <span class="font-medium">${escapeHtml(size.name)}</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-navy-600">
                            ${size.short_code ? `<span class="bg-navy-100 px-2 py-1 rounded text-xs font-mono">${escapeHtml(size.short_code)}</span>` : '-'}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button data-action="edit" data-id="${size.id}" class="text-soft-blue hover:text-soft-blue/80 mr-3">Edit</button>
                            <button data-action="delete" data-id="${size.id}" class="text-red-500 hover:text-red-600">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    sizesContainer.innerHTML = html;
}

function openModal(size = null) {
    editingSizeId = size?.id || null;
    modalTitle.textContent = size ? 'Edit Size' : 'Add Size';

    // Reset form
    sizeForm.reset();
    errorMessage.classList.add('hidden');

    if (size) {
        sizeIdInput.value = size.id;
        sizeNameInput.value = size.name;
        shortCodeInput.value = size.short_code || '';
        displayOrderInput.value = size.display_order || 0;
    } else {
        sizeIdInput.value = '';
        displayOrderInput.value = sizes.length; // Auto-increment order
    }

    sizeModal.classList.remove('hidden');
    sizeNameInput.focus();
}

function closeModal() {
    sizeModal.classList.add('hidden');
    editingSizeId = null;
}

function editSize(id) {
    const size = sizes.find(s => s.id === id);
    if (size) openModal(size);
}

function deleteSize(id) {
    const size = sizes.find(s => s.id === id);
    if (!size) return;

    deletingSizeId = id;
    deleteSizeName.textContent = size.name;
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    deletingSizeId = null;
}

async function confirmDelete() {
    if (!deletingSizeId) return;

    try {
        const response = await adminFetch('/api/admin-sizes', {
            method: 'DELETE',
            body: JSON.stringify({ id: deletingSizeId })
        });

        if (!response || !response.ok) {
            const data = response ? await response.json() : {};
            throw new Error(data.error || 'Failed to delete size');
        }

        closeDeleteModal();
        await loadSizes();
    } catch (error) {
        console.error('Error deleting size:', error);
        alert('Failed to delete size: ' + error.message);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    errorMessage.classList.add('hidden');

    const sizeData = {
        name: sizeNameInput.value.trim(),
        short_code: shortCodeInput.value.trim() || null,
        display_order: parseInt(displayOrderInput.value) || 0
    };

    if (!sizeData.name) {
        showError('Size name is required');
        return;
    }

    try {
        const isEditing = !!editingSizeId;

        const response = await adminFetch('/api/admin-sizes', {
            method: isEditing ? 'PUT' : 'POST',
            body: JSON.stringify(isEditing ? { ...sizeData, id: editingSizeId } : sizeData)
        });

        if (!response || !response.ok) {
            const data = response ? await response.json() : {};
            throw new Error(data.error || 'Failed to save size');
        }

        closeModal();
        await loadSizes();
    } catch (error) {
        console.error('Error saving size:', error);
        showError(error.message);
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
