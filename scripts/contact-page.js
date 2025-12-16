/**
 * Contact Page Functionality
 * Handles contact form submissions
 */

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const successMessage = document.getElementById('contact-success');
    const submitBtn = document.getElementById('contact-submit');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="animate-pulse">Sending...</span>';

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            try {
                // Simulate API call (replace with actual endpoint)
                await new Promise(resolve => setTimeout(resolve, 1000));

                contactForm.classList.add('hidden');
                successMessage.classList.remove('hidden');

            } catch (error) {
                console.error('Error:', error);
                alert('Sorry, there was an error sending your message. Please try again or email us directly.');
            }

            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Message';
        });
    }
});
