const History = require("./history.model");

// Upsert: if same user+chapter exists, just update the timestamp
const upsertHistory = (userId, chapterId, data) => {
    return History.findOneAndUpdate(
        { userId, chapterId },
        {
            userId,
            chapterId,
            mangaId: data.mangaId,
            mangaTitle: data.mangaTitle,
            coverUrl: data.coverUrl,
            chapterNumber: data.chapterNumber,
            updatedAt: new Date()
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
};

// Get all history for a user, most recent first
const findByUser = (userId) => {
    return History.find({ userId }).sort({ updatedAt: -1 });
};

// Get just the chapterIds a user has read for a specific manga
const findReadChaptersByManga = (userId, mangaId) => {
    return History.find({ userId, mangaId }).select("chapterId -_id");
};

const deleteEntry = (userId, chapterId) => {
    return History.deleteOne({ userId, chapterId });
};

module.exports = { upsertHistory, findByUser, findReadChaptersByManga, deleteEntry };
