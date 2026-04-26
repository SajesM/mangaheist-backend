const base_url = "https://api.mangadex.org";
const cover_url = "https://uploads.mangadex.org/covers";

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
    const response = await fetch(`${base_url}/manga?includes[]=cover_art&order[followedCount]=desc&limit=20&contentRating[]=safe&contentRating[]=suggestive`);
    const data = await response.json();
    return cleanMangaData(data.data);
};

const getListOfManga = async (limit) => {
    const res = await fetch(`${base_url}/manga?limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getLatestManga = async () => {
    const res = await fetch(`${base_url}/manga?limit=20&order[createdAt]=desc&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    const data = await res.json();
    return cleanMangaData(data.data);
};

const searchManga = async (title) => {
    const res = await fetch(`${base_url}/manga?title=${encodeURIComponent(title)}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    const data = await res.json();
    return cleanMangaData(data.data);
};

const getMangaChapters = async (mangaId) => {
    const res = await fetch(`${base_url}/chapter?manga=${mangaId}`);
    return res.json();
};

const getMangaPages = async (chapterId, retry = 2) => {
  try {
    const res = await fetch(`${base_url}/at-home/server/${chapterId}`);
    const data = await res.json();

    if (!data?.chapter?.hash) throw new Error("Invalid response");

    const base = data.baseUrl;
    const hash = data.chapter.hash;

    return data.chapter.data.map(
      (file) => `${base}/data/${hash}/${file}`
    );
  } catch (err) {
    if (retry > 0) {
      console.log("Retrying MangaDex fetch...");
      return getMangaPages(chapterId, retry - 1);
    }
    throw err;
  }
};

const getMangaById = async (mangaId) => {
    const res = await fetch(`${base_url}/manga/${mangaId}?includes[]=cover_art`);
    const data = await res.json();
    return cleanMangaData([data.data])[0];
};

module.exports = { getTrending, getListOfManga, getLatestManga, searchManga, getMangaChapters, getMangaPages, getMangaById };

