const express = require("express");
const router = express.Router();
const { markAsRead, getHistory, getReadChapters } = require("./history.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All history routes require a logged-in user
router.post("/mark", authMiddleware, markAsRead);
router.get("/all", authMiddleware, getHistory);
router.get("/read/:mangaId", authMiddleware, getReadChapters);

module.exports = router;
