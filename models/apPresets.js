var mongoose = require("mongoose");
var events = require("events");

var Schema = mongoose.Schema;

var APPresetsSchema = new Schema({
    name: { type: String, required: true },
    rewards: { type: [events.APSchema], required: true },
});

module.exports = mongoose.model("apPresets", APPresetsSchema, "apPresets");
