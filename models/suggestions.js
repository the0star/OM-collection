var mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema({
    user: { type: String, required: true },
    page: { type: String, required: true },
    old: { type: String },
    stringifiedJSON: { type: String, required: true },
    status: {
        type: String,
        required: true,
        enum: ["pending", "approved", "refused"],
    },
    reason: { type: String },
});

module.exports = mongoose.model("Suggestion", suggestionSchema);
