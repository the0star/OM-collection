const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true, enum: ["card", "event"] },
    user: { type: String, required: true },
    timestamp: { type: Date, required: true },
    data: { type: mongoose.Mixed, required: true },
});

module.exports = mongoose.model("Revision", revisionSchema);
