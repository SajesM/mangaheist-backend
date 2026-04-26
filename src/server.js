require('dotenv').config();
const express = require("express");
const connectDb = require("./config/db");
const app = express();
const cors = require("cors")

const userRoute = require("./user/user.router");
const bookmarkRoute = require("./bookmark/bookmark.router");
const mangaRoute = require("./manga/manga.router");
const historyRoute = require("./history/history.router");

const port = process.env.PORT || 5000;

app.use(cors({
    origin:"*"
}))

app.use(express.json());

connectDb();

const https = require('node:https');

//added new for manga fixing
app.get('/proxy-image', (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) return res.status(400).send('URL is required');

    // Fetch image from MangaDex
    https.get(imageUrl, {
        headers: { 
            // MangaDex requires a User-Agent header
            'User-Agent': 'MyMangaApp/1.0.0' 
        }
    }, (proxyRes) => {
        // Forward the content type (image/jpeg, image/png, etc.)
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
        
        // Stream the image data directly to the frontend
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Proxy Error:', err.message);
        res.status(500).send('Failed to fetch image');
    });
});

app.use("/api/user", userRoute);
app.use("/api/bookmark", bookmarkRoute);
app.use("/api/manga", mangaRoute);
app.use("/api/history", historyRoute);


app.get("/", (req, res) => {
    res.send("server is running");
});

app.listen(port, () => {
    console.log(`server is running on port ${port}`);
});
