require("dotenv").config();
const express = require("express");
const connectDb = require("./config/db");
const cors = require("cors");

const userRoute     = require("./user/user.router");
const bookmarkRoute = require("./bookmark/bookmark.router");
const mangaRoute    = require("./manga/manga.router");
const historyRoute  = require("./history/history.router");

const app  = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());

connectDb();

app.use("/api/user",     userRoute);
app.use("/api/bookmark", bookmarkRoute);
app.use("/api/manga",    mangaRoute);
app.use("/api/history",  historyRoute);

// ──────────────────────────────────────────────────────────────────────────────
// Health-check / keep-alive
// ──────────────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.send("MangaHiest server is running");
});

app.get("/ping", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────────────────────────
// Self-ping to keep Render free-tier alive (prevents cold-start data failures).
// Render sets RENDER_EXTERNAL_URL automatically; the interval is just under
// the 15-minute inactivity threshold.
// ──────────────────────────────────────────────────────────────────────────────
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes

const startKeepAlive = (serverUrl) => {
    console.log(`[keep-alive] Self-ping enabled → ${serverUrl}/ping every 14 min`);
    setInterval(async () => {
        try {
            const res = await fetch(`${serverUrl}/ping`);
            if (res.ok) {
                console.log(`[keep-alive] Ping OK at ${new Date().toISOString()}`);
            } else {
                console.warn(`[keep-alive] Ping returned ${res.status}`);
            }
        } catch (err) {
            console.error("[keep-alive] Ping failed:", err.message);
        }
    }, KEEP_ALIVE_INTERVAL);
};

// ──────────────────────────────────────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`Server running on port ${port}`);

    // Only self-ping when deployed on Render
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl) {
        startKeepAlive(renderUrl);
    } else if (process.env.BACKEND_URL) {
        // Fallback: allow manual override via env var
        startKeepAlive(process.env.BACKEND_URL);
    }
});