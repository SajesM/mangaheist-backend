const express = require('express');
const { getTrending, getLatest, getList, search, getChapters, getPages, getManga, getCover, getPage } = require('./manga.controller');
const router = express.Router();

router.get("/trending", getTrending);
router.get("/latest", getLatest);
router.get("/list", getList);
router.get("/search", search);
router.get("/cover/:mangaId/:fileName", getCover);
router.get("/page/:hash/:fileName", getPage);
router.get("/chapters/:mangaId", getChapters);
router.get("/pages/:chapterId", getPages);
router.get("/:mangaId", getManga);

module.exports = router;