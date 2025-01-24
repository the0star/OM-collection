var mongoose = require("mongoose");

var Schema = mongoose.Schema;

const options = { discriminatorKey: "type" };
const noID = { _id: false };

const eventSchema = new Schema(
    {
        name: {
            en: { type: String, required: true, unique: true },
            ja: { type: String, default: "???" },
            zh: { type: String, default: "???" },
        },
        start: { type: Date },
        end: { type: Date },
        type: {
            type: String,
            required: true,
            enum: [
                "PopQuiz",
                "Nightmare",
                "ChargeMission",
                "LoginBonus",
                "Other",
            ],
        },
    },
    options
);

const Event = mongoose.model("Event", eventSchema);

const rewardSchema = new Schema(
    {
        card: { type: String, required: true },
        points: { type: Number },
    },
    noID
);

const generalReqSchema = new Schema(
    {
        name: String,
        req: Number,
    },
    noID
);

const stageSchema = new Schema(
    {
        name: String,
        rewards: Array,
    },
    noID
);

const boxSchema = new Schema({
    name: String,
    itemsCount: Number,
    specialRewards: [generalReqSchema],
});

const boxSetSchema = new Schema({
    name: { type: String, required: true },
    cost: Number,
    boxes: [boxSchema],
});

const popQuizSchema = new Schema({
    rewardListType: { type: String, required: true, enum: ["points", "boxes"] },
    hasKeys: { type: Boolean, required: true },
    isLonelyDevil: { type: Boolean, required: true },
    isBirthday: { type: Boolean, required: true },

    listRewards: { type: [rewardSchema] },
    boxRewards: { type: [boxSetSchema] },

    stages: { type: Number, required: true },
    stageList: { type: [stageSchema] },
    lockedStages: { type: [generalReqSchema] },

    boostingMultiplier: { type: Number, required: true },
    boostingStart: { type: Date },
    boostingEnd: { type: Date },
});

const PopQuiz = Event.discriminator("PopQuiz", popQuizSchema);
const Nightmare = Event.discriminator("Nightmare", new mongoose.Schema({}));
const ChargeMission = Event.discriminator(
    "ChargeMission",
    new mongoose.Schema({})
);
const LoginBonus = Event.discriminator("LoginBonus", new mongoose.Schema({}));
const Other = Event.discriminator("Other", new mongoose.Schema({}));

module.exports = Event;
