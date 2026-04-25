const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    mangaId:{
        type: String,
        required: true
    },

    title:{
        type:String,
        required: true
    },

    cover:{
        type: String,
        required: true
    }



},{timestamps: true});

module.exports = mongoose.model("Bookmark", bookmarkSchema);