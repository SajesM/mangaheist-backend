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
