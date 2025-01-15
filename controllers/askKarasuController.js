const createError = require("http-errors");

const cardService = require("../services/cardService");
const userService = require("../services/userService");

exports.getDTRewardsPage = async function (req, res, next) {
    let cards = [];
    let description =
        "Find out which cards give various rewards in their devil's trees";
    let title = "Devil's Tree Rewards";
    if (req.query.item) {
        cards = await cardService.getTreeNodesWithRewardItem(
            req.query.item,
            req.user,
            req.query.owned,
            req.query.locked
        );
        description =
            "A page with list of cards that gives " +
            req.query.item +
            " in their devil's trees";
        title += ": " + req.query.item;
    }

    return res.render("askKarasu", {
        title: title,
        description: description,
        cards: cards,
        path: "dt-rewards",
        query: req.query,
        user: req.user,
    });
};

exports.getUnlockItemsPage = async function (req, res, next) {
    let cards = [];
    let description = "Find out which items you need to unlock devil's tree";
    let title = "Items to Unlock Devil's Tree";
    if (req.query.item) {
        cards = await cardService.getTreeNodesWithUnlockItem(
            req.query.item,
            req.user,
            req.query.owned,
            req.query.locked
        );
        description =
            "A list of cards that needs " +
            req.query.item +
            " to unlock their devil's tree spaces";
        title += ": " + req.query.item;
    }

    return res.render("askKarasu", {
        title: title,
        description: description,
        cards: cards,
        path: "card-unlock-items",
        query: req.query,
        user: req.user,
    });
};

exports.getMajolishCardsPage = async function (req, res, next) {
    let cards = [];
    let description =
        "Find out which cards give Majolish rewards in their devil's trees";
    let title = "Majolish Rewards";
    if (req.query.item) {
        cards = await cardService.getTreeNodesWithMajolishType(
            req.query.item,
            req.user,
            req.query.owned,
            req.query.locked
        );
        description =
            "A list of cards with " +
            req.query.item +
            " as a devil's tree reward";
        title += ": " + req.query.item;
    }

    return res.render("askKarasu", {
        title: title,
        description: description,
        cards: cards,
        path: "majolish-cards",
        query: req.query,
        user: req.user,
    });
};

exports.getSkillChargeSpeedPage = async function (req, res, next) {
    let cards = [];
    let description = "Find out card charging speed";
    let title = "Fast/slow Charging Cards";

    if (req.query.speed) {
        cards = await cardService.getCardsWithChargeSpeed(
            req.query.speed,
            req.user,
            req.query.owned
        );
        description = "A list of " + req.query.speed + " charging cards";
        title =
            req.query.speed.charAt(0).toUpperCase() +
            req.query.speed.slice(1) +
            " Charging Cards";
    }

    return res.render("askKarasu", {
        title: title,
        description: description,
        cards: cards,
        path: "skill-charge-time",
        query: req.query,
        user: req.user,
    });
};

exports.getSkillsPage = async function (req, res, next) {
    let cards = [];

    if (req.query.s) {
        cards = await cardService.findSkills(
            req.query.s,
            req.user,
            req.query.owned
        );
    }

    return res.render("askKarasu", {
        title: req.i18n.t("title.skills"),
        description: "",
        cards: cards,
        path: "skills",
        query: req.query,
        user: req.user,
    });
};
