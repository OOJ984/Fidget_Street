/**
 * FAQ Page Functionality
 * Handles FAQ accordion and category filtering
 */

document.addEventListener('DOMContentLoaded', () => {
    // FAQ accordion functionality
    const faqToggles = document.querySelectorAll('.faq-toggle');

    faqToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const content = toggle.nextElementSibling;
            const icon = toggle.querySelector('svg');
            const isOpen = toggle.getAttribute('aria-expanded') === 'true';

            // Close all other items
            faqToggles.forEach(otherToggle => {
                if (otherToggle !== toggle) {
                    otherToggle.setAttribute('aria-expanded', 'false');
                    otherToggle.nextElementSibling.classList.add('hidden');
                    otherToggle.querySelector('svg').classList.remove('rotate-180');
                    otherToggle.classList.add('rounded-lg');
                    otherToggle.classList.remove('rounded-t-lg');
                }
            });

            // Toggle current item
            toggle.setAttribute('aria-expanded', !isOpen);
            content.classList.toggle('hidden');
            icon.classList.toggle('rotate-180');

            if (!isOpen) {
                toggle.classList.remove('rounded-lg');
                toggle.classList.add('rounded-t-lg');
            } else {
                toggle.classList.add('rounded-lg');
                toggle.classList.remove('rounded-t-lg');
            }
        });
    });

    // Category filtering
    const tabs = document.querySelectorAll('.faq-tab');
    const items = document.querySelectorAll('.faq-item');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;

            // Update active tab
            tabs.forEach(t => {
                t.classList.remove('active', 'border-rose-gold', 'text-rose-gold', 'bg-rose-gold/10');
                t.classList.add('border-white/20', 'text-gray-400');
            });
            tab.classList.add('active', 'border-rose-gold', 'text-rose-gold', 'bg-rose-gold/10');
            tab.classList.remove('border-white/20', 'text-gray-400');

            // Filter items
            items.forEach(item => {
                if (category === 'all' || item.dataset.category === category) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    });
});
