const mangaService = require("./manga.service");
const pLimit = require("p-limit");

const limit = pLimit(5); // limit concurrent requests
const cache = new Map(); // simple in-memory cache

// ================= BASIC CONTROLLERS =================

const getTrending = async (req, res) => {
    try {
        const data = await mangaService.getTrending();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Mangadex error", error: error.message });
    }
};

const getList = async (req, res) => {
    try {
        const limitQuery = req.query.limit || 20;
        const data = await mangaService.getListOfManga(limitQuery);
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

// ================= FIXED COVER PROXY =================

const getCover = async (req, res) => {
    const { mangaId, fileName } = req.params;
    const maxRetries = 2;

    const finalFileName = fileName.includes(".256.")
        ? fileName
        : `${fileName}.256.jpg`;

    const cacheKey = `${mangaId}-${finalFileName}`;

    // ✅ Serve from cache
    if (cache.has(cacheKey)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(cache.get(cacheKey));
    }

    let lastError = null;

    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await limit(() =>
                    fetch(`https://uploads.mangadex.org/covers/${mangaId}/${finalFileName}`, {
                        headers: {
                            "User-Agent": "MangaHiest-App/1.0",
                            "Referer": "https://mangadex.org/",
                            "Accept": "image/webp,image/*,*/*;q=0.8"
                        }
                    })
                );

                if (response.ok) {
                    const contentType = response.headers.get("content-type") || "image/jpeg";
                    const buffer = Buffer.from(await response.arrayBuffer());

                    cache.set(cacheKey, buffer);

                    res.setHeader("Content-Type", contentType);
                    res.setHeader(
                        "Cache-Control",
                        "public, max-age=86400, stale-while-revalidate=604800"
                    );

                    return res.send(buffer);
                }

                if (response.status === 429) {
                    const waitTime = 2000 * Math.pow(2, attempt);
                    console.log(`Rate limited → wait ${waitTime}ms`);
                    await new Promise(r => setTimeout(r, waitTime));
                    continue;
                }

                if (response.status === 404) {
                    return res.status(404).send("Cover not found");
                }

                if (response.status >= 500 && attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                }

            } catch (err) {
                lastError = err;

                if (err.cause?.code === "UND_ERR_SOCKET") {
                    console.log("CDN closed connection — stop retry");
                    break;
                }

                if (err.name === "AbortError" && attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        console.error(`Failed cover: ${finalFileName}`);

        return res.status(502).json({
            message: "Failed to fetch cover",
            error: lastError?.message || "Unknown error"
        });

    } catch (error) {
        console.error("Fatal error in getCover:", error);

        return res.status(500).json({
            message: "Internal error",
            error: error.message
        });
    }
};

// ================= FIXED PAGE HANDLER =================

// ❗ DO NOT proxy images anymore
// just return direct MangaDex URL

const getPage = async (req, res) => {
    const { baseUrl, hash, fileName } = req.query;

    if (!baseUrl || !hash || !fileName) {
        return res.status(400).json({
            message: "Missing parameters"
        });
    }

    const url = `${baseUrl}/data/${hash}/${fileName}`;

    return res.json({ url });
};

// ================= EXPORT =================

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