/**
 * Instagram Feed - Manual Management
 * Serves posts from data/instagram.json
 *
 * To add a new post:
 * 1. Save your Instagram image to assets/instagram/
 * 2. Add entry to data/instagram.json
 */

const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Read posts from JSON file
        const dataPath = path.join(__dirname, '../../data/instagram.json');
        const data = fs.readFileSync(dataPath, 'utf8');
        const posts = JSON.parse(data);

        // Sort by date (newest first) and return up to 12
        const sortedPosts = posts
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 12);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(sortedPosts)
        };

    } catch (error) {
        console.error('Error loading Instagram posts:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };
    }
}
