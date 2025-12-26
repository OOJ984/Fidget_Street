/**
 * Admin Email Builder
 * Visual email composition with drag-and-drop blocks
 */

// ==================
// State Management
// ==================
let emailBlocks = [];
let selectedBlockId = null;
let selectedRecipients = [];
let allSubscribers = [];
let products = [];
let globalStyles = {
    backgroundColor: '#ffffff',
    fontFamily: 'Inter, Arial, sans-serif',
    textColor: '#1a3d4d'
};

// Default Templates
const DEFAULT_TEMPLATES = {
    'new-arrivals': {
        name: 'New Arrivals',
        subject: 'New Fidget Toys Just Dropped!',
        blocks: [
            { type: 'header', content: { logoUrl: '', headline: 'Fidget Street' }, styles: { backgroundColor: '#71c7e1', padding: '24px', textAlign: 'center' } },
            { type: 'text', content: { text: 'Check out our latest arrivals!' }, styles: { fontSize: '24px', color: '#1a3d4d', textAlign: 'center', padding: '24px', fontWeight: 'bold' } },
            { type: 'spacer', content: {}, styles: { height: '20px' } },
            { type: 'text', content: { text: 'We\'ve just added some amazing new fidget toys to our collection. Perfect for focus, stress relief, and endless fun!' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'center', padding: '0 24px' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'button', content: { text: 'Shop New Arrivals', url: 'https://fidgetstreet.netlify.app/products.html' }, styles: { backgroundColor: '#71c7e1', color: '#ffffff', padding: '12px 32px', borderRadius: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '32px' } },
            { type: 'divider', content: {}, styles: { color: '#e2e8f0', height: '1px', width: '80%' } },
            { type: 'text', content: { text: 'Follow us @fidget_street' }, styles: { fontSize: '14px', color: '#718096', textAlign: 'center', padding: '24px' } }
        ]
    },
    'sale': {
        name: 'Sale/Promotion',
        subject: 'SALE - Limited Time Offer!',
        blocks: [
            { type: 'header', content: { logoUrl: '', headline: 'Fidget Street' }, styles: { backgroundColor: '#FF6F61', padding: '24px', textAlign: 'center' } },
            { type: 'text', content: { text: 'SALE' }, styles: { fontSize: '48px', color: '#FF6F61', textAlign: 'center', padding: '24px', fontWeight: 'bold' } },
            { type: 'text', content: { text: 'Up to 20% Off Selected Items' }, styles: { fontSize: '20px', color: '#1a3d4d', textAlign: 'center', padding: '0 24px' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'text', content: { text: 'Don\'t miss out on these amazing deals! Limited stock available.' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'center', padding: '0 24px' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'button', content: { text: 'Shop Sale', url: 'https://fidgetstreet.netlify.app/products.html' }, styles: { backgroundColor: '#FF6F61', color: '#ffffff', padding: '14px 40px', borderRadius: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '32px' } },
            { type: 'text', content: { text: 'Use code FIDGET20 at checkout' }, styles: { fontSize: '14px', color: '#718096', textAlign: 'center', padding: '16px', backgroundColor: '#f7fafc' } }
        ]
    },
    'newsletter': {
        name: 'Newsletter',
        subject: 'Fidget Street Newsletter',
        blocks: [
            { type: 'header', content: { logoUrl: '', headline: 'Fidget Street' }, styles: { backgroundColor: '#71c7e1', padding: '24px', textAlign: 'center' } },
            { type: 'text', content: { text: 'Hey there!' }, styles: { fontSize: '24px', color: '#1a3d4d', textAlign: 'left', padding: '24px 24px 8px', fontWeight: 'bold' } },
            { type: 'text', content: { text: 'Welcome to our monthly newsletter! Here\'s what\'s been happening at Fidget Street...' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'left', padding: '8px 24px' } },
            { type: 'divider', content: {}, styles: { color: '#e2e8f0', height: '1px', width: '90%' } },
            { type: 'text', content: { text: 'What\'s New' }, styles: { fontSize: '20px', color: '#1a3d4d', textAlign: 'left', padding: '24px 24px 8px', fontWeight: 'bold' } },
            { type: 'text', content: { text: 'Add your newsletter content here. Share updates, tips, or exciting news with your subscribers!' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'left', padding: '8px 24px 24px' } },
            { type: 'button', content: { text: 'Visit Our Shop', url: 'https://fidgetstreet.netlify.app/' }, styles: { backgroundColor: '#71c7e1', color: '#ffffff', padding: '12px 32px', borderRadius: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '32px' } },
            { type: 'social', content: { instagram: true }, styles: { textAlign: 'center', padding: '16px' } }
        ]
    },
    'announcement': {
        name: 'Announcement',
        subject: 'Important Update from Fidget Street',
        blocks: [
            { type: 'header', content: { logoUrl: '', headline: 'Fidget Street' }, styles: { backgroundColor: '#D8B4E2', padding: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'text', content: { text: 'Important Announcement' }, styles: { fontSize: '28px', color: '#1a3d4d', textAlign: 'center', padding: '0 24px', fontWeight: 'bold' } },
            { type: 'spacer', content: {}, styles: { height: '16px' } },
            { type: 'text', content: { text: 'Add your announcement message here. Keep it clear and concise!' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'center', padding: '0 24px' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'button', content: { text: 'Learn More', url: 'https://fidgetstreet.netlify.app/' }, styles: { backgroundColor: '#D8B4E2', color: '#ffffff', padding: '12px 32px', borderRadius: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '32px' } }
        ]
    },
    'welcome': {
        name: 'Welcome Email',
        subject: 'Welcome to Fidget Street!',
        blocks: [
            { type: 'header', content: { logoUrl: '', headline: 'Fidget Street' }, styles: { backgroundColor: '#A8E0A2', padding: '24px', textAlign: 'center' } },
            { type: 'text', content: { text: 'Welcome to the Fidget Fam!' }, styles: { fontSize: '28px', color: '#1a3d4d', textAlign: 'center', padding: '24px', fontWeight: 'bold' } },
            { type: 'text', content: { text: 'Thanks for subscribing to our newsletter! You\'ll be the first to know about new products, exclusive deals, and fidget tips.' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'center', padding: '0 24px' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'text', content: { text: 'Here\'s 10% off your first order:' }, styles: { fontSize: '16px', color: '#4a5568', textAlign: 'center', padding: '0 24px' } },
            { type: 'text', content: { text: 'WELCOME10' }, styles: { fontSize: '32px', color: '#71c7e1', textAlign: 'center', padding: '16px', fontWeight: 'bold', backgroundColor: '#f0f9ff' } },
            { type: 'spacer', content: {}, styles: { height: '24px' } },
            { type: 'button', content: { text: 'Start Shopping', url: 'https://fidgetstreet.netlify.app/products.html' }, styles: { backgroundColor: '#A8E0A2', color: '#ffffff', padding: '14px 40px', borderRadius: '24px', textAlign: 'center' } },
            { type: 'spacer', content: {}, styles: { height: '32px' } },
            { type: 'social', content: { instagram: true }, styles: { textAlign: 'center', padding: '16px' } }
        ]
    }
};

// Custom templates stored in localStorage
function getCustomTemplates() {
    const saved = localStorage.getItem('fidget_email_templates');
    return saved ? JSON.parse(saved) : {};
}

function saveCustomTemplates(templates) {
    localStorage.setItem('fidget_email_templates', JSON.stringify(templates));
}

// ==================
// Initialization
// ==================
document.addEventListener('DOMContentLoaded', async function() {
    // Check auth
    const token = localStorage.getItem('admin_token');
    const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Display user name
    if (user.name) {
        document.getElementById('user-name').textContent = user.name;
    }

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = 'index.html';
    });

    // Initialize
    await loadSubscribers();
    await loadProducts();
    setupDragAndDrop();
    setupEventListeners();
    updateTemplateDropdown();
    renderCanvas();
});

async function loadSubscribers() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/subscribers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allSubscribers = await response.json();
            updateRecipientCounts();
        }
    } catch (error) {
        console.error('Failed to load subscribers:', error);
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        if (response.ok) {
            const data = await response.json();
            products = data.products || data || [];
        }
    } catch (error) {
        console.error('Failed to load products:', error);
    }
}

function updateRecipientCounts() {
    const active = allSubscribers.filter(s => s.is_active !== false);
    const today = new Date().toISOString().split('T')[0];
    const newToday = active.filter(s => s.subscribed_at && s.subscribed_at.startsWith(today));

    document.getElementById('all-count').textContent = `(${active.length})`;
    document.getElementById('new-today-count').textContent = `(${newToday.length})`;

    // Default to all active
    selectedRecipients = active.map(s => s.email);
}

function updateTemplateDropdown() {
    const select = document.getElementById('template-select');
    const customTemplates = getCustomTemplates();

    // Clear existing options except first
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add default templates
    const defaultGroup = document.createElement('optgroup');
    defaultGroup.label = 'Default Templates';
    Object.entries(DEFAULT_TEMPLATES).forEach(([key, template]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = template.name;
        defaultGroup.appendChild(option);
    });
    select.appendChild(defaultGroup);

    // Add custom templates if any
    const customKeys = Object.keys(customTemplates);
    if (customKeys.length > 0) {
        const customGroup = document.createElement('optgroup');
        customGroup.label = 'My Templates';
        customKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = `custom_${key}`;
            option.textContent = customTemplates[key].name;
            customGroup.appendChild(option);
        });
        select.appendChild(customGroup);
    }
}

// ==================
// Drag and Drop
// ==================
function setupDragAndDrop() {
    // Block palette items - drag AND click to add
    document.querySelectorAll('.block-item').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        // Click to add block (alternative to drag)
        item.addEventListener('click', (e) => {
            const blockType = item.dataset.blockType;
            if (blockType) {
                addBlock(blockType);
            }
        });
    });

    // Canvas drop zone
    const canvas = document.getElementById('email-canvas');
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('dragleave', handleDragLeave);
    canvas.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
    // Find the block-item element (might be clicking on child svg/span)
    const blockItem = e.target.closest('.block-item');
    if (blockItem && blockItem.dataset.blockType) {
        e.dataTransfer.setData('text/plain', blockItem.dataset.blockType);
        e.dataTransfer.effectAllowed = 'copy';
        blockItem.classList.add('opacity-50');
    }
}

function handleDragEnd(e) {
    const blockItem = e.target.closest('.block-item');
    if (blockItem) {
        blockItem.classList.remove('opacity-50');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const blockType = e.dataTransfer.getData('text/plain');
    if (blockType) {
        addBlock(blockType);
    }
}

// ==================
// Block Operations
// ==================
function generateUUID() {
    return 'block_' + Math.random().toString(36).substr(2, 9);
}

function getDefaultBlockContent(type) {
    const defaults = {
        header: { logoUrl: '', headline: 'Fidget Street' },
        text: { text: 'Enter your text here...' },
        image: { url: '', alt: 'Image' },
        button: { text: 'Click Here', url: 'https://fidgetstreet.netlify.app/' },
        divider: {},
        spacer: {},
        product: { productId: null, columns: 1, showPrice: true },
        social: { instagram: true }
    };
    return defaults[type] || {};
}

function getDefaultBlockStyles(type) {
    const defaults = {
        header: { backgroundColor: '#71c7e1', padding: '24px', textAlign: 'center' },
        text: { fontSize: '16px', color: '#4a5568', textAlign: 'left', padding: '16px' },
        image: { width: '100%', textAlign: 'center', padding: '16px', borderRadius: '0' },
        button: { backgroundColor: '#71c7e1', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', textAlign: 'center' },
        divider: { color: '#e2e8f0', height: '1px', width: '100%' },
        spacer: { height: '24px' },
        product: { padding: '16px', textAlign: 'center' },
        social: { textAlign: 'center', padding: '16px' }
    };
    return defaults[type] || { padding: '16px' };
}

function addBlock(type, index = null) {
    const block = {
        id: generateUUID(),
        type: type,
        content: getDefaultBlockContent(type),
        styles: getDefaultBlockStyles(type)
    };

    if (index !== null) {
        emailBlocks.splice(index, 0, block);
    } else {
        emailBlocks.push(block);
    }

    renderCanvas();
    selectBlock(block.id);
}

function deleteBlock(blockId) {
    emailBlocks = emailBlocks.filter(b => b.id !== blockId);
    if (selectedBlockId === blockId) {
        selectedBlockId = null;
        renderStylePanel();
    }
    renderCanvas();
}

function duplicateBlock(blockId) {
    const block = emailBlocks.find(b => b.id === blockId);
    if (block) {
        const index = emailBlocks.indexOf(block);
        const newBlock = {
            ...JSON.parse(JSON.stringify(block)),
            id: generateUUID()
        };
        emailBlocks.splice(index + 1, 0, newBlock);
        renderCanvas();
        selectBlock(newBlock.id);
    }
}

function moveBlock(blockId, direction) {
    const index = emailBlocks.findIndex(b => b.id === blockId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= emailBlocks.length) return;

    const [block] = emailBlocks.splice(index, 1);
    emailBlocks.splice(newIndex, 0, block);
    renderCanvas();
}

function selectBlock(blockId) {
    selectedBlockId = blockId;
    renderCanvas();
    renderStylePanel();
}

function deselectBlock() {
    selectedBlockId = null;
    renderCanvas();
    renderStylePanel();
}

// ==================
// Rendering
// ==================
function renderCanvas() {
    const container = document.getElementById('canvas-blocks');
    const emptyState = document.getElementById('canvas-empty');

    if (emailBlocks.length === 0) {
        emptyState.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');

    container.innerHTML = emailBlocks.map((block, index) => {
        const isSelected = block.id === selectedBlockId;
        return `
            <div class="canvas-block ${isSelected ? 'selected' : ''}" data-block-id="${block.id}" style="font-family: ${globalStyles.fontFamily};">
                <div class="block-actions">
                    <button class="action-btn p-1 bg-white rounded shadow hover:bg-gray-100" data-action="up" data-block="${block.id}" title="Move Up">
                        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                    </button>
                    <button class="action-btn p-1 bg-white rounded shadow hover:bg-gray-100" data-action="down" data-block="${block.id}" title="Move Down">
                        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <button class="action-btn p-1 bg-white rounded shadow hover:bg-gray-100" data-action="duplicate" data-block="${block.id}" title="Duplicate">
                        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                    <button class="action-btn p-1 bg-white rounded shadow hover:bg-red-100 text-red-500" data-action="delete" data-block="${block.id}" title="Delete">
                        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
                ${renderBlockPreview(block)}
            </div>
        `;
    }).join('');

    // Add click handlers for block actions
    container.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const blockId = btn.dataset.block;
            if (action === 'up') moveBlock(blockId, 'up');
            else if (action === 'down') moveBlock(blockId, 'down');
            else if (action === 'duplicate') duplicateBlock(blockId);
            else if (action === 'delete') deleteBlock(blockId);
        });
    });

    // Add click handlers for block selection
    container.querySelectorAll('.canvas-block').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.block-actions')) {
                selectBlock(el.dataset.blockId);
            }
        });
    });

    // Add double-click for inline text editing
    container.querySelectorAll('.editable-text').forEach(el => {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const blockId = el.closest('.canvas-block').dataset.blockId;
            const field = el.dataset.field;
            startInlineEdit(el, blockId, field);
        });
    });
}

function renderBlockPreview(block) {
    const { type, content, styles } = block;
    const styleStr = Object.entries(styles).map(([k, v]) => `${camelToKebab(k)}: ${v}`).join('; ');

    switch (type) {
        case 'header':
            return `
                <div style="${styleStr}">
                    <div class="editable-text" data-field="headline" style="color: white; font-size: 24px; font-weight: bold; font-family: 'Fredoka', sans-serif; cursor: text;">
                        ${escapeHtml(content.headline || 'Fidget Street')}
                    </div>
                </div>
            `;
        case 'text':
            return `<div class="editable-text" data-field="text" style="${styleStr}; cursor: text;">${escapeHtml(content.text || 'Click to edit...')}</div>`;
        case 'image':
            const imgAlign = styles.textAlign || 'center';
            const imgWidth = styles.width || '100%';
            const imgRadius = styles.borderRadius || '0';
            const imgPadding = styles.padding || '16px';
            if (content.url) {
                return `<div style="text-align: ${imgAlign}; padding: ${imgPadding};"><img src="${escapeHtml(content.url)}" alt="${escapeHtml(content.alt || '')}" style="width: ${imgWidth}; max-width: 100%; height: auto; border-radius: ${imgRadius}; display: inline-block;"></div>`;
            }
            return `<div style="text-align: ${imgAlign}; padding: ${imgPadding};"><div style="width: ${imgWidth}; max-width: 100%; background: #f0f0f0; min-height: 100px; display: inline-flex; align-items: center; justify-content: center; color: #999; border-radius: ${imgRadius};">Click to add image URL</div></div>`;
        case 'button':
            return `
                <div style="text-align: ${styles.textAlign || 'center'}; padding: 16px;">
                    <span class="editable-text" data-field="text" style="display: inline-block; background: ${styles.backgroundColor}; color: ${styles.color}; padding: ${styles.padding}; border-radius: ${styles.borderRadius}; font-weight: 500; cursor: text;">
                        ${escapeHtml(content.text || 'Button')}
                    </span>
                </div>
            `;
        case 'divider':
            return `
                <div style="padding: 16px; text-align: center;">
                    <hr style="border: none; height: ${styles.height}; background: ${styles.color}; width: ${styles.width}; margin: 0 auto;">
                </div>
            `;
        case 'spacer':
            return `<div style="height: ${styles.height}; background: repeating-linear-gradient(45deg, transparent, transparent 10px, #f0f0f0 10px, #f0f0f0 20px);"></div>`;
        case 'product':
            const product = products.find(p => p.id === content.productId);
            if (product) {
                return `
                    <div style="${styleStr}">
                        <div style="max-width: 200px; margin: 0 auto;">
                            ${product.images?.[0] ? `<img src="${product.images[0]}" style="width: 100%; border-radius: 8px;">` : ''}
                            <div style="font-weight: 500; margin-top: 8px;">${escapeHtml(product.title)}</div>
                            ${content.showPrice ? `<div style="color: #71c7e1; font-weight: 600;">£${product.price_gbp}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            return `<div style="${styleStr}; background: #f0f0f0; min-height: 80px; display: flex; align-items: center; justify-content: center; color: #999;">Click to select product</div>`;
        case 'social':
            return `
                <div style="${styleStr}">
                    <a href="https://www.instagram.com/fidget_street/" style="color: #71c7e1; text-decoration: none;">
                        Follow us @fidget_street
                    </a>
                </div>
            `;
        default:
            return `<div style="${styleStr}">Unknown block type</div>`;
    }
}

function renderStylePanel() {
    const panel = document.getElementById('style-panel');
    const emptyPanel = document.getElementById('style-panel-empty');
    const controls = document.getElementById('style-controls');

    if (!selectedBlockId) {
        panel.classList.add('hidden');
        emptyPanel.classList.remove('hidden');
        return;
    }

    panel.classList.remove('hidden');
    emptyPanel.classList.add('hidden');

    const block = emailBlocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    controls.innerHTML = getStyleControlsForBlock(block);
    attachStyleListeners(block);
}

function getStyleControlsForBlock(block) {
    const { type, content, styles } = block;
    let html = `<div class="text-xs uppercase text-navy-500 font-semibold mb-2">${type} Block</div>`;

    switch (type) {
        case 'header':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Headline</label>
                        <input type="text" data-content="headline" value="${escapeHtml(content.headline || '')}"
                            class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Background Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="backgroundColor" value="${styles.backgroundColor || '#71c7e1'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="backgroundColor" value="${styles.backgroundColor || '#71c7e1'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'text':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Text Content</label>
                        <textarea data-content="text" rows="4" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded resize-none">${escapeHtml(content.text || '')}</textarea>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Font Size</label>
                        <select data-style="fontSize" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px'].map(s =>
                                `<option value="${s}" ${styles.fontSize === s ? 'selected' : ''}>${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Text Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="color" value="${styles.color || '#4a5568'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="color" value="${styles.color || '#4a5568'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Alignment</label>
                        <div class="flex gap-1">
                            <button data-style-btn="textAlign" data-value="left" class="flex-1 p-2 border rounded ${styles.textAlign === 'left' ? 'bg-soft-blue text-white' : 'border-navy/30'}">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14"/></svg>
                            </button>
                            <button data-style-btn="textAlign" data-value="center" class="flex-1 p-2 border rounded ${styles.textAlign === 'center' ? 'bg-soft-blue text-white' : 'border-navy/30'}">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14"/></svg>
                            </button>
                            <button data-style-btn="textAlign" data-value="right" class="flex-1 p-2 border rounded ${styles.textAlign === 'right' ? 'bg-soft-blue text-white' : 'border-navy/30'}">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M6 18h14"/></svg>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" data-style-check="fontWeight" data-checked-value="bold" data-unchecked-value="normal"
                                ${styles.fontWeight === 'bold' ? 'checked' : ''} class="rounded">
                            <span class="text-xs text-navy-600">Bold</span>
                        </label>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Background Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="backgroundColor" value="${styles.backgroundColor || '#ffffff'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="backgroundColor" value="${styles.backgroundColor || '#ffffff'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'image':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Image URL</label>
                        <input type="text" data-content="url" value="${escapeHtml(content.url || '')}"
                            placeholder="https://..." class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Alt Text</label>
                        <input type="text" data-content="alt" value="${escapeHtml(content.alt || '')}"
                            class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Width</label>
                        <select data-style="width" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['100%', '80%', '60%', '50%', '40%', '30%', '300px', '200px', '150px', '100px'].map(w =>
                                `<option value="${w}" ${styles.width === w ? 'selected' : ''}>${w}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Position</label>
                        <div class="flex gap-1">
                            <button data-style-btn="textAlign" data-value="left" class="flex-1 p-2 border rounded ${styles.textAlign === 'left' ? 'bg-soft-blue text-white' : 'border-navy/30'}" title="Left">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14"/></svg>
                            </button>
                            <button data-style-btn="textAlign" data-value="center" class="flex-1 p-2 border rounded ${styles.textAlign === 'center' ? 'bg-soft-blue text-white' : 'border-navy/30'}" title="Center">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14"/></svg>
                            </button>
                            <button data-style-btn="textAlign" data-value="right" class="flex-1 p-2 border rounded ${styles.textAlign === 'right' ? 'bg-soft-blue text-white' : 'border-navy/30'}" title="Right">
                                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M6 18h14"/></svg>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Border Radius</label>
                        <select data-style="borderRadius" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['0', '4px', '8px', '12px', '16px', '24px', '50%'].map(r =>
                                `<option value="${r}" ${styles.borderRadius === r ? 'selected' : ''}>${r === '0' ? 'None' : r === '50%' ? 'Circle' : r}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Padding</label>
                        <select data-style="padding" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['0', '8px', '16px', '24px', '32px'].map(p =>
                                `<option value="${p}" ${styles.padding === p ? 'selected' : ''}>${p === '0' ? 'None' : p}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            `;
            break;
        case 'button':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Button Text</label>
                        <input type="text" data-content="text" value="${escapeHtml(content.text || '')}"
                            class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Link URL</label>
                        <input type="text" data-content="url" value="${escapeHtml(content.url || '')}"
                            class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Button Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="backgroundColor" value="${styles.backgroundColor || '#71c7e1'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="backgroundColor" value="${styles.backgroundColor || '#71c7e1'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Text Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="color" value="${styles.color || '#ffffff'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="color" value="${styles.color || '#ffffff'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Border Radius</label>
                        <select data-style="borderRadius" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['0', '4px', '8px', '16px', '24px', '32px'].map(r =>
                                `<option value="${r}" ${styles.borderRadius === r ? 'selected' : ''}>${r}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            `;
            break;
        case 'divider':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Line Color</label>
                        <div class="flex gap-2">
                            <input type="color" data-style="color" value="${styles.color || '#e2e8f0'}"
                                class="w-10 h-8 rounded cursor-pointer">
                            <input type="text" data-style-text="color" value="${styles.color || '#e2e8f0'}"
                                class="flex-1 px-2 py-1 text-xs font-mono border border-navy/30 rounded">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Height</label>
                        <select data-style="height" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['1px', '2px', '3px', '4px'].map(h =>
                                `<option value="${h}" ${styles.height === h ? 'selected' : ''}>${h}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Width</label>
                        <select data-style="width" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            ${['100%', '90%', '80%', '60%', '50%'].map(w =>
                                `<option value="${w}" ${styles.width === w ? 'selected' : ''}>${w}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            `;
            break;
        case 'spacer':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Height: <span id="spacer-height-val">${styles.height || '24px'}</span></label>
                        <input type="range" data-style="height" min="8" max="80" value="${parseInt(styles.height) || 24}"
                            class="w-full" oninput="document.getElementById('spacer-height-val').textContent = this.value + 'px'">
                    </div>
                </div>
            `;
            break;
        case 'product':
            html += `
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-navy-600 block mb-1">Select Product</label>
                        <select data-content="productId" class="w-full px-2 py-1.5 text-sm border border-navy/30 rounded">
                            <option value="">-- Select --</option>
                            ${products.map(p =>
                                `<option value="${p.id}" ${content.productId == p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" data-content-check="showPrice" ${content.showPrice ? 'checked' : ''} class="rounded">
                            <span class="text-xs text-navy-600">Show Price</span>
                        </label>
                    </div>
                </div>
            `;
            break;
    }

    // Save as template button
    html += `
        <div class="mt-6 pt-4 border-t border-navy/20">
            <button onclick="saveCurrentAsTemplate()" class="w-full btn-secondary py-2 text-sm">
                Save as Template
            </button>
        </div>
    `;

    return html;
}

function attachStyleListeners(block) {
    const controls = document.getElementById('style-controls');

    // Content inputs
    controls.querySelectorAll('[data-content]').forEach(input => {
        input.addEventListener('input', (e) => {
            block.content[e.target.dataset.content] = e.target.value;
            renderCanvas();
        });
    });

    // Content checkboxes
    controls.querySelectorAll('[data-content-check]').forEach(input => {
        input.addEventListener('change', (e) => {
            block.content[e.target.dataset.contentCheck] = e.target.checked;
            renderCanvas();
        });
    });

    // Style inputs
    controls.querySelectorAll('[data-style]').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value;
            // Handle range inputs for spacer
            if (e.target.type === 'range') {
                value = value + 'px';
            }
            block.styles[e.target.dataset.style] = value;
            // Sync with text input
            const textInput = controls.querySelector(`[data-style-text="${e.target.dataset.style}"]`);
            if (textInput) textInput.value = value;
            renderCanvas();
        });
    });

    // Style text inputs (for color)
    controls.querySelectorAll('[data-style-text]').forEach(input => {
        input.addEventListener('input', (e) => {
            block.styles[e.target.dataset.styleText] = e.target.value;
            // Sync with color picker
            const colorInput = controls.querySelector(`[data-style="${e.target.dataset.styleText}"]`);
            if (colorInput && e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                colorInput.value = e.target.value;
            }
            renderCanvas();
        });
    });

    // Style buttons (alignment)
    controls.querySelectorAll('[data-style-btn]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const prop = btn.dataset.styleBtn;
            const value = btn.dataset.value;
            block.styles[prop] = value;
            renderCanvas();
            renderStylePanel();
        });
    });

    // Style checkboxes
    controls.querySelectorAll('[data-style-check]').forEach(input => {
        input.addEventListener('change', (e) => {
            const prop = e.target.dataset.styleCheck;
            block.styles[prop] = e.target.checked ? e.target.dataset.checkedValue : e.target.dataset.uncheckedValue;
            renderCanvas();
        });
    });
}

// ==================
// Templates
// ==================
function loadTemplate(templateKey) {
    if (!templateKey) {
        emailBlocks = [];
        document.getElementById('email-subject').value = '';
        renderCanvas();
        return;
    }

    let template;
    if (templateKey.startsWith('custom_')) {
        const customKey = templateKey.replace('custom_', '');
        const customTemplates = getCustomTemplates();
        template = customTemplates[customKey];
    } else {
        template = DEFAULT_TEMPLATES[templateKey];
    }

    if (template) {
        emailBlocks = JSON.parse(JSON.stringify(template.blocks)).map(b => ({
            ...b,
            id: generateUUID()
        }));
        document.getElementById('email-subject').value = template.subject || '';
        selectedBlockId = null;
        renderCanvas();
        renderStylePanel();
    }
}

function saveCurrentAsTemplate() {
    const name = prompt('Enter a name for this template:');
    if (!name) return;

    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const customTemplates = getCustomTemplates();

    customTemplates[key] = {
        name: name,
        subject: document.getElementById('email-subject').value,
        blocks: JSON.parse(JSON.stringify(emailBlocks))
    };

    saveCustomTemplates(customTemplates);
    updateTemplateDropdown();
    showToast(`Template "${name}" saved!`);
}

// ==================
// Event Listeners
// ==================
function setupEventListeners() {
    // Template selector
    document.getElementById('template-select').addEventListener('change', (e) => {
        if (emailBlocks.length > 0) {
            if (!confirm('Loading a template will replace your current email. Continue?')) {
                e.target.value = '';
                return;
            }
        }
        loadTemplate(e.target.value);
    });

    // Recipient selection
    document.querySelectorAll('input[name="recipients"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectBtn = document.getElementById('select-recipients-btn');
            if (e.target.value === 'custom') {
                selectBtn.classList.remove('hidden');
            } else {
                selectBtn.classList.add('hidden');
                updateSelectedRecipients(e.target.value);
            }
        });
    });

    document.getElementById('select-recipients-btn').addEventListener('click', openRecipientsModal);

    // Preview button
    document.getElementById('preview-btn').addEventListener('click', openPreview);
    document.getElementById('close-preview').addEventListener('click', closePreview);
    document.getElementById('preview-desktop').addEventListener('click', () => setPreviewMode('desktop'));
    document.getElementById('preview-mobile').addEventListener('click', () => setPreviewMode('mobile'));

    // Send button
    document.getElementById('send-btn').addEventListener('click', openSendModal);
    document.getElementById('close-send').addEventListener('click', closeSendModal);
    document.getElementById('open-email-client').addEventListener('click', openInEmailClient);
    document.getElementById('preview-for-copy').addEventListener('click', openPreviewForCopy);
    document.getElementById('copy-html').addEventListener('click', copyHTML);
    document.getElementById('copy-recipients-list').addEventListener('click', copyRecipients);

    // Recipients modal
    document.getElementById('close-recipients').addEventListener('click', closeRecipientsModal);
    document.getElementById('select-all-recipients').addEventListener('click', () => selectAllInModal(true));
    document.getElementById('deselect-all-recipients').addEventListener('click', () => selectAllInModal(false));
    document.getElementById('recipient-search').addEventListener('input', filterRecipientList);
    document.getElementById('confirm-recipients').addEventListener('click', confirmRecipientSelection);

    // Global styles
    document.getElementById('global-bg-color').addEventListener('input', (e) => {
        globalStyles.backgroundColor = e.target.value;
        document.getElementById('global-bg-color-text').value = e.target.value;
        updateCanvasBackground();
    });
    document.getElementById('global-bg-color-text').addEventListener('input', (e) => {
        if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
            globalStyles.backgroundColor = e.target.value;
            document.getElementById('global-bg-color').value = e.target.value;
            updateCanvasBackground();
        }
    });
    document.getElementById('global-font').addEventListener('change', (e) => {
        globalStyles.fontFamily = e.target.value;
        renderCanvas(); // Re-render with new font
    });

    // Template management
    document.getElementById('manage-templates-btn').addEventListener('click', openTemplatesModal);
    document.getElementById('close-templates').addEventListener('click', closeTemplatesModal);
    document.getElementById('save-template-edit').addEventListener('click', saveTemplateEdit);
    document.getElementById('cancel-template-edit').addEventListener('click', closeEditTemplateModal);

    // Brand color presets
    document.querySelectorAll('.color-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            // Copy to clipboard
            navigator.clipboard.writeText(color);
            showToast(`Color ${color} copied!`);
        });
    });

    // Canvas click to deselect
    document.getElementById('email-canvas').addEventListener('click', (e) => {
        if (e.target.id === 'email-canvas' || e.target.id === 'canvas-empty') {
            deselectBlock();
        }
    });
}

function updateCanvasBackground() {
    document.getElementById('email-canvas').style.backgroundColor = globalStyles.backgroundColor;
}

function updateSelectedRecipients(mode) {
    const active = allSubscribers.filter(s => s.is_active !== false);

    if (mode === 'all') {
        selectedRecipients = active.map(s => s.email);
    } else if (mode === 'new-today') {
        const today = new Date().toISOString().split('T')[0];
        selectedRecipients = active.filter(s => s.subscribed_at && s.subscribed_at.startsWith(today)).map(s => s.email);
    }

    document.getElementById('custom-count').textContent = `(${selectedRecipients.length})`;
}

// ==================
// Recipients Modal
// ==================
function openRecipientsModal() {
    const modal = document.getElementById('recipients-modal');
    const list = document.getElementById('recipient-list');

    const active = allSubscribers.filter(s => s.is_active !== false);

    list.innerHTML = active.map(s => `
        <label class="flex items-center gap-3 p-2 hover:bg-navy-100 rounded cursor-pointer">
            <input type="checkbox" class="recipient-checkbox rounded" data-email="${escapeHtml(s.email)}"
                ${selectedRecipients.includes(s.email) ? 'checked' : ''}>
            <span class="text-sm">${escapeHtml(s.email)}</span>
        </label>
    `).join('');

    updateSelectedCount();
    modal.classList.remove('hidden');
}

function closeRecipientsModal() {
    document.getElementById('recipients-modal').classList.add('hidden');
}

function selectAllInModal(select) {
    document.querySelectorAll('.recipient-checkbox').forEach(cb => {
        if (cb.offsetParent !== null) { // Only visible ones
            cb.checked = select;
        }
    });
    updateSelectedCount();
}

function filterRecipientList() {
    const query = document.getElementById('recipient-search').value.toLowerCase();
    document.querySelectorAll('#recipient-list label').forEach(label => {
        const email = label.querySelector('.recipient-checkbox').dataset.email.toLowerCase();
        label.style.display = email.includes(query) ? '' : 'none';
    });
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.recipient-checkbox:checked').length;
    document.getElementById('selected-count').textContent = `${count} selected`;
}

function confirmRecipientSelection() {
    selectedRecipients = Array.from(document.querySelectorAll('.recipient-checkbox:checked'))
        .map(cb => cb.dataset.email);
    document.getElementById('custom-count').textContent = `(${selectedRecipients.length})`;
    closeRecipientsModal();
}

// ==================
// Preview
// ==================
function openPreview() {
    const modal = document.getElementById('preview-modal');
    const content = document.getElementById('preview-content');

    content.innerHTML = generateEmailHTML(true);
    modal.classList.remove('hidden');
    setPreviewMode('desktop');
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
}

function setPreviewMode(mode) {
    const container = document.getElementById('preview-container');
    const desktopBtn = document.getElementById('preview-desktop');
    const mobileBtn = document.getElementById('preview-mobile');

    if (mode === 'desktop') {
        container.style.width = '600px';
        desktopBtn.classList.add('bg-navy-100', 'text-navy');
        desktopBtn.classList.remove('text-navy-500');
        mobileBtn.classList.remove('bg-navy-100', 'text-navy');
        mobileBtn.classList.add('text-navy-500');
    } else {
        container.style.width = '320px';
        mobileBtn.classList.add('bg-navy-100', 'text-navy');
        mobileBtn.classList.remove('text-navy-500');
        desktopBtn.classList.remove('bg-navy-100', 'text-navy');
        desktopBtn.classList.add('text-navy-500');
    }
}

// ==================
// Send Modal
// ==================
function openSendModal() {
    if (emailBlocks.length === 0) {
        showToast('Please add some content to your email first');
        return;
    }

    const subject = document.getElementById('email-subject').value;
    if (!subject.trim()) {
        showToast('Please add a subject line');
        return;
    }

    if (selectedRecipients.length === 0) {
        showToast('Please select at least one recipient');
        return;
    }

    document.getElementById('send-recipient-count').textContent = selectedRecipients.length;
    document.getElementById('send-subject').textContent = subject;
    document.getElementById('send-modal').classList.remove('hidden');
}

function closeSendModal() {
    document.getElementById('send-modal').classList.add('hidden');
}

function openInEmailClient() {
    const subject = encodeURIComponent(document.getElementById('email-subject').value);
    const body = encodeURIComponent(generatePlainText());

    // Limit recipients for mailto (browsers have URL length limits)
    const maxRecipients = 50;
    let recipients;

    if (selectedRecipients.length > maxRecipients) {
        if (!confirm(`You have ${selectedRecipients.length} recipients. Email clients typically support ~50 in the To field. The first 50 will be added, and you can BCC the rest. Continue?`)) {
            return;
        }
        recipients = selectedRecipients.slice(0, maxRecipients).join(',');
    } else {
        recipients = selectedRecipients.join(',');
    }

    window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
    closeSendModal();
    showToast('Opening email client...');
}

function openPreviewForCopy() {
    const html = generateEmailHTML(false);
    const previewWindow = window.open('', '_blank');

    if (previewWindow) {
        // Write a wrapper with the banner above the email content
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Copy Email for Protonmail</title>
                <style>
                    body { margin: 0; padding: 0; }
                    #copy-banner {
                        background: #71c7e1;
                        color: white;
                        padding: 12px 20px;
                        font-family: sans-serif;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    #copy-banner button {
                        background: white;
                        color: #71c7e1;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    #email-content { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <div id="copy-banner">
                    <span><strong>Copy for Protonmail:</strong> Press Ctrl+A, then Ctrl+C, then paste into Protonmail</span>
                    <button id="close-banner-btn">Close Banner</button>
                </div>
                <div id="email-content">
                    ${html.replace('<!DOCTYPE html>', '').replace('<html>', '').replace('</html>', '').replace(/<head>[\s\S]*?<\/head>/, '')}
                </div>
            </body>
            </html>
        `);
        previewWindow.document.close();

        // Add close handler after document is ready
        previewWindow.document.getElementById('close-banner-btn').addEventListener('click', function() {
            previewWindow.document.getElementById('copy-banner').style.display = 'none';
        });

        closeSendModal();
        showToast('Preview opened - select all & copy!');
    } else {
        showToast('Pop-up blocked! Please allow pop-ups for this site.');
    }
}

async function copyHTML() {
    const html = generateEmailHTML(false);
    await navigator.clipboard.writeText(html);
    showToast('HTML code copied to clipboard!');
}

async function copyRecipients() {
    await navigator.clipboard.writeText(selectedRecipients.join(', '));
    showToast(`${selectedRecipients.length} email addresses copied!`);
}

// ==================
// Email Generation
// ==================
function generateEmailHTML(forPreview = false) {
    const subject = document.getElementById('email-subject').value;

    const blocksHTML = emailBlocks.map(block => renderBlockToEmailHTML(block)).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
    <style>
        body { margin: 0; padding: 0; font-family: ${globalStyles.fontFamily}; }
        img { max-width: 100%; height: auto; }
        a { color: #71c7e1; }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
            <td style="padding:20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background-color:${globalStyles.backgroundColor};">
                    ${blocksHTML}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function renderBlockToEmailHTML(block) {
    const { type, content, styles } = block;

    switch (type) {
        case 'header':
            return `
                <tr>
                    <td style="background-color:${styles.backgroundColor};padding:${styles.padding};text-align:${styles.textAlign};">
                        <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:'Fredoka',Arial,sans-serif;">
                            ${escapeHtml(content.headline || 'Fidget Street')}
                        </span>
                    </td>
                </tr>`;
        case 'text':
            return `
                <tr>
                    <td style="font-size:${styles.fontSize};color:${styles.color};text-align:${styles.textAlign};padding:${styles.padding};font-weight:${styles.fontWeight || 'normal'};background-color:${styles.backgroundColor || 'transparent'};">
                        ${escapeHtml(content.text || '').replace(/\n/g, '<br>')}
                    </td>
                </tr>`;
        case 'image':
            if (!content.url) return '';
            return `
                <tr>
                    <td style="text-align:${styles.textAlign};padding:${styles.padding};">
                        <img src="${escapeHtml(content.url)}" alt="${escapeHtml(content.alt || '')}" style="width:${styles.width};max-width:100%;height:auto;">
                    </td>
                </tr>`;
        case 'button':
            return `
                <tr>
                    <td style="text-align:${styles.textAlign};padding:16px;">
                        <a href="${escapeHtml(content.url || '#')}" style="display:inline-block;background-color:${styles.backgroundColor};color:${styles.color};padding:${styles.padding};border-radius:${styles.borderRadius};text-decoration:none;font-weight:500;">
                            ${escapeHtml(content.text || 'Button')}
                        </a>
                    </td>
                </tr>`;
        case 'divider':
            return `
                <tr>
                    <td style="padding:16px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${styles.width}" style="margin:0 auto;">
                            <tr>
                                <td style="height:${styles.height};background-color:${styles.color};"></td>
                            </tr>
                        </table>
                    </td>
                </tr>`;
        case 'spacer':
            return `
                <tr>
                    <td style="height:${styles.height};"></td>
                </tr>`;
        case 'product':
            const product = products.find(p => p.id === content.productId);
            if (!product) return '';
            return `
                <tr>
                    <td style="text-align:center;padding:${styles.padding};">
                        ${product.images?.[0] ? `<img src="${product.images[0]}" alt="${escapeHtml(product.title)}" style="width:200px;max-width:100%;border-radius:8px;">` : ''}
                        <p style="font-weight:500;margin:8px 0 4px;">${escapeHtml(product.title)}</p>
                        ${content.showPrice ? `<p style="color:#71c7e1;font-weight:600;margin:0;">£${product.price_gbp}</p>` : ''}
                    </td>
                </tr>`;
        case 'social':
            return `
                <tr>
                    <td style="text-align:${styles.textAlign};padding:${styles.padding};">
                        <a href="https://www.instagram.com/fidget_street/" style="color:#71c7e1;text-decoration:none;">
                            Follow us @fidget_street
                        </a>
                    </td>
                </tr>`;
        default:
            return '';
    }
}

function generatePlainText() {
    let text = document.getElementById('email-subject').value + '\n\n';

    emailBlocks.forEach(block => {
        switch (block.type) {
            case 'header':
                text += block.content.headline + '\n\n';
                break;
            case 'text':
                text += block.content.text + '\n\n';
                break;
            case 'button':
                text += `${block.content.text}: ${block.content.url}\n\n`;
                break;
            case 'divider':
                text += '---\n\n';
                break;
            case 'product':
                const product = products.find(p => p.id === block.content.productId);
                if (product) {
                    text += `${product.title}${block.content.showPrice ? ` - £${product.price_gbp}` : ''}\n\n`;
                }
                break;
            case 'social':
                text += 'Follow us on Instagram: @fidget_street\nhttps://www.instagram.com/fidget_street/\n\n';
                break;
        }
    });

    text += '---\nFidget Street\nhttps://fidgetstreet.netlify.app/';

    return text;
}

// ==================
// Utilities
// ==================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Inline text editing
function startInlineEdit(element, blockId, field) {
    const block = emailBlocks.find(b => b.id === blockId);
    if (!block) return;

    const currentText = block.content[field] || '';
    const originalHtml = element.innerHTML;

    // Create input or textarea
    const isMultiline = field === 'text';
    const input = document.createElement(isMultiline ? 'textarea' : 'input');
    input.value = currentText;
    input.style.cssText = `
        width: 100%;
        background: rgba(255,255,255,0.95);
        border: 2px solid #71c7e1;
        border-radius: 4px;
        padding: 8px;
        font-size: inherit;
        font-family: inherit;
        color: #1a3d4d;
        outline: none;
        resize: ${isMultiline ? 'vertical' : 'none'};
        min-height: ${isMultiline ? '80px' : 'auto'};
    `;

    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    const saveEdit = () => {
        const newValue = input.value.trim();
        if (newValue !== currentText) {
            block.content[field] = newValue;
            renderStylePanel(); // Update sidebar
        }
        renderCanvas();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isMultiline) {
            e.preventDefault();
            saveEdit();
        }
        if (e.key === 'Escape') {
            block.content[field] = currentText; // Restore original
            renderCanvas();
        }
    });
}

// ==================
// Template Management
// ==================
function openTemplatesModal() {
    const modal = document.getElementById('templates-modal');
    const list = document.getElementById('templates-list');
    const customTemplates = getCustomTemplates();
    const keys = Object.keys(customTemplates);

    if (keys.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 text-navy-500">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="font-medium mb-1">No saved templates yet</p>
                <p class="text-sm">Build an email and click "Save as Template" to save it here</p>
            </div>
        `;
    } else {
        list.innerHTML = keys.map(key => {
            const template = customTemplates[key];
            return `
                <div class="flex items-center justify-between p-3 border border-navy/20 rounded-lg mb-2 hover:border-soft-blue transition-colors">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-navy truncate">${escapeHtml(template.name)}</div>
                        <div class="text-sm text-navy-500 truncate">${escapeHtml(template.subject || 'No subject')}</div>
                        <div class="text-xs text-navy-400">${template.blocks?.length || 0} blocks</div>
                    </div>
                    <div class="flex items-center gap-2 ml-3">
                        <button onclick="loadTemplateFromManager('${key}')" class="p-2 text-soft-blue hover:bg-soft-blue/10 rounded" title="Load Template">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                            </svg>
                        </button>
                        <button onclick="openEditTemplate('${key}')" class="p-2 text-navy-500 hover:bg-navy-100 rounded" title="Edit">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="updateTemplateContent('${key}')" class="p-2 text-green-600 hover:bg-green-50 rounded" title="Update with current email">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </button>
                        <button onclick="deleteTemplate('${key}')" class="p-2 text-red-500 hover:bg-red-50 rounded" title="Delete">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
}

function closeTemplatesModal() {
    document.getElementById('templates-modal').classList.add('hidden');
}

function loadTemplateFromManager(key) {
    if (emailBlocks.length > 0) {
        if (!confirm('Loading this template will replace your current email. Continue?')) {
            return;
        }
    }
    loadTemplate('custom_' + key);
    closeTemplatesModal();
    showToast('Template loaded!');
}

function openEditTemplate(key) {
    const customTemplates = getCustomTemplates();
    const template = customTemplates[key];
    if (!template) return;

    document.getElementById('edit-template-key').value = key;
    document.getElementById('edit-template-name').value = template.name;
    document.getElementById('edit-template-subject').value = template.subject || '';
    document.getElementById('edit-template-modal').classList.remove('hidden');
}

function closeEditTemplateModal() {
    document.getElementById('edit-template-modal').classList.add('hidden');
}

function saveTemplateEdit() {
    const key = document.getElementById('edit-template-key').value;
    const newName = document.getElementById('edit-template-name').value.trim();
    const newSubject = document.getElementById('edit-template-subject').value.trim();

    if (!newName) {
        showToast('Please enter a template name');
        return;
    }

    const customTemplates = getCustomTemplates();
    if (customTemplates[key]) {
        customTemplates[key].name = newName;
        customTemplates[key].subject = newSubject;
        saveCustomTemplates(customTemplates);
        updateTemplateDropdown();
        closeEditTemplateModal();
        openTemplatesModal(); // Refresh the list
        showToast('Template updated!');
    }
}

function updateTemplateContent(key) {
    if (emailBlocks.length === 0) {
        showToast('Build an email first to update the template');
        return;
    }

    if (!confirm('This will replace the template content with your current email. Continue?')) {
        return;
    }

    const customTemplates = getCustomTemplates();
    if (customTemplates[key]) {
        customTemplates[key].blocks = JSON.parse(JSON.stringify(emailBlocks));
        customTemplates[key].subject = document.getElementById('email-subject').value;
        saveCustomTemplates(customTemplates);
        openTemplatesModal(); // Refresh the list
        showToast('Template content updated!');
    }
}

function deleteTemplate(key) {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
        return;
    }

    const customTemplates = getCustomTemplates();
    delete customTemplates[key];
    saveCustomTemplates(customTemplates);
    updateTemplateDropdown();
    openTemplatesModal(); // Refresh the list
    showToast('Template deleted');
}

// Make functions globally available for onclick handlers
window.deleteBlock = deleteBlock;
window.duplicateBlock = duplicateBlock;
window.moveBlock = moveBlock;
window.saveCurrentAsTemplate = saveCurrentAsTemplate;
window.loadTemplateFromManager = loadTemplateFromManager;
window.openEditTemplate = openEditTemplate;
window.updateTemplateContent = updateTemplateContent;
window.deleteTemplate = deleteTemplate;
