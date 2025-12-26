/**
 * Products Page Functionality
 * Handles filtering, sorting, and display of products
 */

let allProducts = [];
let filteredProducts = [];
let activeFilters = {
    category: 'all',
    price: 'all',
    tags: [],
    search: ''
};

document.addEventListener('DOMContentLoaded', async () => {
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const tagParam = urlParams.get('tag');

    if (categoryParam) {
        activeFilters.category = categoryParam;
        const categoryRadio = document.querySelector(`input[name="category"][value="${categoryParam}"]`);
        if (categoryRadio) categoryRadio.checked = true;
    }

    if (tagParam) {
        activeFilters.tags.push(tagParam);
        const tagButton = document.querySelector(`.tag-filter[data-tag="${tagParam}"]`);
        if (tagButton) tagButton.classList.add('active', 'border-soft-blue', 'text-soft-blue');
    }

    // Load products
    await loadProducts();

    // Setup event listeners
    setupFilters();
});

async function loadProducts() {
    const loadingState = document.getElementById('loading-state');
    const productGrid = document.getElementById('product-grid');

    loadingState.classList.remove('hidden');
    productGrid.classList.add('hidden');

    try {
        allProducts = await window.API.fetchProducts();
        applyFilters();
    } catch (error) {
        console.error('Error loading products:', error);
    } finally {
        loadingState.classList.add('hidden');
    }
}

function setupFilters() {
    // Category filters
    document.querySelectorAll('input[name="category"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            activeFilters.category = e.target.value;
            applyFilters();
        });
    });

    // Price filters
    document.querySelectorAll('input[name="price"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            activeFilters.price = e.target.value;
            applyFilters();
        });
    });

    // Tag filters
    document.querySelectorAll('.tag-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            const tag = e.target.dataset.tag;
            const index = activeFilters.tags.indexOf(tag);

            if (index > -1) {
                activeFilters.tags.splice(index, 1);
                e.target.classList.remove('active', 'border-soft-blue', 'text-soft-blue');
            } else {
                activeFilters.tags.push(tag);
                e.target.classList.add('active', 'border-soft-blue', 'text-soft-blue');
            }

            applyFilters();
        });
    });

    // Search
    const searchInput = document.getElementById('product-search');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            activeFilters.search = e.target.value.toLowerCase();
            applyFilters();
        }, 300);
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
        sortProducts(e.target.value);
        renderProducts();
    });

    // Clear filters
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    document.getElementById('reset-filters')?.addEventListener('click', clearAllFilters);

    // Mobile filter toggle
    document.getElementById('filter-toggle').addEventListener('click', () => {
        document.getElementById('filter-panel').classList.toggle('hidden');
    });
}

function applyFilters() {
    filteredProducts = allProducts.filter(product => {
        // Category filter
        if (activeFilters.category !== 'all') {
            if (activeFilters.category === 'organisers') {
                // "organisers" matches both crystal-organisers and charm-organisers
                if (product.category !== 'crystal-organisers' && product.category !== 'charm-organisers') {
                    return false;
                }
            } else if (product.category !== activeFilters.category) {
                return false;
            }
        }

        // Price filter
        if (activeFilters.price !== 'all') {
            const price = product.price_gbp;
            switch (activeFilters.price) {
                case '0-5': if (price >= 5) return false; break;
                case '5-10': if (price < 5 || price >= 10) return false; break;
                case '10-20': if (price < 10 || price >= 20) return false; break;
                case '20+': if (price < 20) return false; break;
            }
        }

        // Tag filter
        if (activeFilters.tags.length > 0) {
            const hasTag = activeFilters.tags.some(tag => product.tags.includes(tag));
            if (!hasTag) return false;
        }

        // Search filter
        if (activeFilters.search) {
            const searchTerm = activeFilters.search;
            const matchTitle = product.title.toLowerCase().includes(searchTerm);
            const matchDesc = product.description?.toLowerCase().includes(searchTerm);
            const matchTags = product.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            if (!matchTitle && !matchDesc && !matchTags) return false;
        }

        return true;
    });

    sortProducts(document.getElementById('sort-select').value);
    renderProducts();
    updateActiveFiltersDisplay();
}

function sortProducts(sortBy) {
    switch (sortBy) {
        case 'newest':
            filteredProducts.sort((a, b) => b.id - a.id);
            break;
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price_gbp - b.price_gbp);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price_gbp - a.price_gbp);
            break;
        case 'name-asc':
            filteredProducts.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'featured':
        default:
            filteredProducts.sort((a, b) => {
                const aFeatured = a.tags.includes('featured') ? 1 : 0;
                const bFeatured = b.tags.includes('featured') ? 1 : 0;
                return bFeatured - aFeatured;
            });
    }
}

function renderProducts() {
    const productGrid = document.getElementById('product-grid');
    const noResults = document.getElementById('no-results');
    const productCount = document.getElementById('product-count');

    productCount.textContent = filteredProducts.length;

    if (filteredProducts.length === 0) {
        productGrid.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');
    productGrid.classList.remove('hidden');
    productGrid.innerHTML = filteredProducts.map(product => createProductCard(product)).join('');
}

function updateActiveFiltersDisplay() {
    const container = document.getElementById('active-filters');
    const hasFilters = activeFilters.category !== 'all' ||
                      activeFilters.price !== 'all' ||
                      activeFilters.tags.length > 0 ||
                      activeFilters.search;

    if (!hasFilters) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.classList.add('flex');

    let filtersHtml = '';

    if (activeFilters.category !== 'all') {
        filtersHtml += `<span class="inline-flex items-center px-3 py-1 bg-soft-blue/20 text-soft-blue rounded-full text-xs">
            ${activeFilters.category.replace('-', ' ')}
            <button onclick="removeFilter('category')" class="ml-2">&times;</button>
        </span>`;
    }

    if (activeFilters.price !== 'all') {
        filtersHtml += `<span class="inline-flex items-center px-3 py-1 bg-soft-blue/20 text-soft-blue rounded-full text-xs">
            £${activeFilters.price}
            <button onclick="removeFilter('price')" class="ml-2">&times;</button>
        </span>`;
    }

    activeFilters.tags.forEach(tag => {
        filtersHtml += `<span class="inline-flex items-center px-3 py-1 bg-soft-blue/20 text-soft-blue rounded-full text-xs">
            ${tag}
            <button onclick="removeTagFilter('${tag}')" class="ml-2">&times;</button>
        </span>`;
    });

    if (activeFilters.search) {
        filtersHtml += `<span class="inline-flex items-center px-3 py-1 bg-soft-blue/20 text-soft-blue rounded-full text-xs">
            "${activeFilters.search}"
            <button onclick="removeFilter('search')" class="ml-2">&times;</button>
        </span>`;
    }

    container.innerHTML = filtersHtml;
}

// Global functions for onclick handlers
function removeFilter(type) {
    if (type === 'category') {
        activeFilters.category = 'all';
        document.querySelector('input[name="category"][value="all"]').checked = true;
    } else if (type === 'price') {
        activeFilters.price = 'all';
        document.querySelector('input[name="price"][value="all"]').checked = true;
    } else if (type === 'search') {
        activeFilters.search = '';
        document.getElementById('product-search').value = '';
    }
    applyFilters();
}

function removeTagFilter(tag) {
    const index = activeFilters.tags.indexOf(tag);
    if (index > -1) {
        activeFilters.tags.splice(index, 1);
        document.querySelector(`.tag-filter[data-tag="${tag}"]`)?.classList.remove('active', 'border-soft-blue', 'text-soft-blue');
    }
    applyFilters();
}

function clearAllFilters() {
    activeFilters = { category: 'all', price: 'all', tags: [], search: '' };
    document.querySelector('input[name="category"][value="all"]').checked = true;
    document.querySelector('input[name="price"][value="all"]').checked = true;
    document.getElementById('product-search').value = '';
    document.querySelectorAll('.tag-filter').forEach(btn => {
        btn.classList.remove('active', 'border-soft-blue', 'text-soft-blue');
    });
    applyFilters();
}
