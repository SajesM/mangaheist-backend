const historyService = require("./history.service");

// POST /api/history/mark
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const entry = await historyService.markAsRead(userId, req.body);
        res.status(200).json({ message: "Chapter marked as read", entry });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/history/all
const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await historyService.getHistory(userId);
        res.status(200).json({ history });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/history/read/:mangaId  — returns array of read chapterIds for a manga
const getReadChapters = async (req, res) => {
    try {
        const userId = req.user.id;
        const { mangaId } = req.params;
        const chapterIds = await historyService.getReadChapters(userId, mangaId);
        res.status(200).json({ readChapterIds: chapterIds });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { markAsRead, getHistory, getReadChapters };
