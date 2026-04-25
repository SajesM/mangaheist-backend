const bookmarkrepo = require("./bookmark.repository");

const bookmarkToggle = async (userId, mangaData) => {
  const { mangaId, title, cover } = mangaData;

  const exsitingBookmark = await bookmarkrepo.findOne(userId, mangaId);

  if (exsitingBookmark) {
    await bookmarkrepo.deleteById(exsitingBookmark._id);
    return { message: "Bookmark removed" };
  }

  const bookmark = await bookmarkrepo.createBookmark({
    userId,
    mangaId,
    title,
    cover,
  });

  return {
    message: "bookmark added",
    bookmark,
  };
};

const getBookmarks = async (userId) => {
  const bookmarks = await bookmarkrepo.findByUser(userId);
  return bookmarks;
};

module.exports = {
  bookmarkToggle,
  getBookmarks,
};
