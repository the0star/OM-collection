var mongoose = require("mongoose");

const Schema = mongoose.Schema;

const badgeSchema = new Schema(
    {
        name: String,
        level: Number,
    },
    { _id: false }
);

const userSchema = new Schema({
    info: {
        name: { type: String, required: true, unique: true },
        password: { type: String, required: true, unique: true },
        type: {
            type: String,
            required: true,
            enum: ["Admin", "Moderator", "User"],
        },
        email: { type: String },
        supportStatus: { type: [badgeSchema] },
    },
    profile: {
        name: { type: String },
        id: { type: String },
        joined: { type: Date },
        characters: { type: Array },
        language: { type: String, enum: ["en", "jp"] },
        display: { type: String },
        isPrivate: { type: Boolean },
    },
    cards: {
        owned: { type: Array },
        faved: { type: Array },
    },
    tree: { type: Array },
});

module.exports = mongoose.model("User", userSchema);
