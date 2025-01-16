const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ["devilgram", "lesson"] },
    content: { type: Array, required: true },
});

module.exports = mongoose.model("Story", storySchema);
