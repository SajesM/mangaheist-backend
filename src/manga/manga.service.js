const pLimit = require("p-limit");

const base_url = "https://api.mangadex.org";
const limit = pLimit(5);

const chapterCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================= SAFE FETCH =================

const fetchWithRetry = async (url, retries = 2, delay = 2000) => {
    let lastError;

    for (let i = 1; i <= retries; i++) {
        try {
            const res = await limit(() =>
                fetch(url, {
                    headers: {
                        'User-Agent': 'MangaHiest-App/1.0',
                    }
                })
            );

            if (res.ok) return res;

            if (res.status === 429) {
                const wait = delay * Math.pow(2, i);
                console.warn(`429 rate limit → wait ${wait}ms`);
                await sleep(wait);
                continue;
            }

            return res;

        } catch (err) {
            lastError = err;

            // 🚫 STOP retrying if socket closed
            if (err.cause?.code === "UND_ERR_SOCKET") {
                console.warn("Socket closed by MangaDex — stopping retries");
                break;
            }

            if (i < retries) {
                await sleep(1000);
            }
        }
    }

    throw new Error(lastError?.message || "Max retries reached");
};

// ================= CLEAN DATA =================

const cleanMangaData = (mangaList) => {
    if (!mangaList) return [];

    return mangaList.map(manga => {
        const title =
            manga.attributes?.title?.en ||
            Object.values(manga.attributes?.title || {})[0] ||
            "No Title";

        const coverRel = manga.relationships?.find(rel => rel.type === "cover_art");

        return {
            id: manga.id,
            title,
            coverFile: coverRel?.attributes?.fileName || null,
            status: manga.attributes?.status,
            year: manga.attributes?.year,
            tags: manga.attributes?.tags || [],
            description:
                manga.attributes?.description?.en ||
                Object.values(manga.attributes?.description || {})[0] ||
                "No description available."
        };
    });
};

// ================= API FUNCTIONS =================

const getTrending = async () => {
    const res = await fetchWithRetry(
        `${base_url}/manga?includes[]=cover_art&order[followedCount]=desc&limit=20&contentRating[]=safe&contentRating[]=suggestive`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getListOfManga = async (limitNum) => {
    const res = await fetchWithRetry(
        `${base_url}/manga?limit=${limitNum}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getLatestManga = async () => {
    const res = await fetchWithRetry(
        `${base_url}/manga?limit=20&order[createdAt]=desc&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const searchManga = async (title) => {
    const res = await fetchWithRetry(
        `${base_url}/manga?title=${encodeURIComponent(title)}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getMangaChapters = async (mangaId) => {
    const res = await fetchWithRetry(
        `${base_url}/chapter?manga=${mangaId}&limit=100&order[chapter]=asc`
    );
    if (!res.ok) return { data: [] };
    return res.json();
};

// ================= IMPORTANT FIX =================

const getMangaPages = async (chapterId) => {
    if (chapterCache.has(chapterId)) {
        const cached = chapterCache.get(chapterId);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        } else {
            chapterCache.delete(chapterId);
        }
    }

    const res = await fetchWithRetry(`${base_url}/at-home/server/${chapterId}`);

    if (!res.ok) {
        throw new Error(`MangaDex API error: ${res.status}`);
    }

    const data = await res.json();

    const result = {
        baseUrl: data.baseUrl,
        hash: data.chapter.hash,
        pages: data.chapter.data
    };

    chapterCache.set(chapterId, {
        timestamp: Date.now(),
        data: result
    });

    return result;
};

const getMangaById = async (mangaId) => {
    const res = await fetchWithRetry(
        `${base_url}/manga/${mangaId}?includes[]=cover_art`
    );
    if (!res.ok) throw new Error("Failed to fetch manga");

    const data = await res.json();
    if (!data.data) return null;

    return cleanMangaData([data.data])[0];
};

module.exports = {
    getTrending,
    getListOfManga,
    getLatestManga,
    searchManga,
    getMangaChapters,
    getMangaPages,
    getMangaById
};