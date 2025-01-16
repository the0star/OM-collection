const Revisions = require("../models/revisions");

exports.getRevisions = async function (query = {}) {
    return await Revisions.find(query);
};
