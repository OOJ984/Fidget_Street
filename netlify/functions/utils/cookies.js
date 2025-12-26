/**
 * Cookie Utilities for Secure Token Storage
 *
 * Implements httpOnly cookies for JWT storage instead of localStorage.
 * This prevents XSS attacks from stealing session tokens.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Cookie configuration
const COOKIE_CONFIG = {
    ACCESS_TOKEN_NAME: 'fs_access_token',
    REFRESH_TOKEN_NAME: 'fs_refresh_token',
    ACCESS_TOKEN_MAX_AGE: 15 * 60, // 15 minutes
    REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60, // 7 days
    CSRF_TOKEN_NAME: 'fs_csrf_token'
};

/**
 * Generate a CSRF token for double-submit cookie pattern
 */
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a secure cookie string
 */
function createCookie(name, value, maxAge, options = {}) {
    const secure = process.env.NODE_ENV === 'production' ||
                   !process.env.URL?.includes('localhost');

    const parts = [
        `${name}=${value}`,
        `Max-Age=${maxAge}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict'
    ];

    if (secure) {
        parts.push('Secure');
    }

    // For refresh tokens, add extra security
    if (options.path) {
        parts[2] = `Path=${options.path}`;
    }

    return parts.join('; ');
}

/**
 * Create an expired cookie (for logout)
 */
function createExpiredCookie(name) {
    return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

/**
 * Parse cookies from request header
 */
function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};

    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        cookies[name] = valueParts.join('=');
        return cookies;
    }, {});
}

/**
 * Create Set-Cookie headers for login/MFA success
 * Returns object with access token, refresh token, and CSRF token cookies
 */
function createAuthCookies(user, jwtSecret) {
    const csrfToken = generateCSRFToken();

    // Short-lived access token (15 minutes)
    const accessToken = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            mfaVerified: true,
            type: 'access'
        },
        jwtSecret,
        { expiresIn: '15m' }
    );

    // Longer-lived refresh token (7 days)
    const refreshToken = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            type: 'refresh',
            jti: crypto.randomBytes(16).toString('hex') // Unique ID for revocation
        },
        jwtSecret,
        { expiresIn: '7d' }
    );

    return {
        cookies: [
            createCookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, accessToken, COOKIE_CONFIG.ACCESS_TOKEN_MAX_AGE),
            createCookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE, { path: '/api' }),
            createCookie(COOKIE_CONFIG.CSRF_TOKEN_NAME, csrfToken, COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE).replace('HttpOnly; ', '') // CSRF token readable by JS
        ],
        accessToken,
        refreshToken,
        csrfToken
    };
}

/**
 * Create logout cookies (expired)
 */
function createLogoutCookies() {
    return [
        createExpiredCookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME),
        createExpiredCookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME),
        createExpiredCookie(COOKIE_CONFIG.CSRF_TOKEN_NAME)
    ];
}

/**
 * Verify token from cookies
 * Checks both access token and CSRF token
 */
function verifyTokenFromCookies(event, jwtSecret) {
    const cookieHeader = event.headers.cookie || event.headers.Cookie;
    const cookies = parseCookies(cookieHeader);

    const accessToken = cookies[COOKIE_CONFIG.ACCESS_TOKEN_NAME];
    if (!accessToken) {
        return { valid: false, error: 'No access token' };
    }

    // Verify CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.httpMethod)) {
        const csrfHeader = event.headers['x-csrf-token'] || event.headers['X-CSRF-Token'];
        const csrfCookie = cookies[COOKIE_CONFIG.CSRF_TOKEN_NAME];

        if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
            return { valid: false, error: 'CSRF validation failed' };
        }
    }

    try {
        const decoded = jwt.verify(accessToken, jwtSecret);
        if (decoded.type !== 'access') {
            return { valid: false, error: 'Invalid token type' };
        }
        return { valid: true, user: decoded };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token expired', expired: true };
        }
        return { valid: false, error: 'Invalid token' };
    }
}

/**
 * Verify refresh token and issue new tokens
 */
function verifyRefreshToken(event, jwtSecret) {
    const cookieHeader = event.headers.cookie || event.headers.Cookie;
    const cookies = parseCookies(cookieHeader);

    const refreshToken = cookies[COOKIE_CONFIG.REFRESH_TOKEN_NAME];
    if (!refreshToken) {
        return { valid: false, error: 'No refresh token' };
    }

    try {
        const decoded = jwt.verify(refreshToken, jwtSecret);
        if (decoded.type !== 'refresh') {
            return { valid: false, error: 'Invalid token type' };
        }
        return { valid: true, payload: decoded };
    } catch (err) {
        return { valid: false, error: 'Invalid refresh token' };
    }
}

/**
 * Add cookies to response headers
 */
function addCookiesToResponse(response, cookies) {
    // Handle both single cookie and array of cookies
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

    return {
        ...response,
        multiValueHeaders: {
            ...(response.multiValueHeaders || {}),
            'Set-Cookie': cookieArray
        }
    };
}

module.exports = {
    COOKIE_CONFIG,
    generateCSRFToken,
    createCookie,
    createExpiredCookie,
    parseCookies,
    createAuthCookies,
    createLogoutCookies,
    verifyTokenFromCookies,
    verifyRefreshToken,
    addCookiesToResponse
};
