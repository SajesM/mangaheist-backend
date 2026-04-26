const mangaService = require("./manga.service");
const axios = require('axios');

// ─── Simple manga data endpoints ───────────────────────────────────────────────

const getTrending = async (req, res) => {
    try {
        const data = await mangaService.getTrending();
        res.json(data);
    } catch (error) {
        console.error("[getTrending]", error.message);
        res.status(500).json({ message: "Failed to fetch trending manga", error: error.message });
    }
};

const getList = async (req, res) => {
    try {
        const limit = req.query.limit || 20;
        const data = await mangaService.getListOfManga(limit);
        res.json(data);
    } catch (error) {
        console.error("[getList]", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getLatest = async (req, res) => {
    try {
        const data = await mangaService.getLatestManga();
        res.json(data);
    } catch (error) {
        console.error("[getLatest]", error.message);
        res.status(500).json({ message: error.message });
    }
};

const search = async (req, res) => {
    try {
        const data = await mangaService.searchManga(req.query.title);
        res.json(data);
    } catch (error) {
        console.error("[search]", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getChapters = async (req, res) => {
    try {
        const data = await mangaService.getMangaChapters(req.params.mangaId);
        res.json(data);
    } catch (error) {
        console.error("[getChapters]", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getPages = async (req, res) => {
    try {
        const data = await mangaService.getMangaPages(req.params.chapterId);
        res.json(data);
    } catch (error) {
        console.error("[getPages]", error.message);
        res.status(500).json({ message: error.message });
    }
};

const getManga = async (req, res) => {
    try {
        const data = await mangaService.getMangaById(req.params.mangaId);
        res.json(data);
    } catch (error) {
        console.error("[getManga]", error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─── Image proxy helpers ────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Browser-like headers for image proxy — avoids Cloudflare TLS block on Render
const IMAGE_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer':         'https://mangadex.org/',
};

/**
 * Proxy an image URL through the backend using axios.
 * axios uses Node's native https module — different TLS fingerprint from undici,
 * which avoids Cloudflare's datacenter IP block on Render free tier.
 */
const proxyImage = async (imageUrl, res, label) => {
    const maxRetries = 3;
    let lastError = null;

    // 30-second overall guard
    const overallTimer = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ message: 'Gateway timeout proxying image' });
        }
    }, 30000);

    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(imageUrl, {
                    headers:        IMAGE_HEADERS,
                    responseType:   'arraybuffer', // get raw bytes directly
                    timeout:        15000,
                    validateStatus: null,          // handle all status codes manually
                });

                const status = response.status;

                if (status >= 200 && status < 300) {
                    const contentType = response.headers['content-type'] || 'image/jpeg';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 h
                    clearTimeout(overallTimer);
                    return res.send(Buffer.from(response.data));
                }

                if (status === 429) {
                    const wait = 2000 * Math.pow(2, attempt - 1);
                    console.warn(`[proxy] 429 on ${label}, waiting ${wait}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(wait);
                    continue;
                }

                if (status === 404) {
                    clearTimeout(overallTimer);
                    return res.status(404).send('Image not found');
                }
                if (status >= 400 && status < 500) {
                    clearTimeout(overallTimer);
                    return res.status(status).send('Image not available');
                }

                // 5xx — retry
                if (attempt < maxRetries) {
                    const wait = 1000 * attempt;
                    console.warn(`[proxy] ${status} on ${label}, retry ${attempt}/${maxRetries} after ${wait}ms`);
                    await sleep(wait);
                }

            } catch (axiosErr) {
                lastError = axiosErr;
                const isTimeout = axiosErr.code === 'ECONNABORTED';
                const label2    = isTimeout ? 'Timeout' : (axiosErr.code || axiosErr.message);
                console.warn(`[proxy] ${label2} on ${label} (attempt ${attempt}/${maxRetries}):`, axiosErr.message);

                if (attempt < maxRetries) {
                    await sleep(isTimeout ? 1000 : 2000 * attempt);
                }
            }
        }

        clearTimeout(overallTimer);
        console.error(`[proxy] Failed to fetch ${label} after ${maxRetries} attempts`);

        if (!res.headersSent) {
            res.status(502).json({
                message: 'Error proxying image',
                error:   lastError?.message || 'Failed after multiple retries',
            });
        }

    } catch (err) {
        clearTimeout(overallTimer);
        console.error(`[proxy] Fatal error for ${label}:`, err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Internal proxy error', error: err.message });
        }
    }
};

// ─── Cover proxy ───────────────────────────────────────────────────────────────

const getCover = async (req, res) => {
    const { mangaId, fileName } = req.params;
    const url = `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
    await proxyImage(url, res, `cover/${fileName}`);
};

// ─── Page proxy ────────────────────────────────────────────────────────────────

const getPage = async (req, res) => {
    const { hash, fileName } = req.params;

    // ✅ Use the dynamic CDN baseUrl cached when getPages was called.
    // Falls back to uploads.mangadex.org when the server has just cold-started
    // and the cache is empty (Render free tier wake-up scenario).
    const cachedBase = mangaService.getBaseUrlForHash(hash);
    const imageUrl   = cachedBase
        ? `${cachedBase}/data/${hash}/${fileName}`
        : `https://uploads.mangadex.org/data/${hash}/${fileName}`;

    if (cachedBase) {
        console.log(`[getPage] Using cached CDN node for hash ${hash.slice(0, 8)}…`);
    } else {
        console.warn(`[getPage] No cached baseUrl for hash ${hash.slice(0, 8)}… – falling back to uploads.mangadex.org`);
    }

    await proxyImage(imageUrl, res, `page/${fileName}`);
};

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    getTrending,
    getLatest,
    getList,
    search,
    getChapters,
    getPages,
    getManga,
    getCover,
    getPage,
};