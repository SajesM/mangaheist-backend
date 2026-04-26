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

    if (!data || !Array.isArray(data)) {
      return res.status(500).json({
        message: "Invalid pages response from service"
      });
    }

    res.json(data);
  } catch (error) {
    console.error("getPages error:", error.message);

    res.status(500).json({
      message: "Failed to fetch pages",
      error: error.message
    });
  }
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
        const response = await fetch(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}`);
        if (!response.ok) return res.status(404).send('Not found');
        res.setHeader('Content-Type', response.headers.get('content-type'));
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) { res.status(500).send('Error proxying image'); }
};

module.exports = { getTrending, getLatest, getList, search, getChapters, getPages, getManga, getCover };