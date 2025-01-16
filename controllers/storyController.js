const https = require("https");
const createError = require("http-errors");
const Sentry = require("@sentry/node");

const storyService = require("../services/storyService");
const userService = require("../services/userService");

exports.getDevilgram = async function (req, res) {
    try {
        const name = req.query.name;
        const story = await storyService.getStory({
            name: name,
            type: "devilgram",
        });
        return res.json({ story: story });
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: true, message: e.message });
    }
};

exports.getStory = async function (req, res) {
    const story = await storyService.getStory(req.params.name);
    let user = req.user;
    if (user) {
        user.displayName =
            (await userService.getUser(user.name)).profile.name || user.name;
    }
    return res.render("stories/story", {
        title: story.name,
        description: "Obey Me Original Main Lesson Story " + story.name,
        story: story,
        user: user,
    });
};

exports.getStories = async function (req, res) {
    const stories = await storyService.getStories();
    return res.render("stories/list", {
        title: "Stories",
        description: "A list of Obey Me main lesson stories.",
        stories: stories,
        user: req.user,
    });
};
