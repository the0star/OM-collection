const mongoose = require("mongoose");
const cardSchema = require("../models/cardBase.js");

module.exports = mongoose.model("HiddenCard", cardSchema, "hiddenCards");
