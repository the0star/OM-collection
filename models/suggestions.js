var mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema(
    {
        // Author of the suggestion.
        user: { type: String, required: true },

        // Structured target of the suggestion.
        //   resource:   "card" | "event"
        //   identifier: card uniqueName, or event English name
        // `page` is kept as a redundant string copy ("/card/<id>", "/event/<en>")
        // so that views and old client code can keep using it without
        // re-deriving. Service writers should set all three together.
        resource: {
            type: String,
            required: true,
            enum: ["card", "event"],
        },
        identifier: { type: String, required: true },
        page: { type: String, required: true },

        // The suggested document body. Was `stringifiedJSON: String`; now
        // stored as Mixed so we skip the parse/stringify round-trip.
        data: { type: mongoose.Schema.Types.Mixed, required: true },

        status: {
            type: String,
            required: true,
            enum: ["pending", "approved", "refused"],
            default: "pending",
        },
        reason: { type: String, default: "" },

        // Audit trail for moderation decisions. Null while pending.
        decidedBy: { type: String, default: null },
        decidedAt: { type: Date, default: null },
    },
    { timestamps: true } // adds createdAt / updatedAt
);

// Fast lookups for the duplicate-check on submit, and for the admin queue.
suggestionSchema.index({ user: 1, page: 1, status: 1 });
suggestionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Suggestion", suggestionSchema);
