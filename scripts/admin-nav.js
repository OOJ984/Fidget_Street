/**
 * Admin Navigation Dropdown
 * Handles hover dropdown for the "More" menu
 */

document.addEventListener('DOMContentLoaded', function() {
    // Find all dropdown containers
    const dropdowns = document.querySelectorAll('.nav-dropdown');

    dropdowns.forEach(function(dropdown) {
        const menu = dropdown.querySelector('.dropdown-menu');
        if (!menu) return;

        let hideTimeout = null;

        // Show on mouse enter
        dropdown.addEventListener('mouseenter', function() {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            menu.style.display = 'block';
        });

        // Hide on mouse leave with delay
        dropdown.addEventListener('mouseleave', function() {
            hideTimeout = setTimeout(function() {
                menu.style.display = 'none';
            }, 150); // Small delay to allow moving to menu
        });

        // Keep menu open when hovering over the menu itself
        menu.addEventListener('mouseenter', function() {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        menu.addEventListener('mouseleave', function() {
            hideTimeout = setTimeout(function() {
                menu.style.display = 'none';
            }, 150);
        });

        // Also handle click for mobile/touch
        const button = dropdown.querySelector('button');
        if (button) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (menu.style.display === 'block') {
                    menu.style.display = 'none';
                } else {
                    menu.style.display = 'block';
                }
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(function(menu) {
                menu.style.display = 'none';
            });
        }
    });
});
