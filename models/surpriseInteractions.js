var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var InteractionSubSchema = new Schema({
    action: {
        type: String,
        required: true,
        enum: ["tap", "swipe", "high five", "ignore", "shake"],
    },
    part: {
        type: String,
        required: false,
        enum: ["head", "face", "body", "arm", ""],
    },
});

var ItemInteractionSubSchema = new Schema({
    item: { type: String, required: false },
    action: {
        type: String,
        required: false,
        enum: ["tap", "swipe", "high five", "ignore", "shake"],
    },
    part: {
        type: String,
        required: false,
        enum: ["head", "face", "body", "arm", ""],
    },
});

var InteractionsSchema = new Schema(
    {
        character: { type: String, required: true },
        phrase: {
            en: { type: String, required: true },
            ja: { type: String, required: true },
            zh: { type: String, required: true },
        },
        condition: { type: String },
        order: { type: Number },
        allInteractions: {
            type: {
                first: [InteractionSubSchema],
                second: [InteractionSubSchema],
                third: [InteractionSubSchema],
                points: {
                    type: Number,
                    required: true,
                },
            },
            required: true,
        },
        allInteractionsShort: {
            type: {
                first: {
                    type: InteractionSubSchema,
                    required: true,
                },
                second: {
                    type: InteractionSubSchema,
                    required: true,
                },
                third: {
                    type: InteractionSubSchema,
                    required: true,
                },
                points: {
                    type: Number,
                    required: true,
                },
            },
            required: true,
        },
        itemInteractions: {
            type: {
                first: [ItemInteractionSubSchema],
                second: [ItemInteractionSubSchema],
                third: [ItemInteractionSubSchema],
                points: {
                    type: Number,
                    required: true,
                },
            },
            required: false,
        },
        itemInteractionsShort: {
            type: {
                first: {
                    type: ItemInteractionSubSchema,
                    required: true,
                },
                second: {
                    type: ItemInteractionSubSchema,
                    required: true,
                },
                third: {
                    type: ItemInteractionSubSchema,
                    required: true,
                },
                points: {
                    type: Number,
                    required: true,
                },
            },
            required: false,
        },
    },
    {
        collection: "surpriseInteractions",
    }
);

module.exports = mongoose.model("surpriseInteractions", InteractionsSchema);
