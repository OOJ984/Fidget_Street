/**
 * Admin Media API
 * GET /api/admin-media - List all images in storage
 * PUT /api/admin-media - Rename an image (copy + delete)
 * DELETE /api/admin-media - Delete an image from storage
 *
 * Required permissions:
 * - GET: VIEW_MEDIA (business_processing, website_admin)
 * - PUT: UPLOAD_MEDIA (business_processing, website_admin)
 * - DELETE: DELETE_MEDIA (business_processing, website_admin)
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

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const BUCKET_NAME = 'product-images';

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'PUT', 'DELETE', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check server configuration
    if (!isSecretConfigured()) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    if (!user) {
        return errorResponse(401, 'Unauthorized', headers);
    }

    try {
        // GET - List all images
        if (event.httpMethod === 'GET') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.VIEW_MEDIA, headers);
            if (permError) return permError;

            const params = event.queryStringParameters || {};
            const folder = params.folder || 'products';
            const search = params.search || '';

            // List files in the bucket
            const { data: files, error } = await supabase.storage
                .from(BUCKET_NAME)
                .list(folder, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('Storage list error:', error);
                throw error;
            }

            // Filter by search term if provided
            let filteredFiles = files || [];
            if (search) {
                const searchLower = search.toLowerCase();
                filteredFiles = filteredFiles.filter(f =>
                    f.name.toLowerCase().includes(searchLower)
                );
            }

            // Build full URLs for each file
            const images = filteredFiles
                .filter(f => !f.id.endsWith('/')) // Exclude folders
                .map(file => {
                    const { data: urlData } = supabase.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(`${folder}/${file.name}`);

                    return {
                        id: file.id,
                        name: file.name,
                        path: `${folder}/${file.name}`,
                        url: urlData.publicUrl,
                        size: file.metadata?.size || 0,
                        created_at: file.created_at,
                        updated_at: file.updated_at
                    };
                });

            return successResponse({ images, total: images.length }, headers);
        }

        // PUT - Rename an image (copy to new name, delete old)
        if (event.httpMethod === 'PUT') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.UPLOAD_MEDIA, headers);
            if (permError) return permError;

            const body = JSON.parse(event.body || '{}');
            const { oldPath, newName } = body;

            if (!oldPath || !newName) {
                return errorResponse(400, 'oldPath and newName required', headers);
            }

            // Validate new name (no special chars except dash/underscore)
            const sanitizedName = newName.replace(/[^a-zA-Z0-9._-]/g, '-');
            const folder = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const oldExt = oldPath.substring(oldPath.lastIndexOf('.'));
            const newPath = `${folder}/${sanitizedName}${oldExt}`;

            // Download the old file
            const { data: fileData, error: downloadError } = await supabase.storage
                .from(BUCKET_NAME)
                .download(oldPath);

            if (downloadError) {
                console.error('Download error:', downloadError);
                return errorResponse(400, 'Failed to download original file', headers);
            }

            // Upload with new name
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(newPath, fileData, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return errorResponse(400, 'Failed to create renamed file. Name may already exist.', headers);
            }

            // Delete old file
            await supabase.storage
                .from(BUCKET_NAME)
                .remove([oldPath]);

            // Get old and new public URLs
            const { data: oldUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(oldPath);
            const { data: newUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(newPath);

            const oldUrl = oldUrlData.publicUrl;
            const newUrl = newUrlData.publicUrl;

            // Update all products that reference this image
            let productsUpdated = 0;
            const { data: products } = await supabase
                .from('products')
                .select('id, images, variation_images');

            if (products) {
                for (const product of products) {
                    let needsUpdate = false;
                    const updates = {};

                    // Check and update default images array
                    if (product.images && product.images.includes(oldUrl)) {
                        updates.images = product.images.map(url => url === oldUrl ? newUrl : url);
                        needsUpdate = true;
                    }

                    // Check and update variation_images
                    if (product.variation_images) {
                        const newVariationImages = { ...product.variation_images };
                        for (const [variation, urls] of Object.entries(newVariationImages)) {
                            if (Array.isArray(urls) && urls.includes(oldUrl)) {
                                newVariationImages[variation] = urls.map(url => url === oldUrl ? newUrl : url);
                                needsUpdate = true;
                            }
                        }
                        if (needsUpdate) {
                            updates.variation_images = newVariationImages;
                        }
                    }

                    if (needsUpdate) {
                        await supabase
                            .from('products')
                            .update(updates)
                            .eq('id', product.id);
                        productsUpdated++;
                    }
                }
            }

            // Audit log - media renamed
            await auditLog({
                action: AUDIT_ACTIONS.MEDIA_RENAMED,
                user,
                resourceType: 'media',
                resourceId: newPath,
                details: { oldPath, newPath, productsUpdated },
                event
            });

            return successResponse({
                success: true,
                oldPath,
                newPath,
                url: newUrl,
                productsUpdated
            }, headers);
        }

        // DELETE - Delete an image
        if (event.httpMethod === 'DELETE') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.DELETE_MEDIA, headers);
            if (permError) return permError;

            const params = event.queryStringParameters || {};
            const path = params.path;

            if (!path) {
                return errorResponse(400, 'Image path required', headers);
            }

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([path]);

            if (error) {
                console.error('Storage delete error:', error);
                throw error;
            }

            // Audit log - media deleted
            await auditLog({
                action: AUDIT_ACTIONS.MEDIA_DELETED,
                user,
                resourceType: 'media',
                resourceId: path,
                event
            });

            return successResponse({ success: true, deleted: path }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin media error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};
