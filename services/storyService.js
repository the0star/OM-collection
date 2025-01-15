const async = require("async");
const createError = require("http-errors");
const Sentry = require("@sentry/node");

const Story = require("../models/stories");

exports.getStory = async function (name) {
    return await Story.findOne({ name: name });
};

exports.getStories = async function () {
    return await Story.aggregate([
        {
            $match: {
                type: "lesson",
                name: {
                    $ne: "",
                },
            },
        },
        {
            $sort: {
                _id: 1,
            },
        },
        {
            $limit: 50,
        },
        {
            $project: {
                name: 1,
            },
        },
    ]);
};
