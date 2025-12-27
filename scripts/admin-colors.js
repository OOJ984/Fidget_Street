/**
 * Admin Colors Management
 */

let colors = [];
let editingColorId = null;

// DOM Elements
const colorsContainer = document.getElementById('colors-container');
const colorModal = document.getElementById('color-modal');
const deleteModal = document.getElementById('delete-modal');
const colorForm = document.getElementById('color-form');

// Stats elements
const totalCount = document.getElementById('total-count');
const inStockCount = document.getElementById('in-stock-count');
const outOfStockCount = document.getElementById('out-of-stock-count');

// Form elements
const modalTitle = document.getElementById('modal-title');
const colorIdInput = document.getElementById('color-id');
const colorNameInput = document.getElementById('color-name');
const hexCodeInput = document.getElementById('hex-code');
const hexPicker = document.getElementById('hex-picker');
const inStockCheckbox = document.getElementById('in-stock');
const displayOrderInput = document.getElementById('display-order');
const errorMessage = document.getElementById('error-message');

// Delete modal elements
const deleteColorName = document.getElementById('delete-color-name');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadColors();
    setupEventListeners();
});

function setupEventListeners() {
    // Add button
    document.getElementById('add-color-btn').addEventListener('click', () => openModal());

    // Modal close buttons
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);

    // Delete modal buttons
    document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

    // Form submit
    colorForm.addEventListener('submit', handleSubmit);

    // Hex picker sync
    hexPicker.addEventListener('input', (e) => {
        hexCodeInput.value = e.target.value.toUpperCase();
    });

    hexCodeInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            hexPicker.value = value;
        }
    });

    // Close modals on backdrop click
    colorModal.addEventListener('click', (e) => {
        if (e.target === colorModal) closeModal();
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Event delegation for dynamically created buttons (CSP-compliant)
    colorsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        switch (action) {
            case 'edit':
                editColor(id);
                break;
            case 'delete':
                deleteColor(id);
                break;
            case 'toggle-stock':
                const newStatus = button.dataset.newStatus === 'true';
                toggleStock(id, newStatus);
                break;
            case 'add':
                openModal();
                break;
        }
    });
}

async function loadColors() {
    try {
        const response = await adminFetch('/api/admin-colors');

        if (!response || !response.ok) throw new Error('Failed to load colors');

        colors = await response.json();
        renderColors();
        updateStats();
    } catch (error) {
        console.error('Error loading colors:', error);
        colorsContainer.innerHTML = `
            <div class="text-center py-12 text-red-500">
                Failed to load colors. Please refresh the page.
            </div>
        `;
    }
}

function updateStats() {
    const inStock = colors.filter(c => c.in_stock).length;
    const outStock = colors.filter(c => !c.in_stock).length;

    totalCount.textContent = colors.length;
    inStockCount.textContent = inStock;
    outOfStockCount.textContent = outStock;
}

function renderColors() {
    if (colors.length === 0) {
        colorsContainer.innerHTML = `
            <div class="text-center py-12 text-navy-600">
                <p class="mb-4">No colours yet. Add your first colour to get started!</p>
                <button data-action="add" class="btn-primary px-4 py-2">Add Colour</button>
            </div>
        `;
        return;
    }

    colorsContainer.innerHTML = `
        <table class="w-full">
            <thead class="bg-navy-100/50">
                <tr>
                    <th class="text-left px-6 py-3 text-sm font-medium text-navy-600">Colour</th>
                    <th class="text-left px-6 py-3 text-sm font-medium text-navy-600">Hex</th>
                    <th class="text-center px-6 py-3 text-sm font-medium text-navy-600">Stock Status</th>
                    <th class="text-center px-6 py-3 text-sm font-medium text-navy-600">Order</th>
                    <th class="text-right px-6 py-3 text-sm font-medium text-navy-600">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-navy/10">
                ${colors.map(color => renderColorRow(color)).join('')}
            </tbody>
        </table>
    `;
}

function renderColorRow(color) {
    const swatchStyle = color.hex_code
        ? `background-color: ${color.hex_code}; border: 1px solid rgba(0,0,0,0.2);`
        : 'background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); border: 1px solid rgba(0,0,0,0.2);';

    return `
        <tr class="hover:bg-navy-100/30 ${!color.in_stock ? 'opacity-60' : ''}">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex-shrink-0" style="${swatchStyle}"></div>
                    <span class="font-medium">${escapeHtml(color.name)}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-navy-600 font-mono">
                ${color.hex_code || '-'}
            </td>
            <td class="px-6 py-4 text-center">
                <button data-action="toggle-stock" data-id="${color.id}" data-new-status="${!color.in_stock}"
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        color.in_stock
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }">
                    ${color.in_stock ? `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        In Stock
                    ` : `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Out of Stock
                    `}
                </button>
            </td>
            <td class="px-6 py-4 text-center text-sm text-navy-600">
                ${color.display_order}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button data-action="edit" data-id="${color.id}"
                        class="p-2 text-navy-600 hover:text-soft-blue hover:bg-soft-blue/10 rounded-lg transition-colors"
                        title="Edit">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button data-action="delete" data-id="${color.id}"
                        class="p-2 text-navy-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function openModal(colorId = null) {
    editingColorId = colorId;
    errorMessage.classList.add('hidden');

    if (colorId) {
        const color = colors.find(c => c.id === colorId);
        if (!color) return;

        modalTitle.textContent = 'Edit Colour';
        colorIdInput.value = color.id;
        colorNameInput.value = color.name;
        hexCodeInput.value = color.hex_code || '';
        hexPicker.value = color.hex_code || '#000000';
        inStockCheckbox.checked = color.in_stock;
        displayOrderInput.value = color.display_order || 0;
    } else {
        modalTitle.textContent = 'Add Colour';
        colorForm.reset();
        colorIdInput.value = '';
        hexPicker.value = '#000000';
        inStockCheckbox.checked = true;
        displayOrderInput.value = colors.length;
    }

    colorModal.classList.remove('hidden');
    colorNameInput.focus();
}

function closeModal() {
    colorModal.classList.add('hidden');
    editingColorId = null;
}

function editColor(id) {
    openModal(id);
}

function deleteColor(id) {
    const color = colors.find(c => c.id === id);
    if (!color) {
        console.error('Color not found:', id);
        return;
    }

    editingColorId = id;
    deleteColorName.textContent = color.name;
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    editingColorId = null;
}

async function confirmDelete() {
    if (!editingColorId) {
        alert('Error: No color selected for deletion');
        return;
    }

    try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const response = await fetch('/api/admin-colors', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: editingColorId })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete color');
        }

        closeDeleteModal();
        await loadColors();
    } catch (error) {
        console.error('Error deleting color:', error);
        alert('Delete failed: ' + error.message);
    }
}

async function toggleStock(id, newStatus) {
    const color = colors.find(c => c.id === id);
    if (!color) return;

    try {
        const response = await adminFetch('/api/admin-colors', {
            method: 'PUT',
            body: JSON.stringify({
                id,
                name: color.name,
                hex_code: color.hex_code,
                in_stock: newStatus,
                display_order: color.display_order
            })
        });

        if (!response || !response.ok) {
            const data = response ? await response.json() : {};
            throw new Error(data.error || 'Failed to update stock status');
        }

        await loadColors();
    } catch (error) {
        console.error('Error toggling stock:', error);
        alert(error.message);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    errorMessage.classList.add('hidden');

    const id = colorIdInput.value;
    const name = colorNameInput.value.trim();
    const hex_code = hexCodeInput.value.trim() || null;
    const in_stock = inStockCheckbox.checked;
    const display_order = parseInt(displayOrderInput.value) || 0;

    if (!name) {
        showError('Colour name is required');
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const body = id
            ? { id, name, hex_code, in_stock, display_order }
            : { name, hex_code, in_stock, display_order };

        const response = await adminFetch('/api/admin-colors', {
            method,
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const data = response ? await response.json() : {};
            throw new Error(data.error || 'Failed to save color');
        }

        closeModal();
        await loadColors();
    } catch (error) {
        console.error('Error saving color:', error);
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

// No global exports needed - using event delegation for CSP compliance
