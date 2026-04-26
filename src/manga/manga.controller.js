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
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getLatest = async (req, res) => {
    try {
        const data = await mangaService.getLatestManga();
        res.json(data);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const search = async (req, res) => {
    try {
        const data = await mangaService.searchManga(req.query.title);
        res.json(data);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getChapters = async (req, res) => {
    try {
        const data = await mangaService.getMangaChapters(req.params.mangaId);
        res.json(data);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getPages = async (req, res) => {
    try {
        const data = await mangaService.getMangaPages(req.params.chapterId);
        res.json(data);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getManga = async (req, res) => {
    try {
        const data = await mangaService.getMangaById(req.params.mangaId);
        res.json(data);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getCover = async (req, res) => {
    try {
        const { mangaId, fileName } = req.params;
        let response;
        for (let i = 0; i < 3; i++) {
            response = await fetch(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}`, {
                headers: {
                    'User-Agent': 'MangaHiest-App/1.0',
                    'Referer': 'https://mangadex.org/'
                }
            });
            if (response.ok) break;
            if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1))); // Simple backoff
                continue;
            }
            break;
        }
        
        if (!response || !response.ok) {
            console.error(`Failed to fetch cover ${fileName}, status: ${response ? response.status : 'unknown'}`);
            return res.status(404).send('Not found');
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) { 
        console.error("Error proxying cover image:", error);
        res.status(500).json({ message: 'Error proxying image', error: error.message }); 
    }
};

const getPage = async (req, res) => {
    try {
        const { hash, fileName } = req.params;
        let response;
        for (let i = 0; i < 3; i++) {
            response = await fetch(`https://uploads.mangadex.org/data/${hash}/${fileName}`, {
                headers: {
                    'User-Agent': 'MangaHiest-App/1.0',
                    'Referer': 'https://mangadex.org/'
                }
            });
            if (response.ok) break;
            if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
                continue;
            }
            break;
        }
        
        if (!response || !response.ok) {
            console.error(`Failed to fetch page ${fileName}, status: ${response ? response.status : 'unknown'}`);
            return res.status(404).send('Not found');
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) { 
        console.error("Error proxying page:", error);
        res.status(500).json({ message: 'Error proxying page', error: error.message }); 
    }
};

module.exports = { getTrending, getLatest, getList, search, getChapters, getPages, getManga, getCover, getPage };