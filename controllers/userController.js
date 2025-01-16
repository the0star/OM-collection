const createError = require("http-errors");

const userService = require("../services/userService");
const cardService = require("../services/cardService");
const suggestionService = require("../services/suggestionService");
const revisionService = require("../services/revisionService");

exports.getAccountPage = async function (req, res, next) {
    let user = await userService.getAccountData(req.user.name);
    if (!user) {
        return next(
            createError(404, (properties = { title: "User not found" }))
        );
    }
    return res.render("account", {
        title: req.i18n.t("title.settings"),
        user: { ...req.user, ...user },
    });
};

exports.updateSupport = async function (req, res) {
    let user = req.body.user;
    let newstatus = JSON.parse(req.body.newstatus);
    return res.json(await userService.updateSupport(user, newstatus));
};

// TODO test
exports.banUser = async function (req, res) {
    return res.json(await userService.banUser(req.body.name));
};

// TODO test
exports.getOwnedUniqueNames = async function (req, res, next) {
    return res.json(await userService.getOwnedUniqueNames(req.user.name));
};

// TODO safeguard from adding fake card names
// TODO test error
exports.submitCollectionChanges = async function (req, res, next) {
    let result = await userService.modifyCollection(
        req.user.name,
        req.body.collection,
        req.body.changedCards
    );

    if (result.err) {
        return next(
            createError(
                result.err.message,
                (properties = {
                    title: "Something went wrong. Try refreshing the page",
                })
            )
        );
    }

    return res.json(result);
};

exports.submitCardStatusChange = async function (req, res) {
    let changedCards = {};
    changedCards[req.params.card] = req.body.modify === "add";

    let result = await userService.modifyCollection(
        req.user.name,
        req.body.collection,
        changedCards
    );

    if (result.err) {
        return next(
            createError(
                result.err.message,
                (properties = {
                    title: "Something went wrong. Try refreshing the page",
                })
            )
        );
    }

    result.updatedVal = await getUpdatedCount(
        req.params.card,
        req.body.collection
    );

    return res.json(result);
};

async function getUpdatedCount(card, collection) {
    let updatedVal =
        collection == "owned"
            ? await userService.getOwnedCardCount(card)
            : await userService.getFavedCardCount(card);
    let totalUsers = await userService.getNumberOfValidUsers();
    return ((updatedVal / totalUsers) * 100).toFixed(2);
}

exports.getUserListPage = async function (req, res) {
    let page = req.query.page ?? 1;
    let limit = 50;

    let startIndex = (page - 1) * limit;

    let result = {};
    result.users = await userService.getUserList(
        req.query.sortby,
        req.query.order,
        limit,
        startIndex
    );
    result.totalUsers = await userService.getNumberOfUsers();
    result.totalPages = Math.ceil(result.totalUsers / limit);
    result.nextPage = page < result.totalPages ? page + 1 : 0;
    result.previousPage = page > 1 ? page - 1 : 0;

    res.render("userList", {
        title: "User List",
        userList: result,
        user: req.user,
    });
};

exports.getRankingsPage = async function (req, res, next) {
    let rankingData = await userService.getRankingData();
    return res.render("rankings", {
        title: req.i18n.t("common.rankings"),
        description: "Ranking of most liked obey me cards.",
        ranking: rankingData,
        user: req.user,
    });
};

exports.getTreeProgressPage = async function (req, res, next) {
    let totalTreeStats = await cardService.getTotalTreeStats();
    let userTreeStats = await userService.getUserTreeStats(req.user.name);

    return res.render("user/treeProgress", {
        title: "My tree progress",
        description: "My tree progress on Karasu-OS.com",
        stats: { total: totalTreeStats, user: userTreeStats },
        user: req.user,
    });
};

exports.getUserSuggestionPage = async function (req, res, next) {
    let suggestions = await suggestionService.getSuggestionList({
        user: req.user.name,
    });
    let revisions = await revisionService.getRevisions({ user: req.user.name });
    return res.render("user/suggestions", {
        title: "My edits",
        description: "My edits on karasu-os.com",
        suggestions: suggestions,
        count: suggestions.length + revisions.length,
        user: req.user,
    });
};

// TODO data validation
exports.updateUserProfile = async function (req, res) {
    var update = {};
    for (const field in req.body.updatedInfo) {
        update[`profile.${field}`] = req.body.updatedInfo[field];
    }

    await userService.updateUserData(req.user.name, update);

    return res.json({ err: false });
};

exports.updateUserTree = async function (req, res) {
    await userService.updateUserTree(
        req.user.name,
        req.body.node,
        req.body.isUnlocked
    );
    return res.json({ err: null });
};
