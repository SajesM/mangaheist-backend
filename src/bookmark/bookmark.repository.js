const Bookmark = require("./bookmark.model");

const findOne = (userId, mangaId) => {
    return Bookmark.findOne({ userId, mangaId });
};

const createBookmark = (book) => {
    return Bookmark.create(book);
};

const deleteById = (id) => {
    return Bookmark.deleteOne({ _id: id });
};

const findByUser = (userId) => {
    return Bookmark.find({ userId });
};

module.exports = { findOne, createBookmark, deleteById, findByUser };