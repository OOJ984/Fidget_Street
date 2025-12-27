/**
 * Centralized Email Service
 * Uses Resend API for transactional emails
 *
 * Required env vars:
 * - RESEND_API_KEY: Resend API key
 * - EMAIL_FROM: Sender address (default: Fidget Street <orders@fidgetstreet.co.uk>)
 * - URL: Site URL for links in emails
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

// Brand colors
const COLORS = {
    primary: '#71c7e1',      // Soft Blue
    accent: '#FF6F61',       // Coral
    mint: '#A8E0A2',         // Mint Green
    lavender: '#D8B4E2',     // Lavender
    yellow: '#F9F92F',       // Lemon Yellow
    text: '#333333',
    lightText: '#666666',
    lightBg: '#f9f9f9'
};

/**
 * Base email template wrapper
 */
function baseTemplate(content, options = {}) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';
    const { includeUnsubscribe = false, email = '' } = options;

    const unsubscribeSection = includeUnsubscribe && email ? `
        <p style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <a href="${siteUrl}/unsubscribe.html?email=${encodeURIComponent(email)}"
               style="color: ${COLORS.lightText}; font-size: 12px; text-decoration: underline;">
                Unsubscribe from marketing emails
            </a>
        </p>
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${COLORS.lightBg};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.lightBg}; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.mint} 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
                                🎮 Fidget Street
                            </h1>
                            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                                Playful Fidget Toys & Stress Relief
                            </p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: ${COLORS.lightBg}; padding: 20px 30px; text-align: center;">
                            <p style="margin: 0; color: ${COLORS.lightText}; font-size: 12px;">
                                © ${new Date().getFullYear()} Fidget Street. All rights reserved.
                            </p>
                            <p style="margin: 10px 0 0; font-size: 12px;">
                                <a href="${siteUrl}" style="color: ${COLORS.primary}; text-decoration: none;">Visit our store</a>
                                &nbsp;|&nbsp;
                                <a href="${siteUrl}/contact.html" style="color: ${COLORS.primary}; text-decoration: none;">Contact us</a>
                            </p>
                            ${unsubscribeSection}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * Create a styled button
 */
function button(text, url, color = COLORS.accent) {
    return `
        <a href="${url}"
           style="display: inline-block; background-color: ${color}; color: #ffffff;
                  padding: 14px 28px; text-decoration: none; border-radius: 8px;
                  font-weight: 600; font-size: 16px; margin: 10px 0;">
            ${text}
        </a>
    `;
}

/**
 * Send email via Resend API
 */
async function sendEmail({ to, subject, html, from }) {
    const apiKey = process.env.RESEND_API_KEY;
    const defaultFrom = process.env.EMAIL_FROM || 'Fidget Street <Fidget.Street@protonmail.com>';

    if (!apiKey) {
        // Development mode - log to console
        console.log('=== EMAIL (RESEND_API_KEY not configured) ===');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`From: ${from || defaultFrom}`);
        console.log('================================================');
        return { success: true, method: 'console', id: 'dev-mode' };
    }

    try {
        const response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: from || defaultFrom,
                to: Array.isArray(to) ? to : [to],
                subject,
                html
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Resend API error:', error);
            return { success: false, error: error.message || 'Failed to send email' };
        }

        const result = await response.json();
        return { success: true, method: 'resend', id: result.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Order Confirmation Email
 */
async function sendOrderConfirmation(order) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    // Format items table
    const itemsHtml = order.items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                ${item.title}${item.variation ? ` (${item.variation})` : ''}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                ${item.quantity}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                £${(item.price * item.quantity).toFixed(2)}
            </td>
        </tr>
    `).join('');

    // Format address
    const address = order.shipping_address;
    const addressHtml = address ? `
        <p style="margin: 0; color: ${COLORS.text};">
            ${address.line1}<br>
            ${address.line2 ? address.line2 + '<br>' : ''}
            ${address.city}, ${address.postal_code}<br>
            ${address.country}
        </p>
    ` : '<p style="color: ${COLORS.lightText};">No shipping address provided</p>';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            Thank you for your order! 🎉
        </h2>
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            Hi ${order.customer_name || 'there'}, we've received your order and are getting it ready.
        </p>

        <div style="background-color: ${COLORS.lightBg}; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 0 0 5px; font-size: 14px; color: ${COLORS.lightText};">Order Number</p>
            <p style="margin: 0; font-size: 20px; font-weight: 600; color: ${COLORS.primary};">
                ${order.order_number}
            </p>
        </div>

        <h3 style="margin: 25px 0 15px; color: ${COLORS.text}; font-size: 18px; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 8px;">
            Order Details
        </h3>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <thead>
                <tr style="background-color: ${COLORS.lightBg};">
                    <th style="padding: 10px; text-align: left; font-size: 14px; color: ${COLORS.lightText};">Item</th>
                    <th style="padding: 10px; text-align: center; font-size: 14px; color: ${COLORS.lightText};">Qty</th>
                    <th style="padding: 10px; text-align: right; font-size: 14px; color: ${COLORS.lightText};">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
            <tr>
                <td style="padding: 5px 0; color: ${COLORS.lightText};">Subtotal</td>
                <td style="padding: 5px 0; text-align: right;">£${order.subtotal.toFixed(2)}</td>
            </tr>
            ${order.discount_amount ? `
            <tr>
                <td style="padding: 5px 0; color: ${COLORS.mint};">Discount (${order.discount_code})</td>
                <td style="padding: 5px 0; text-align: right; color: ${COLORS.mint};">-£${order.discount_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${order.gift_card_amount ? `
            <tr>
                <td style="padding: 5px 0; color: ${COLORS.lavender};">Gift Card</td>
                <td style="padding: 5px 0; text-align: right; color: ${COLORS.lavender};">-£${order.gift_card_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
                <td style="padding: 5px 0; color: ${COLORS.lightText};">Shipping</td>
                <td style="padding: 5px 0; text-align: right;">${order.shipping > 0 ? '£' + order.shipping.toFixed(2) : 'Free'}</td>
            </tr>
            <tr style="border-top: 2px solid ${COLORS.primary};">
                <td style="padding: 15px 0 5px; font-size: 18px; font-weight: 600;">Total</td>
                <td style="padding: 15px 0 5px; text-align: right; font-size: 18px; font-weight: 600; color: ${COLORS.primary};">
                    £${order.total.toFixed(2)}
                </td>
            </tr>
        </table>

        <h3 style="margin: 25px 0 15px; color: ${COLORS.text}; font-size: 18px; border-bottom: 2px solid ${COLORS.primary}; padding-bottom: 8px;">
            Shipping Address
        </h3>
        ${addressHtml}

        <div style="text-align: center; margin-top: 30px;">
            ${button('View Your Orders', `${siteUrl}/account/orders.html`)}
        </div>

        <p style="color: ${COLORS.lightText}; font-size: 14px; margin-top: 30px; text-align: center;">
            Questions? Reply to this email or <a href="${siteUrl}/contact.html" style="color: ${COLORS.primary};">contact us</a>.
        </p>
    `;

    return sendEmail({
        to: order.customer_email,
        subject: `Order Confirmed! #${order.order_number} 🎮`,
        html: baseTemplate(content)
    });
}

/**
 * Gift Card Delivery Email
 */
async function sendGiftCardDelivery(giftCard) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            You've received a gift! 🎁
        </h2>
        ${giftCard.purchaser_name ? `
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            ${giftCard.purchaser_name} has sent you a Fidget Street gift card!
        </p>
        ` : ''}

        ${giftCard.personal_message ? `
        <div style="background-color: ${COLORS.lightBg}; border-left: 4px solid ${COLORS.lavender}; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-style: italic; color: ${COLORS.text};">
                "${giftCard.personal_message}"
            </p>
        </div>
        ` : ''}

        <div style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.mint} 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 25px;">
            <p style="margin: 0 0 5px; font-size: 14px; color: rgba(255,255,255,0.9);">Gift Card Value</p>
            <p style="margin: 0 0 20px; font-size: 36px; font-weight: 700; color: #ffffff;">
                £${parseFloat(giftCard.initial_balance).toFixed(2)}
            </p>
            <p style="margin: 0 0 5px; font-size: 14px; color: rgba(255,255,255,0.9);">Your Code</p>
            <p style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: 2px; font-family: monospace;">
                ${giftCard.code}
            </p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
            ${button('Shop Now', siteUrl)}
        </div>

        <h3 style="margin: 30px 0 15px; color: ${COLORS.text}; font-size: 16px;">
            How to use your gift card:
        </h3>
        <ol style="color: ${COLORS.text}; padding-left: 20px; line-height: 1.8;">
            <li>Add items to your cart at <a href="${siteUrl}" style="color: ${COLORS.primary};">fidgetstreet.co.uk</a></li>
            <li>At checkout, enter your gift card code</li>
            <li>The balance will be applied to your order</li>
        </ol>

        ${giftCard.expires_at ? `
        <p style="color: ${COLORS.lightText}; font-size: 13px; margin-top: 25px; text-align: center;">
            This gift card expires on ${new Date(giftCard.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
        ` : ''}

        <p style="color: ${COLORS.lightText}; font-size: 13px; text-align: center;">
            <a href="${siteUrl}/check-balance.html" style="color: ${COLORS.primary};">Check your balance</a>
        </p>
    `;

    const recipientEmail = giftCard.recipient_email || giftCard.purchaser_email;
    const recipientName = giftCard.recipient_name || 'there';

    return sendEmail({
        to: recipientEmail,
        subject: `You've received a £${parseFloat(giftCard.initial_balance).toFixed(2)} gift card! 🎁`,
        html: baseTemplate(content)
    });
}

/**
 * Shipping Notification Email
 */
async function sendShippingNotification(order, trackingInfo = {}) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    const trackingSection = trackingInfo.tracking_number ? `
        <div style="background-color: ${COLORS.lightBg}; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 5px; font-size: 14px; color: ${COLORS.lightText};">Tracking Number</p>
            <p style="margin: 0 0 15px; font-size: 18px; font-weight: 600; color: ${COLORS.text}; font-family: monospace;">
                ${trackingInfo.tracking_number}
            </p>
            ${trackingInfo.tracking_url ? `
            <a href="${trackingInfo.tracking_url}"
               style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff;
                      padding: 10px 20px; text-decoration: none; border-radius: 6px;
                      font-weight: 500; font-size: 14px;">
                Track Your Package
            </a>
            ` : `
            <p style="margin: 0; font-size: 14px; color: ${COLORS.lightText};">
                Carrier: ${trackingInfo.carrier || 'Royal Mail'}
            </p>
            `}
        </div>
    ` : '';

    // Format address
    const address = order.shipping_address;
    const addressHtml = address ? `
        <p style="margin: 0; color: ${COLORS.text}; font-size: 14px;">
            ${address.line1}<br>
            ${address.line2 ? address.line2 + '<br>' : ''}
            ${address.city}, ${address.postal_code}<br>
            ${address.country}
        </p>
    ` : '';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            Your order is on its way! 📦
        </h2>
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            Great news! Order <strong>${order.order_number}</strong> has been shipped and is heading your way.
        </p>

        ${trackingSection}

        <h3 style="margin: 25px 0 15px; color: ${COLORS.text}; font-size: 16px;">
            Shipping To:
        </h3>
        <div style="background-color: ${COLORS.lightBg}; border-radius: 8px; padding: 15px;">
            <p style="margin: 0 0 5px; font-weight: 600; color: ${COLORS.text};">${order.customer_name || 'Customer'}</p>
            ${addressHtml}
        </div>

        <h3 style="margin: 25px 0 15px; color: ${COLORS.text}; font-size: 16px;">
            Items Shipped:
        </h3>
        <ul style="padding-left: 20px; color: ${COLORS.text}; line-height: 1.8;">
            ${order.items.map(item => `
                <li>${item.title}${item.variation ? ` (${item.variation})` : ''} × ${item.quantity}</li>
            `).join('')}
        </ul>

        <div style="text-align: center; margin-top: 30px;">
            ${button('View Order Details', `${siteUrl}/account/orders.html`)}
        </div>

        <p style="color: ${COLORS.lightText}; font-size: 14px; margin-top: 30px; text-align: center;">
            Questions about your delivery? <a href="${siteUrl}/contact.html" style="color: ${COLORS.primary};">Contact us</a>
        </p>
    `;

    return sendEmail({
        to: order.customer_email,
        subject: `Your order is on its way! #${order.order_number} 📦`,
        html: baseTemplate(content)
    });
}

/**
 * Admin Password Reset Email
 */
async function sendAdminPasswordReset(email, resetUrl, expiresInMinutes = 60) {
    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            Password Reset Request
        </h2>
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            We received a request to reset your admin password. Click the button below to set a new password.
        </p>

        <div style="text-align: center; margin: 30px 0;">
            ${button('Reset Password', resetUrl)}
        </div>

        <p style="color: ${COLORS.lightText}; font-size: 14px; margin-top: 25px;">
            This link will expire in ${expiresInMinutes} minutes.
        </p>

        <div style="background-color: #FFF3CD; border-radius: 8px; padding: 15px; margin-top: 25px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
                ⚠️ <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
        </div>

        <p style="color: ${COLORS.lightText}; font-size: 12px; margin-top: 25px;">
            For security, this request was received from an admin interface.
            If you have any concerns, please contact the site administrator.
        </p>
    `;

    return sendEmail({
        to: email,
        subject: 'Password Reset - Fidget Street Admin',
        html: baseTemplate(content)
    });
}

/**
 * Magic Link Email (for customer order viewing)
 */
async function sendMagicLink(email, magicLink) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            View Your Orders
        </h2>
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            Click the button below to securely access your order history. This link expires in 15 minutes.
        </p>

        <div style="text-align: center; margin: 30px 0;">
            ${button('View My Orders', magicLink)}
        </div>

        <p style="color: ${COLORS.lightText}; font-size: 14px; margin-top: 25px; text-align: center;">
            If you didn't request this link, you can safely ignore this email.
        </p>
    `;

    return sendEmail({
        to: email,
        subject: 'Access Your Fidget Street Orders',
        html: baseTemplate(content)
    });
}

/**
 * Newsletter Welcome Email
 */
async function sendNewsletterWelcome(email) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            Welcome to Fidget Street! 🎉
        </h2>
        <p style="color: ${COLORS.lightText}; margin: 0 0 25px;">
            Thanks for subscribing! You'll be the first to know about new products, special offers, and fidget tips.
        </p>

        <div style="background-color: ${COLORS.lightBg}; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px; color: ${COLORS.text}; font-size: 16px;">
                What to expect:
            </h3>
            <ul style="padding-left: 20px; color: ${COLORS.text}; line-height: 1.8; margin: 0;">
                <li>New product announcements</li>
                <li>Exclusive subscriber discounts</li>
                <li>Tips for stress relief and focus</li>
                <li>Behind-the-scenes updates</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            ${button('Explore Our Collection', `${siteUrl}/products.html`)}
        </div>
    `;

    return sendEmail({
        to: email,
        subject: 'Welcome to Fidget Street! 🎮',
        html: baseTemplate(content, { includeUnsubscribe: true, email })
    });
}

/**
 * Marketing/Promotional Email
 */
async function sendMarketingEmail(email, { subject, headline, body, ctaText, ctaUrl }) {
    const siteUrl = process.env.URL || 'https://fidgetstreet.co.uk';

    const content = `
        <h2 style="margin: 0 0 10px; color: ${COLORS.text}; font-size: 24px;">
            ${headline}
        </h2>
        <div style="color: ${COLORS.text}; margin: 0 0 25px; line-height: 1.6;">
            ${body}
        </div>

        ${ctaText && ctaUrl ? `
        <div style="text-align: center; margin: 30px 0;">
            ${button(ctaText, ctaUrl)}
        </div>
        ` : ''}
    `;

    return sendEmail({
        to: email,
        subject,
        html: baseTemplate(content, { includeUnsubscribe: true, email })
    });
}

module.exports = {
    sendEmail,
    sendOrderConfirmation,
    sendGiftCardDelivery,
    sendShippingNotification,
    sendAdminPasswordReset,
    sendMagicLink,
    sendNewsletterWelcome,
    sendMarketingEmail,
    baseTemplate,
    button,
    COLORS
};
