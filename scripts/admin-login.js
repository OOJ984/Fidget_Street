/**
 * Admin Login Page
 * Handles authentication with MFA support
 */

// State
let preMfaToken = null;

// Elements
const loginForm = document.getElementById('login-form');
const mfaForm = document.getElementById('mfa-form');
const backupForm = document.getElementById('backup-form');
const errorMsg = document.getElementById('error-message');
const mfaErrorMsg = document.getElementById('mfa-error-message');
const backupErrorMsg = document.getElementById('backup-error-message');

// Check if already logged in
const token = localStorage.getItem('admin_token');
if (token) {
    fetch('/api/admin-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.valid) {
            window.location.href = '/admin/dashboard.html';
        } else {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
        }
    })
    .catch(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
    });
}

// Show/hide forms
function showLoginForm() {
    loginForm.classList.remove('hidden');
    mfaForm.classList.add('hidden');
    backupForm.classList.add('hidden');
    preMfaToken = null;
}

function showMfaForm() {
    loginForm.classList.add('hidden');
    mfaForm.classList.remove('hidden');
    backupForm.classList.add('hidden');
    document.getElementById('mfa-code').focus();
}

function showBackupForm() {
    loginForm.classList.add('hidden');
    mfaForm.classList.add('hidden');
    backupForm.classList.remove('hidden');
    document.getElementById('backup-code').focus();
}

// Fetch with timeout helper
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        throw error;
    }
}

// Handle login form
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorMsg.classList.add('hidden');

    try {
        const response = await fetchWithTimeout('/api/admin-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: loginForm.email.value,
                password: loginForm.password.value
            })
        }, 30000);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        if (data.requiresMfa) {
            // User has MFA enabled, show MFA form
            preMfaToken = data.preMfaToken;
            showMfaForm();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        } else if (data.requiresMfaSetup) {
            // User needs to set up MFA
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            window.location.href = '/admin/mfa-setup.html';
        } else if (data.token) {
            // Direct login (shouldn't happen with mandatory MFA)
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            window.location.href = '/admin/dashboard.html';
        } else {
            throw new Error('Unexpected response');
        }

    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// Handle MFA verification
mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('mfa-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    mfaErrorMsg.classList.add('hidden');

    try {
        const response = await fetchWithTimeout('/api/admin-mfa/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: document.getElementById('mfa-code').value,
                preMfaToken: preMfaToken
            })
        }, 30000);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        // Success! Store token and redirect
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        window.location.href = '/admin/dashboard.html';

    } catch (error) {
        mfaErrorMsg.textContent = error.message;
        mfaErrorMsg.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify';
        document.getElementById('mfa-code').value = '';
        document.getElementById('mfa-code').focus();
    }
});

// Handle backup code verification
backupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('backup-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    backupErrorMsg.classList.add('hidden');

    try {
        const response = await fetchWithTimeout('/api/admin-mfa/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: document.getElementById('backup-code').value.toUpperCase(),
                preMfaToken: preMfaToken
            })
        }, 30000);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        // Success! Store token and redirect
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.user));

        if (data.warning) {
            alert(data.warning);
        }

        window.location.href = '/admin/dashboard.html';

    } catch (error) {
        backupErrorMsg.textContent = error.message;
        backupErrorMsg.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Backup Code';
        document.getElementById('backup-code').value = '';
        document.getElementById('backup-code').focus();
    }
});

// Navigation buttons
document.getElementById('use-backup-btn').addEventListener('click', showBackupForm);
document.getElementById('back-to-login').addEventListener('click', showLoginForm);
document.getElementById('back-to-mfa').addEventListener('click', showMfaForm);
