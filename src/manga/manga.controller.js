const mangaService = require("./manga.service");

const getTrending = async (req, res) => {
    try {
        const data = await mangaService.getTrending();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Mangadex error ", error: error.message });
    }
};

const getList = async (req, res) => {
    try {
        const limit = req.query.limit || 20;
        const data = await mangaService.getListOfManga(limit);
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const getLatest = async (req, res) => {
    try {
        const data = await mangaService.getLatestManga();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const search = async (req, res) => {
    try {
        const data = await mangaService.searchManga(req.query.title);
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const getChapters = async (req, res) => {
    try {
        const data = await mangaService.getMangaChapters(req.params.mangaId);
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const getPages = async (req, res) => {
    try {
        const data = await mangaService.getMangaPages(req.params.chapterId);
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const getManga = async (req, res) => {
    try {
        const data = await mangaService.getMangaById(req.params.mangaId);
        res.json(data);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

const getCover = async (req, res) => {
    const { mangaId, fileName } = req.params;
    const maxRetries = 3;
    let lastError = null;
    
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ message: 'Request timeout' });
        }
    }, 30000);
    
    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}`, {
                    headers: {
                        'User-Agent': 'MangaHiest-App/1.0',
                        'Referer': 'https://mangadex.org/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Connection': 'keep-alive'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(fetchTimeout);
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type') || 'image/jpeg';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
                    
                    const arrayBuffer = await response.arrayBuffer();
                    clearTimeout(timeout);
                    return res.send(Buffer.from(arrayBuffer));
                }
                
                if (response.status === 429) {
                    const waitTime = 2000 * Math.pow(2, attempt - 1);
                    console.log(`Rate limited on cover ${fileName}, waiting ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                if (response.status === 404) {
                    clearTimeout(timeout);
                    return res.status(404).send('Cover not found');
                }
                
                if (attempt < maxRetries) {
                    const waitTime = 1000 * attempt;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
            } catch (fetchError) {
                lastError = fetchError;
                
                if (fetchError.cause?.code === 'UND_ERR_SOCKET' || 
                    fetchError.message.includes('other side closed')) {
                    console.log(`Socket error on cover ${fileName} (attempt ${attempt}/${maxRetries})`);
                    
                    if (attempt < maxRetries) {
                        const waitTime = 2000 * attempt;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                } else if (fetchError.name === 'AbortError') {
                    console.log(`Timeout on cover ${fileName} (attempt ${attempt}/${maxRetries})`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                } else if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
        }
        
        clearTimeout(timeout);
        console.error(`Failed to fetch cover ${fileName} after ${maxRetries} attempts`);
        
        return res.status(502).json({ 
            message: 'Error proxying cover image', 
            error: lastError?.message || 'Unknown error',
            details: 'Remote server closed connection or is unavailable'
        });
        
    } catch (error) {
        clearTimeout(timeout);
        console.error("Error in getCover:", error);
        res.status(500).json({ 
            message: 'Error proxying image', 
            error: error.message 
        });
    }
};

const getPage = async (req, res) => {
    const { hash, fileName } = req.params;
    const maxRetries = 3;
    let lastError = null;
    
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ message: 'Request timeout' });
        }
    }, 30000);
    
    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(`https://uploads.mangadex.org/data/${hash}/${fileName}`, {
                    headers: {
                        'User-Agent': 'MangaHiest-App/1.0',
                        'Referer': 'https://mangadex.org/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Connection': 'keep-alive'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(fetchTimeout);
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type') || 'image/jpeg';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    
                    const arrayBuffer = await response.arrayBuffer();
                    clearTimeout(timeout);
                    return res.send(Buffer.from(arrayBuffer));
                }
                
                if (response.status === 429) {
                    const waitTime = 2000 * Math.pow(2, attempt - 1);
                    console.log(`Rate limited on page ${fileName}, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    clearTimeout(timeout);
                    return res.status(response.status).send('Page not available');
                }
                
                if (attempt < maxRetries) {
                    const waitTime = 1000 * attempt;
                    console.log(`Server error ${response.status}, retry ${attempt}/${maxRetries} after ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
            } catch (fetchError) {
                lastError = fetchError;
                
                if (fetchError.cause?.code === 'UND_ERR_SOCKET' || 
                    fetchError.message.includes('other side closed')) {
                    console.log(`Socket error on page ${fileName} (attempt ${attempt}/${maxRetries}):`, fetchError.message);
                    
                    if (attempt < maxRetries) {
                        const waitTime = 2000 * attempt;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                } else if (fetchError.name === 'AbortError') {
                    console.log(`Fetch timeout for page ${fileName} (attempt ${attempt}/${maxRetries})`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                } else {
                    console.error(`Unexpected error on page ${fileName} (attempt ${attempt}/${maxRetries}):`, fetchError);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
            }
        }
        
        clearTimeout(timeout);
        console.error(`Failed to fetch page ${fileName} after ${maxRetries} attempts`);
        
        if (lastError) {
            return res.status(502).json({ 
                message: 'Error proxying page', 
                error: lastError.message,
                details: 'Remote server closed connection or is unavailable'
            });
        }
        
        return res.status(502).json({ 
            message: 'Error proxying page', 
            error: 'Failed after multiple retries'
        });
        
    } catch (error) {
        clearTimeout(timeout);
        console.error("Fatal error in getPage:", error);
        res.status(500).json({ 
            message: 'Error proxying page', 
            error: error.message,
            details: error.cause?.message || 'Internal server error'
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