/**
 * Instagram Page Functionality
 * Handles loading and displaying Instagram feed
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadInstagramFeed();
});

async function loadInstagramFeed() {
    const grid = document.getElementById('instagram-grid');

    try {
        const response = await fetch('/api/instagram');
        const posts = await response.json();

        grid.innerHTML = posts.map(post => {
            const hasImage = post.image && post.image.length > 0;
            return `
            <a href="${post.link}" target="_blank" rel="noopener noreferrer" class="group relative aspect-square overflow-hidden rounded-lg">
                ${hasImage
                    ? `<img src="${post.image}" alt="${post.caption?.substring(0, 50) || 'Instagram post'}" class="w-full h-full object-cover" loading="lazy">`
                    : `<div class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <svg class="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                        </svg>
                    </div>`
                }
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity text-center p-4">
                        <p class="text-xs text-white line-clamp-3">${post.caption || ''}</p>
                    </div>
                </div>
            </a>
        `}).join('');
    } catch (error) {
        console.error('Error loading Instagram feed:', error);
        grid.innerHTML = '<p class="col-span-full text-center text-gray-500">Unable to load Instagram feed</p>';
    }
}
