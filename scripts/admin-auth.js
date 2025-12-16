/**
 * Wicka - Admin Authentication Helpers
 */

// Check if user is authenticated
async function requireAuth() {
    const token = localStorage.getItem('admin_token');

    if (!token) {
        window.location.href = 'index.html';
        return null;
    }

    try {
        const response = await fetch('/api/admin-auth', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!data.valid) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = 'index.html';
            return null;
        }

        return data.user;

    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = 'index.html';
        return null;
    }
}

// Logout
function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = 'index.html';
}

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// API helper with auth
async function adminFetch(url, options = {}) {
    const token = localStorage.getItem('admin_token');

    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (response.status === 401) {
        logout();
        return null;
    }

    return response;
}

// Make functions globally available
window.requireAuth = requireAuth;
window.logout = logout;
window.getAuthHeaders = getAuthHeaders;
window.adminFetch = adminFetch;
