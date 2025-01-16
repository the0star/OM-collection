const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const strengthSchema = new Schema(
    {
        min: Number,
        max: Number,
        fdt: Number,
    },
    { _id: false }
);

const dtReqSchema = new Schema(
    {
        name: String,
        amount: Number,
    },
    { _id: false }
);

const dtRewardSchema = new Schema({
    reward: { type: String, required: true },
    count: { type: Number },
    type: {
        type: String,
        required: true,
        enum: [
            "item",
            "icon",
            "bgm",
            "wallpaper",
            "clothing",
            "voice",
            "chat",
            "skill_animation",
            "moving_picture",
            "home_picture",
            "level_up",
            "flower",
        ],
    },
    requirements: { type: [dtReqSchema] },
    grimmCost: { type: Number },
});

const skillSchema = new Schema(
    {
        skillType: {
            type: String,
            enum: ["Special Skill", "Ability", "Auto Skill"],
        },
        title: { type: String },
        description: { type: String },
    },
    { _id: false }
);

const cardSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    uniqueName: { type: String, required: true, unique: true },
    ja_name: { type: String, required: true },
    source: { type: Array, required: true },
    type: { type: String, required: true, enum: ["Demon", "Memory"] },
    rarity: {
        type: String,
        required: true,
        enum: ["N", "R", "SR", "SSR", "UR", "UR+"],
    },
    attribute: {
        type: String,
        required: true,
        enum: ["Pride", "Greed", "Envy", "Wrath", "Lust", "Gluttony", "Sloth"],
    },
    characters: { type: Array, required: true },
    strength: {
        pride: strengthSchema,
        greed: strengthSchema,
        envy: strengthSchema,
        wrath: strengthSchema,
        lust: strengthSchema,
        gluttony: strengthSchema,
        sloth: strengthSchema,
    },
    dt: { type: [dtRewardSchema] },
    skills: { type: [skillSchema] },
    animation: { type: String, enum: ["", "battle", "homescreen"] },
    number: { type: Number, required: true },
});

module.exports = cardSchema;
