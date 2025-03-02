const Sentry = require("@sentry/node");

const Suggestions = require("../models/suggestions.js");

exports.getSuggestion = async function (query = {}) {
    try {
        return await Suggestions.findOne(query).lean();
    } catch (e) {
        Sentry.captureException(e);
        return [];
    }
};

exports.getSuggestionList = async (query = {}, sort = {}) =>
    await Suggestions.find(query).sort(sort);

exports.addSuggestion = async function (data) {
    try {
        data.status = "pending";
        let doc = await Suggestions.updateOne(
            { user: data.user, page: data.page, status: "pending" },
            data
        );
        if (doc.n === 1) return doc;
        return await Suggestions.create(data);
    } catch (e) {
        return { err: true, message: e.message };
    }
};

exports.updateSuggestionStatus = async function (id, status, reason = "") {
    try {
        let res = await Suggestions.updateOne(
            { _id: id },
            { $set: { status: status, reason: reason } }
        );
        if (res.err) throw res.message;
        return { err: null, message: "Suggestion status updated!" };
    } catch (e) {
        return { err: true, message: e.message };
    }
};

exports.refuseSuggestionsFrom = async function (name) {
    return await Suggestions.updateMany(
        { user: name },
        { $set: { status: "refused" } }
    );
};
