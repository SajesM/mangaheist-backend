require('dotenv').config();
const express = require("express");
const connectDb = require("./config/db");
const app = express();
const cors = require("cors");

const userRoute = require("./user/user.router");
const bookmarkRoute = require("./bookmark/bookmark.router");
const mangaRoute = require("./manga/manga.router");
const historyRoute = require("./history/history.router");

const port = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

connectDb();

// ============================================
// CRITICAL: Override fetch to remove Via headers for MangaDex
// This fixes the Render.com proxy issue
// ============================================
const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
    // Only modify MangaDex requests
    if (typeof url === 'string' && url.includes('mangadex.org')) {
        // Clean headers
        const cleanedHeaders = { ...options.headers };
        
        // Remove Via headers (added by Render's proxy)
        delete cleanedHeaders['Via'];
        delete cleanedHeaders['via'];
        delete cleanedHeaders['X-Forwarded-For'];
        delete cleanedHeaders['X-Forwarded-Proto'];
        delete cleanedHeaders['X-Forwarded-Host'];
        
        // Ensure required headers for MangaDex
        cleanedHeaders['User-Agent'] = cleanedHeaders['User-Agent'] || 'MangaHiest-App/1.0';
        cleanedHeaders['Accept'] = cleanedHeaders['Accept'] || 'image/webp,image/apng,image/*,*/*;q=0.8';
        cleanedHeaders['Accept-Language'] = cleanedHeaders['Accept-Language'] || 'en-US,en;q=0.9';
        cleanedHeaders['Connection'] = 'keep-alive';
        
        // Add Referer for MangaDex (required)
        if (!cleanedHeaders['Referer']) {
            cleanedHeaders['Referer'] = 'https://mangadex.org/';
        }
        
        // Create new options with cleaned headers
        const newOptions = {
            ...options,
            headers: cleanedHeaders
        };
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await originalFetch(url, {
                ...newOptions,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    // For non-MangaDex requests, pass through unchanged
    return originalFetch(url, options);
};

// ============================================
// Helper function to add CORS headers
// ============================================
const addCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// ============================================
// Proxy endpoint for MangaDex images (fallback)
// ============================================
app.get('/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    addCorsHeaders(res);
    
    // Security: Only allow MangaDex URLs
    if (!imageUrl.includes('mangadex.org')) {
        return res.status(403).json({ error: 'Invalid image source' });
    }
    
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'MangaHiest-App/1.0',
                    'Referer': 'https://mangadex.org/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                
                const arrayBuffer = await response.arrayBuffer();
                return res.send(Buffer.from(arrayBuffer));
            }
            
            if (response.status === 429) {
                const waitTime = 2000 * (4 - retries);
                console.log(`Rate limited, waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries--;
                continue;
            }
            
            if (response.status === 403) {
                console.error('MangaDex returned 403 - Access denied');
                return res.status(403).json({ 
                    error: 'Access denied by MangaDex',
                    details: 'Your IP or headers may be blocked'
                });
            }
            
            if (!response.ok) {
                return res.status(response.status).json({ 
                    error: 'Failed to fetch image',
                    status: response.status
                });
            }
            
        } catch (error) {
            lastError = error;
            console.error(`Proxy attempt ${4-retries}/3 failed:`, error.message);
            retries--;
            
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    res.status(502).json({ 
        error: 'Failed to fetch image after multiple retries',
        details: lastError?.message || 'Connection closed by remote server'
    });
});

// ============================================
// Health check endpoint
// ============================================
app.get("/", (req, res) => {
    addCorsHeaders(res);
    res.json({ 
        status: "server is running",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// Debug endpoint to check headers (for testing)
// ============================================
app.get('/debug-mangadex', async (req, res) => {
    try {
        const testUrl = 'https://api.mangadex.org/ping';
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'MangaHiest-App/1.0'
            }
        });
        
        res.json({
            success: response.ok,
            status: response.status,
            message: response.ok ? 'MangaDex API is reachable' : 'Failed to reach MangaDex'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            details: error.cause?.message || 'Unknown error'
        });
    }
});

// ============================================
// Routes
// ============================================
app.use("/api/user", userRoute);
app.use("/api/bookmark", bookmarkRoute);
app.use("/api/manga", mangaRoute);
app.use("/api/history", historyRoute);

// Handle OPTIONS preflight for all routes
app.options('*', (req, res) => {
    addCorsHeaders(res);
    res.status(204).send();
});

// ============================================
// Error handling middleware
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    addCorsHeaders(res);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================
// Start server
// ============================================
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`MangaDex proxy enabled`);
});