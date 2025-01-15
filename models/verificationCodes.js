var mongoose = require("mongoose");

const codeSchema = new mongoose.Schema(
    {
        user: { type: String, required: true },
        email: { type: String, required: true },
        code: { type: String, required: true },
    },
    { collection: "verificationCodes" }
);

module.exports = mongoose.model("VerficationCode", codeSchema);
