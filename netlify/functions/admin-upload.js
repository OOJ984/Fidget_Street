/**
 * Admin Upload API
 * POST /api/admin-upload - Upload images to storage (secure, authenticated)
 *
 * This endpoint handles file uploads securely by:
 * 1. Verifying admin JWT token
 * 2. Using service_role key to upload (bypasses RLS)
 * 3. Returning the public URL
 *
 * Required permissions: UPLOAD_MEDIA
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

// Use service_role key for storage operations (bypasses RLS)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const BUCKET_NAME = 'product-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'Method not allowed', headers);
    }

    // Check server configuration
    if (!isSecretConfigured()) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    if (!process.env.SUPABASE_SERVICE_KEY) {
        console.error('SUPABASE_SERVICE_KEY not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Debug: Log key type (first 10 chars only for safety)
    console.log('Using service key starting with:', process.env.SUPABASE_SERVICE_KEY.substring(0, 10));

    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log('Auth header present:', !!authHeader);
    console.log('Auth header prefix:', authHeader?.substring(0, 20));
    const user = verifyToken(authHeader);
    console.log('User from token:', user ? { userId: user.userId, email: user.email } : null);
    if (!user) {
        return errorResponse(401, 'Unauthorized', headers);
    }

    // Check permission
    const permError = requirePermission(user, PERMISSIONS.UPLOAD_MEDIA, headers);
    if (permError) return permError;

    try {
        // Parse multipart form data
        const contentType = event.headers['content-type'] || event.headers['Content-Type'];

        if (!contentType || !contentType.includes('multipart/form-data')) {
            return errorResponse(400, 'Content-Type must be multipart/form-data', headers);
        }

        // Decode base64 body if needed
        let body = event.body;
        if (event.isBase64Encoded) {
            body = Buffer.from(body, 'base64');
        }

        // Parse the multipart form data
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
            return errorResponse(400, 'Missing boundary in Content-Type', headers);
        }

        const parts = parseMultipart(body, boundary);
        const filePart = parts.find(p => p.filename);
        const folderPart = parts.find(p => p.name === 'folder');

        if (!filePart) {
            return errorResponse(400, 'No file provided', headers);
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(filePart.contentType)) {
            return errorResponse(400, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`, headers);
        }

        // Validate file size
        if (filePart.data.length > MAX_FILE_SIZE) {
            return errorResponse(400, `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, headers);
        }

        // Generate unique filename
        const ext = filePart.filename.split('.').pop().toLowerCase();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const folder = folderPart?.value || 'products';
        const filePath = `${folder}/${uniqueName}`;

        // First check if bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        console.log('Available buckets:', buckets?.map(b => b.name));
        if (listError) {
            console.error('Error listing buckets:', listError);
        }

        // Create bucket if it doesn't exist
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
        if (!bucketExists) {
            console.log('Bucket does not exist, creating:', BUCKET_NAME);
            const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: MAX_FILE_SIZE,
                allowedMimeTypes: ALLOWED_TYPES
            });
            if (createError) {
                console.error('Error creating bucket:', createError);
                // Continue anyway - bucket might exist but not be visible
            } else {
                console.log('Bucket created successfully');
            }
        }

        // Upload to Supabase Storage using service_role (bypasses RLS)
        console.log('Uploading to bucket:', BUCKET_NAME, 'path:', filePath);
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, filePart.data, {
                contentType: filePart.contentType,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Storage upload error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            console.error('Buckets found:', buckets?.map(b => b.name).join(', ') || 'none');
            // SECURITY: Don't expose internal details to client
            return errorResponse(500, 'Upload failed. Please try again.', headers);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        // Audit log
        await auditLog({
            userId: user.userId,
            userEmail: user.email,
            action: AUDIT_ACTIONS.MEDIA_UPLOAD,
            resourceType: 'media',
            resourceId: filePath,
            details: {
                filename: filePart.filename,
                size: filePart.data.length,
                contentType: filePart.contentType
            },
            ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'],
            userAgent: event.headers['user-agent']
        });

        return successResponse({
            success: true,
            path: filePath,
            url: urlData.publicUrl,
            filename: uniqueName,
            size: filePart.data.length
        }, headers);

    } catch (error) {
        console.error('Upload error:', error);
        return errorResponse(500, 'Upload failed', headers);
    }
};

/**
 * Parse multipart form data
 */
function parseMultipart(body, boundary) {
    const parts = [];
    const bodyStr = typeof body === 'string' ? body : body.toString('binary');
    const boundaryStr = `--${boundary}`;
    const sections = bodyStr.split(boundaryStr);

    for (const section of sections) {
        if (section.trim() === '' || section.trim() === '--') continue;

        const headerEnd = section.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headerPart = section.substring(0, headerEnd);
        const dataPart = section.substring(headerEnd + 4);

        // Remove trailing \r\n
        const cleanData = dataPart.replace(/\r\n$/, '');

        // Parse headers
        const headers = {};
        const headerLines = headerPart.split('\r\n');
        for (const line of headerLines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
                const key = line.substring(0, colonIdx).trim().toLowerCase();
                const value = line.substring(colonIdx + 1).trim();
                headers[key] = value;
            }
        }

        const contentDisposition = headers['content-disposition'] || '';
        const nameMatch = contentDisposition.match(/name="([^"]+)"/);
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

        const part = {
            name: nameMatch ? nameMatch[1] : null,
            filename: filenameMatch ? filenameMatch[1] : null,
            contentType: headers['content-type'] || 'application/octet-stream',
            data: Buffer.from(cleanData, 'binary'),
            value: cleanData
        };

        parts.push(part);
    }

    return parts;
}
