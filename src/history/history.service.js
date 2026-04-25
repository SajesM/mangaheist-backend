const historyRepo = require("./history.repository");

// Called when user opens a chapter — marks it as read
const markAsRead = async (userId, data) => {
    const { mangaId, chapterId, mangaTitle, coverUrl, chapterNumber } = data;
    const entry = await historyRepo.upsertHistory(userId, chapterId, {
        mangaId,
        mangaTitle,
        coverUrl,
        chapterNumber
    });
    return entry;
};

// Returns full read history for profile / history page
const getHistory = async (userId) => {
    return await historyRepo.findByUser(userId);
};

// Returns list of chapterIds read for a specific manga (used to fade chapters)
const getReadChapters = async (userId, mangaId) => {
    const entries = await historyRepo.findReadChaptersByManga(userId, mangaId);
    return entries.map(e => e.chapterId);
};

module.exports = { markAsRead, getHistory, getReadChapters };
