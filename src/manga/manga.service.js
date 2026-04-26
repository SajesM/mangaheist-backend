const base_url = "https://api.mangadex.org";
const cover_url = "https://uploads.mangadex.org/covers";

const chapterCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        const res = await fetch(url);
        if (res.ok) return res;
        if (res.status === 429) {
            console.warn(`MangaDex Rate limit hit (429), retrying in ${delay}ms...`);
            await sleep(delay);
            delay *= 1.5; // exponential backoff
            continue;
        }
        return res;
    }
    throw new Error("Max retries reached due to rate limit");
};

const cleanMangaData = (mangaList) => {
    if (!mangaList) return [];
    return mangaList.map(manga => {
        const title = manga.attributes?.title?.en || Object.values(manga.attributes?.title || {})[0] || "No Title";
        const coverRelationship = manga.relationships?.find(rel => rel.type === "cover_art");
        return {
            id: manga.id,
            title,
            coverFile: coverRelationship ? coverRelationship.attributes?.fileName : null,
            status: manga.attributes?.status,
            year: manga.attributes?.year,
            tags: manga.attributes?.tags || [],
            description: manga.attributes?.description?.en || Object.values(manga.attributes?.description || {})[0] || "No description available.",
        };
    });
};

const getTrending = async () => {
    const response = await fetchWithRetry(`${base_url}/manga?includes[]=cover_art&order[followedCount]=desc&limit=20&contentRating[]=safe&contentRating[]=suggestive`);
    if (!response.ok) return [];
    const data = await response.json();
    return cleanMangaData(data.data);
};

const getListOfManga = async (limit) => {
    const res = await fetchWithRetry(`${base_url}/manga?limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getLatestManga = async () => {
    const res = await fetchWithRetry(`${base_url}/manga?limit=20&order[createdAt]=desc&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const searchManga = async (title) => {
    const res = await fetchWithRetry(`${base_url}/manga?title=${encodeURIComponent(title)}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    if (!res.ok) return [];
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getMangaChapters = async (mangaId) => {
    const res = await fetchWithRetry(`${base_url}/chapter?manga=${mangaId}&limit=100&order[chapter]=asc`);
    if (!res.ok) return { data: [] };
    return res.json();
};

const getMangaPages = async (chapterId) => {
    if (chapterCache.has(chapterId)) {
        const cached = chapterCache.get(chapterId);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        } else {
            chapterCache.delete(chapterId);
        }
    }

    try {
        const res = await fetchWithRetry(`${base_url}/at-home/server/${chapterId}`);
        if (!res.ok) {
            throw new Error(`MangaDex API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        if (!data || !data.chapter || !data.chapter.data) {
            throw new Error("Invalid response structure from MangaDex @Home API");
        }

        const pages = data.chapter.data.map((file) => ({
            hash: data.chapter.hash,
            file: file
        }));

        chapterCache.set(chapterId, {
            timestamp: Date.now(),
            data: pages
        });

        return pages;
    } catch (error) {
        console.error(`Error fetching pages for chapter ${chapterId}:`, error.message);
        throw error;
    }
};

const getMangaById = async (mangaId) => {
    const res = await fetchWithRetry(`${base_url}/manga/${mangaId}?includes[]=cover_art`);
    if (!res.ok) throw new Error("Failed to fetch manga");
    const data = await res.json();
    if (!data.data) return null;
    return cleanMangaData([data.data])[0];
};

module.exports = { getTrending, getListOfManga, getLatestManga, searchManga, getMangaChapters, getMangaPages, getMangaById };

