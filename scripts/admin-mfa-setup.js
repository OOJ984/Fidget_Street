/**
 * Admin MFA Setup Page
 * Two-factor authentication setup flow
 */

// Check auth
const token = localStorage.getItem('admin_token');
const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
    window.location.href = '/admin/index.html';
}

// Elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const qrLoading = document.getElementById('qr-loading');
const qrCode = document.getElementById('qr-code');
const secretCode = document.getElementById('secret-code');

let mfaSecret = null;
let backupCodes = [];

// Load MFA setup
async function loadMfaSetup() {
    try {
        const response = await fetch('/api/admin-mfa/setup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load MFA setup');
        }

        mfaSecret = data.secret;
        qrCode.src = data.qrCode;
        qrCode.classList.remove('hidden');
        qrLoading.classList.add('hidden');
        secretCode.textContent = data.secret;

    } catch (error) {
        document.getElementById('step1-error').textContent = error.message;
        document.getElementById('step1-error').classList.remove('hidden');
        qrLoading.innerHTML = '<span class="text-red-400">Failed to load</span>';
    }
}

// Start loading
loadMfaSetup();

// Toggle manual code display
document.getElementById('show-manual').addEventListener('click', () => {
    document.getElementById('manual-code').classList.toggle('hidden');
});

// Step 1 → Step 2
document.getElementById('next-step').addEventListener('click', () => {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    document.getElementById('verify-code').focus();
});

// Back to Step 1
document.getElementById('back-step').addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
});

// Verify MFA code
document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const verifyBtn = document.getElementById('verify-btn');
    const errorEl = document.getElementById('verify-error');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    errorEl.classList.add('hidden');

    try {
        const response = await fetch('/api/admin-mfa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                token: document.getElementById('verify-code').value
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        // Show backup codes
        backupCodes = data.backupCodes;
        const codesContainer = document.querySelector('#backup-codes .grid');
        codesContainer.innerHTML = backupCodes.map(code =>
            `<div class="bg-gray-900 p-2 rounded text-center">${code}</div>`
        ).join('');

        step2.classList.add('hidden');
        step3.classList.remove('hidden');

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Enable Two-Factor Authentication';
        document.getElementById('verify-code').value = '';
        document.getElementById('verify-code').focus();
    }
});

// Copy backup codes
document.getElementById('copy-codes').addEventListener('click', () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-codes');
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';
        setTimeout(() => {
            btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Copy';
        }, 2000);
    });
});

// Download backup codes
document.getElementById('download-codes').addEventListener('click', () => {
    const text = `Wicka Admin - Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wicka-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
});

// Enable continue button when checkbox is checked
document.getElementById('confirm-saved').addEventListener('change', (e) => {
    document.getElementById('continue-btn').disabled = !e.target.checked;
});

// Continue to admin
document.getElementById('continue-btn').addEventListener('click', () => {
    window.location.href = '/admin/dashboard.html';
});
