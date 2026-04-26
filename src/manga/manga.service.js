const axios = require('axios');
const base_url = "https://api.mangadex.org";

// ─── In-memory caches ──────────────────────────────────────────────────────────
const chapterCache = new Map();   // chapterId → { timestamp, data: pages[] }
const baseUrlCache = new Map();   // chapter hash → { timestamp, url }

const CACHE_TTL = 15 * 60 * 1000; // 15 min – page list
const BASE_URL_TTL = 10 * 60 * 1000; // 10 min – @Home CDN node URLs expire fast

// ─── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Browser-like headers to avoid Cloudflare datacenter IP blocks
const MANGADEX_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://mangadex.org',
    'Referer': 'https://mangadex.org/',
};

/**
 * Axios-based fetch with timeout + exponential-backoff retry.
 * Uses Node's native https module (different TLS fingerprint from undici)
 * which bypasses Cloudflare's datacenter IP detection on Render.
 */
const fetchWithRetry = async (url, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers: MANGADEX_HEADERS,
                timeout: 12000,
                validateStatus: null, // don't throw on non-2xx, handle manually
            });

            // Wrap in a response-like object so all callers work unchanged
            const ok = response.status >= 200 && response.status < 300;
            const fakeRes = {
                ok,
                status: response.status,
                statusText: response.statusText,
                json: async () => response.data,
            };

            if (ok) return fakeRes;

            if (response.status === 429) {
                console.warn(`[MangaDex] 429 Rate-limit hit, waiting ${delay}ms… (attempt ${i + 1}/${retries})`);
                await sleep(delay);
                delay *= 2;
                continue;
            }

            // Non-retriable HTTP error – return so caller can handle it
            return fakeRes;

        } catch (err) {
            const label = err.code === 'ECONNABORTED' ? 'Timeout'
                        : err.code ? err.code
                        : err.message;
            console.warn(`[fetchWithRetry] ${label} on attempt ${i + 1}/${retries}: ${url}`);

            if (i < retries - 1) {
                await sleep(delay);
                delay *= 1.5;
            }
        }
    }
    throw new Error(`Failed to fetch after ${retries} retries: ${url}`);
};

// ─── Data transformers ─────────────────────────────────────────────────────────
const cleanMangaData = (mangaList) => {
    if (!mangaList) return [];
    return mangaList.map(manga => {
        const title = manga.attributes?.title?.en || Object.values(manga.attributes?.title || {})[0] || 'No Title';
        const coverRelationship = manga.relationships?.find(rel => rel.type === 'cover_art');
        return {
            id: manga.id,
            title,
            coverFile: coverRelationship?.attributes?.fileName ?? null,
            status: manga.attributes?.status,
            year: manga.attributes?.year,
            tags: manga.attributes?.tags || [],
            description:
                manga.attributes?.description?.en ||
                Object.values(manga.attributes?.description || {})[0] ||
                'No description available.',
        };
    });
};

// ─── Service functions ─────────────────────────────────────────────────────────
const getTrending = async () => {
    const res = await fetchWithRetry(
        `${base_url}/manga?includes[]=cover_art&order[followedCount]=desc&limit=20&contentRating[]=safe&contentRating[]=suggestive`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getListOfManga = async (limit) => {
    const res = await fetchWithRetry(
        `${base_url}/manga?limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
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

/**
 * Fetches the page list for a chapter from the MangaDex @Home API.
 * Also caches the dynamic CDN baseUrl keyed by chapter hash so the
 * getPage proxy can use the correct server instead of uploads.mangadex.org.
 */
const getMangaPages = async (chapterId) => {
    // Return from cache if still fresh
    if (chapterCache.has(chapterId)) {
        const cached = chapterCache.get(chapterId);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        chapterCache.delete(chapterId);
    }

    const res = await fetchWithRetry(`${base_url}/at-home/server/${chapterId}`);
    if (!res.ok) {
        throw new Error(`MangaDex @Home API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data?.chapter?.data) {
        throw new Error('Invalid response structure from MangaDex @Home API');
    }

    // ✅ Cache the dynamic baseUrl so getPage can use the right CDN node
    if (data.baseUrl && data.chapter.hash) {
        baseUrlCache.set(data.chapter.hash, {
            url: data.baseUrl,
            timestamp: Date.now(),
        });
        console.log(`[Cache] Stored baseUrl for hash ${data.chapter.hash.slice(0, 8)}…`);
    }

    const pages = data.chapter.data.map(file => ({
        hash: data.chapter.hash,
        file,
    }));

    chapterCache.set(chapterId, { timestamp: Date.now(), data: pages });
    return pages;
};

/**
 * Returns the cached MangaDex @Home CDN baseUrl for a given chapter hash.
 * Returns null when not cached or expired.
 */
const getBaseUrlForHash = (hash) => {
    const cached = baseUrlCache.get(hash);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > BASE_URL_TTL) {
        baseUrlCache.delete(hash);
        return null;
    }
    return cached.url;
};

const getMangaById = async (mangaId) => {
    const res = await fetchWithRetry(`${base_url}/manga/${mangaId}?includes[]=cover_art`);
    if (!res.ok) throw new Error('Failed to fetch manga');
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
    getMangaById,
    getBaseUrlForHash, // ← exported so controller can look up cached CDN node
};
