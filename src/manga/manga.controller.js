const mangaService = require("./manga.service");

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

/**
 * Proxy an image URL through the backend.
 * Retries up to maxRetries times with exponential backoff.
 */
const proxyImage = async (imageUrl, res, label) => {
    const maxRetries = 3;
    let lastError = null;

    // 30-second overall guard — prevents the request from hanging forever
    const overallTimer = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ message: "Gateway timeout proxying image" });
        }
    }, 30000);

    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const fetchTimer = setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch(imageUrl, {
                    headers: {
                        "User-Agent":      "MangaHiest-App/1.0",
                        "Referer":         "https://mangadex.org/",
                        "Accept":          "image/webp,image/apng,image/*,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    signal: controller.signal,
                });
                clearTimeout(fetchTimer);

                if (response.ok) {
                    const contentType = response.headers.get("content-type") || "image/jpeg";
                    res.setHeader("Content-Type", contentType);
                    res.setHeader("Cache-Control", "public, max-age=86400"); // 24 h
                    const buf = await response.arrayBuffer();
                    clearTimeout(overallTimer);
                    return res.send(Buffer.from(buf));
                }

                // Rate-limited — back off and retry
                if (response.status === 429) {
                    const wait = 2000 * Math.pow(2, attempt - 1);
                    console.warn(`[proxy] 429 on ${label}, waiting ${wait}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(wait);
                    continue;
                }

                // Hard 4xx (except 429) — don't retry
                if (response.status === 404) {
                    clearTimeout(overallTimer);
                    return res.status(404).send("Image not found");
                }
                if (response.status >= 400 && response.status < 500) {
                    clearTimeout(overallTimer);
                    return res.status(response.status).send("Image not available");
                }

                // 5xx — retry after short delay
                if (attempt < maxRetries) {
                    const wait = 1000 * attempt;
                    console.warn(`[proxy] ${response.status} on ${label}, retry ${attempt}/${maxRetries} after ${wait}ms`);
                    await sleep(wait);
                }

            } catch (fetchErr) {
                clearTimeout(fetchTimer);
                lastError = fetchErr;

                const isSocket = fetchErr.cause?.code === "UND_ERR_SOCKET" ||
                                 fetchErr.message?.includes("other side closed");
                const isAbort  = fetchErr.name === "AbortError";

                console.warn(`[proxy] ${isAbort ? "Timeout" : isSocket ? "Socket error" : "Error"} on ${label} (attempt ${attempt}/${maxRetries}):`, fetchErr.message);

                if (attempt < maxRetries) {
                    await sleep(isSocket ? 2000 * attempt : 1000);
                }
            }
        }

        clearTimeout(overallTimer);
        console.error(`[proxy] Failed to fetch ${label} after ${maxRetries} attempts`);

        if (!res.headersSent) {
            res.status(502).json({
                message: "Error proxying image",
                error:   lastError?.message || "Failed after multiple retries",
            });
        }

    } catch (err) {
        clearTimeout(overallTimer);
        console.error(`[proxy] Fatal error for ${label}:`, err);
        if (!res.headersSent) {
            res.status(500).json({ message: "Internal proxy error", error: err.message });
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