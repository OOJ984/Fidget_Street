/**
 * Newsletter Subscription API
 * POST /api/subscribe - Subscribe to newsletter
 *
 * Security: CORS restricted to allowed origins
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const { sendNewsletterWelcome } = require('./utils/email');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { email } = JSON.parse(event.body);

        if (!email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email is required' })
            };
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid email format' })
            };
        }

        const normalizedEmail = email.toLowerCase();

        // Check if already subscribed
        const { data: existing, error: checkError } = await supabase
            .from('newsletter_subscribers')
            .select('id')
            .eq('email', normalizedEmail)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is fine
            console.error('Check error:', checkError);
            throw checkError;
        }

        if (existing) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: "You're already subscribed!"
                })
            };
        }

        // Insert new subscriber
        const { error: insertError } = await supabase
            .from('newsletter_subscribers')
            .insert({
                email: normalizedEmail,
                subscribed_at: new Date().toISOString(),
                source: 'website'
            });

        if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
        }

        // Send welcome email (non-blocking - don't fail subscription if email fails)
        sendNewsletterWelcome(normalizedEmail)
            .then(result => {
                if (result.success) {
                    console.log('Newsletter welcome email sent:', result.id);
                } else {
                    console.error('Newsletter welcome email failed:', result.error);
                }
            })
            .catch(err => console.error('Newsletter welcome email error:', err));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Thanks for subscribing!'
            })
        };

    } catch (error) {
        console.error('Subscribe error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to subscribe. Please try again.' })
        };
    }
};
