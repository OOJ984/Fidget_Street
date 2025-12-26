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
            const response = await fetch('/api/instagram');
            const posts = await response.json();

            instagramContainer.innerHTML = '';

            // Only show posts if we have real ones with images
            if (posts && posts.length > 0) {
                const postsWithImages = posts.filter(p => p.image && p.image.length > 0);
                if (postsWithImages.length > 0) {
                    postsWithImages.slice(0, 6).forEach(post => {
                        instagramContainer.innerHTML += `
                            <a href="${post.link}" class="group relative aspect-square overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow" target="_blank" rel="noopener noreferrer">
                                <img src="${post.image}" alt="${post.caption?.substring(0, 50) || 'Instagram post'}" class="w-full h-full object-cover" loading="lazy">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                    <p class="text-white text-xs line-clamp-2">${post.caption || ''}</p>
                                </div>
                            </a>
                        `;
                    });
                }
            }
            // If no posts with images, the grid stays empty and only the button shows
        } catch (error) {
            console.error('Error loading Instagram feed:', error);
            // On error, just leave empty - button will still show
        }
    }
});
