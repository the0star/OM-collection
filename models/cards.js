const mongoose = require("mongoose");
const cardSchema = require("../models/cardBase.js");

module.exports = mongoose.model("Card", cardSchema);
