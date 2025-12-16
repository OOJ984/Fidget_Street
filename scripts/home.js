/**
 * Homepage Initialization
 * Loads featured products and Instagram feed
 */

document.addEventListener('DOMContentLoaded', async () => {
    const featuredContainer = document.getElementById('featured-products');
    const instagramContainer = document.getElementById('instagram-feed');

    // Load featured products
    if (featuredContainer) {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            const featured = products.filter(p => p.tags && p.tags.includes('featured')).slice(0, 4);

            // Remove skeleton loaders
            featuredContainer.innerHTML = '';

            featured.forEach(product => {
                featuredContainer.innerHTML += createProductCard(product);
            });
        } catch (error) {
            console.error('Error loading products:', error);
            // Keep skeletons visible on error - they indicate something went wrong
        }
    }

    // Load Instagram feed
    if (instagramContainer) {
        try {
            const response = await fetch('data/instagram_sample.json');
            const posts = await response.json();

            posts.slice(0, 6).forEach(post => {
                instagramContainer.innerHTML += `
                    <a href="${post.link}" class="group relative aspect-square overflow-hidden rounded-lg" target="_blank" rel="noopener noreferrer">
                        <!-- IMAGE_PLACEHOLDER: Instagram post image -->
                        <div class="absolute inset-0 bg-gradient-to-br from-rose-gold/20 to-pastel-pink/20"></div>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <svg class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                        </div>
                    </a>
                `;
            });
        } catch (error) {
            console.error('Error loading Instagram feed:', error);
        }
    }
});
