const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    mangaId: {
        type: String,
        required: true
    },

    chapterId: {
        type: String,
        required: true
    },

    mangaTitle: {
        type: String,
        required: true
    },

    coverUrl: {
        type: String,
        default: ""
    },

    chapterNumber: {
        type: String,
        default: "?"
    }

}, { timestamps: true });

// Unique per user+chapter so re-reading just updates the timestamp
historySchema.index({ userId: 1, chapterId: 1 }, { unique: true });

module.exports = mongoose.model("History", historySchema);
