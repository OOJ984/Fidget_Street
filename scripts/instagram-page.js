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
        const response = await fetch('data/instagram_sample.json');
        const posts = await response.json();

        grid.innerHTML = posts.map(post => `
            <a href="${post.link}" target="_blank" rel="noopener noreferrer" class="group relative aspect-square overflow-hidden rounded-lg">
                <!-- IMAGE_PLACEHOLDER: Instagram post - ${post.caption} -->
                <div class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900"></div>
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity text-center p-4">
                        <div class="flex items-center justify-center space-x-4 mb-2">
                            <span class="flex items-center text-sm">
                                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                ${post.likes}
                            </span>
                            <span class="flex items-center text-sm">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                                </svg>
                                ${post.comments}
                            </span>
                        </div>
                        <p class="text-xs line-clamp-2">${post.caption}</p>
                    </div>
                </div>
            </a>
        `).join('');
    } catch (error) {
        console.error('Error loading Instagram feed:', error);
        grid.innerHTML = '<p class="col-span-full text-center text-gray-500">Unable to load Instagram feed</p>';
    }
}
