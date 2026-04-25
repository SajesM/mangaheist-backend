const bookmarkService = require("./bookmark.service");

const bookmarkToggle = async(req, res)=>{
    try{
        const userId = req.user.id;
        const result = await bookmarkService.bookmarkToggle(userId, req.body);

        res.status(200).json(result);
    }catch(error){
        res.status(500).json({message: error.message});
    }
};

const getBookmark = async(req, res)=>{
    try{
        const userId = req.user.id;
        const bookmarks = await bookmarkService.getBookmarks(userId);
        res.status(200).json({bookmarks});
    }catch(error){
        res.status(500).json({message:error.message});
    }
};

module.exports = {bookmarkToggle,getBookmark};