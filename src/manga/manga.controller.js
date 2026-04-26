const mangaService = require("./manga.service");

// ============================================
// Helper function for retry logic
// ============================================
const fetchWithRetry = async (url, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MangaHiest-App/1.0',
                    'Referer': 'https://mangadex.org/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return response;
            }
            
            // Handle rate limiting with exponential backoff
            if (response.status === 429) {
                const waitTime = 2000 * Math.pow(2, attempt - 1);
                console.log(`Rate limited, waiting ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            // Forbidden might be due to headers - try without Referer on next attempt
            if (response.status === 403 && attempt === 1) {
                console.log('Got 403, retrying without Referer header');
                continue;
            }
            
            // Don't retry client errors (except 429)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                return response;
            }
            
            // For server errors, retry
            if (response.status >= 500 && attempt < maxRetries) {
                console.log(`Server error ${response.status}, retrying (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            
            return response;
            
        } catch (error) {
            lastError = error;
            console.log(`Fetch attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const waitTime = 2000 * attempt;
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw lastError || new Error('All retry attempts failed');
};

// ============================================
// Controller functions
// ============================================

const getTrending = async (req, res) => {
    try {
        const data = await mangaService.getTrending();
        res.json(data);
    } catch (error) {
        console.error('Error in getTrending:', error);
        res.status(500).json({ message: "Mangadex error ", error: error.message });
    }
};

const getList = async (req, res) => {
    try {
        const limit = req.query.limit || 20;
        const data = await mangaService.getListOfManga(limit);
        res.json(data);
    } catch (error) { 
        console.error('Error in getList:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const getLatest = async (req, res) => {
    try {
        const data = await mangaService.getLatestManga();
        res.json(data);
    } catch (error) { 
        console.error('Error in getLatest:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const search = async (req, res) => {
    try {
        const data = await mangaService.searchManga(req.query.title);
        res.json(data);
    } catch (error) { 
        console.error('Error in search:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const getChapters = async (req, res) => {
    try {
        const data = await mangaService.getMangaChapters(req.params.mangaId);
        res.json(data);
    } catch (error) { 
        console.error('Error in getChapters:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const getPages = async (req, res) => {
    try {
        const data = await mangaService.getMangaPages(req.params.chapterId);
        res.json(data);
    } catch (error) { 
        console.error('Error in getPages:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const getManga = async (req, res) => {
    try {
        const data = await mangaService.getMangaById(req.params.mangaId);
        res.json(data);
    } catch (error) { 
        console.error('Error in getManga:', error);
        res.status(500).json({ message: error.message }); 
    }
};

const getCover = async (req, res) => {
    const { mangaId, fileName } = req.params;
    
    try {
        const url = `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
        console.log(`Fetching cover: ${fileName}`);
        
        const response = await fetchWithRetry(url);
        
        if (!response.ok) {
            console.error(`Cover fetch failed: ${response.status} for ${fileName}`);
            return res.status(response.status).json({ 
                message: 'Failed to fetch cover',
                status: response.status 
            });
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Cache for 24 hours
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', `"${Buffer.from(arrayBuffer).length}"`);
        
        res.send(Buffer.from(arrayBuffer));
        
    } catch (error) {
        console.error("Error fetching cover:", error);
        res.status(502).json({ 
            message: 'Error fetching cover image', 
            error: error.message,
            details: 'Unable to reach MangaDex servers'
        });
    }
};

const getPage = async (req, res) => {
    const { hash, fileName } = req.params;
    
    try {
        const url = `https://uploads.mangadex.org/data/${hash}/${fileName}`;
        console.log(`Fetching page: ${fileName.substring(0, 30)}...`);
        
        const response = await fetchWithRetry(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ message: 'Page not found' });
            }
            console.error(`Page fetch failed: ${response.status} for ${fileName}`);
            return res.status(response.status).json({ 
                message: 'Failed to fetch page',
                status: response.status 
            });
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Cache for 1 hour
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('ETag', `"${Buffer.from(arrayBuffer).length}"`);
        
        res.send(Buffer.from(arrayBuffer));
        
    } catch (error) { 
        console.error("Error fetching page:", error);
        res.status(502).json({ 
            message: 'Error fetching page', 
            error: error.message,
            details: 'Unable to reach MangaDex servers. Please try again.'
        }); 
    }
};

module.exports = { 
    getTrending, 
    getLatest, 
    getList, 
    search, 
    getChapters, 
    getPages, 
    getManga, 
    getCover, 
    getPage 
};