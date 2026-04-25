const express = require("express");
const router = express.Router();
const { bookmarkToggle, getBookmark } = require("./bookmark.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/toggle", authMiddleware, bookmarkToggle);
router.get("/all", authMiddleware, getBookmark);

module.exports = router;