const mongoose = require("mongoose");
const { Schema } = mongoose;

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

const rewardSchema = new Schema(
    {
        card: { type: String, required: true },
        points: { type: Number },
    },
    noID
);

const costScheme = new Schema(
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

const boxSchema = new Schema(
    {
        name: String,
        itemsCount: Number,
        specialRewards: [costScheme],
    },
    noID
);

const boxSetSchema = new Schema(
    {
        name: { type: String, required: true },
        cost: { type: Number },
        boxes: [boxSchema],
    },
    noID
);

const popQuizSchema = new Schema({
    rewardListType: { type: String, required: true, enum: ["points", "boxes"] },
    hasKeys: { type: Boolean, required: true },
    isLonelyDevil: { type: Boolean, required: true },
    isBirthday: { type: Boolean, required: true },

    listRewards: [rewardSchema],
    boxRewards: [boxSetSchema],

    stages: { type: Number, required: true },
    stageList: [stageSchema],
    lockedStages: [costScheme],

    boostingMultiplier: { type: Number, required: true },
    boostingStart: { type: Date },
    boostingEnd: { type: Date },
});

const Event = mongoose.model("Event", eventSchema);
Event.discriminator("PopQuiz", popQuizSchema);

module.exports = Event;
