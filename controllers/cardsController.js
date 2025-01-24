const createError = require("http-errors");
const Sentry = require("@sentry/node");

const miscController = require("../controllers/miscController");

const cardService = require("../services/cardService");
const eventService = require("../services/eventService");
const userService = require("../services/userService");
const suggestionService = require("../services/suggestionService");

exports.index = function (req, res, next) {
    return res.render("index", {
        title: "Karasu OS",
        description: req.i18n.t("description.cards"),
        user: req.user,
    });
};

exports.getCardsListPage = function (req, res, next) {
    try {
        return res.render("cardsList", {
            title: req.i18n.t("title.cards"),
            description:
                "The place to view all of Obey Me!'s cards. The largest and most complete card databse with all sorts of filters for you to find the card you want! This is also the place to manage your card collection. Create an account to access more features! ... Pride, Greed, Envy, Wrath, Lust, Gluttony, Sloth, UR+, UR, SSR, SR, N, Lucifer, Mammon, Leviathan, Satan, Asmodeus, Beelzebub, Belphegor, Luke, Simeon, Barbatos, Diavolo, Solomon, Little D., Owned, Not owned.",
            path: "list",
            query: req.query,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

exports.getCharacterCardPage = async function (req, res, next) {
    const characters = [
        "Lucifer",
        "Mammon",
        "Leviathan",
        "Satan",
        "Asmodeus",
        "Beelzebub",
        "Belphegor",
        "Diavolo",
        "Barbatos",
        "Simeon",
        "Luke",
        "Solomon",
        "Thirteen",
        "Mephistopheles",
        "Raphael",
    ];
    if (!characters.includes(req.params.character))
        return next(createError(404));
    let character = req.params.character;
    return res.render("cardListCharacter", {
        title: character + "'s Cards",
        description: character + "'s card page.",
        user: req.user,
        character: character,
    });
};

exports.getIconDirectory = function (req, res, next) {
    return res.render("iconDir", {
        title: "Icons",
        description: "Icons directory",
        user: req.user,
    });
};

exports.getOwnedCardsPage = async function (req, res, next) {
    try {
        var user = await userService.getUser(req.params.username);
        if (!user) {
            throw createError(404, (properties = { title: "User not found" }));
        }

        let query = formatAggPipeline(req.query, req.i18n.t("lang"));
        var pageParams = {
            description: `${req.params.username}'s Collection on Karasu-OS.com`,
            path: "collection",
            query: req.query,
            user: req.user,
        };

        var isCollectionOwner = req.user && req.user.name === user.info.name;
        pageParams.title = isCollectionOwner
            ? req.i18n.t("title.my_collection")
            : req.i18n.t("title.user_collection", { username: user.info.name });

        var isPrivate = user.profile.isPrivate && !isCollectionOwner;
        if (isPrivate) {
            pageParams.isPrivate = true;
        } else {
            pageParams.ownedStats = {
                demon: await userService.getOwnedCardsStats(
                    user.info.name,
                    "Demon"
                ),
                memory: await userService.getOwnedCardsStats(
                    user.info.name,
                    "Memory"
                ),
            };
            pageParams.totalStats = {
                demon: await cardService.getGlobalStats("Demon"),
                memory: await cardService.getGlobalStats("Memory"),
            };

            ["demon", "memory"].forEach((t) => {
                for ([category, entries] of Object.entries(
                    pageParams.totalStats[t]
                )) {
                    for (entry in entries) {
                        pageParams.ownedStats[t][category][entry] =
                            pageParams.ownedStats[t][category][entry] || 0;
                    }
                }
            });
        }

        return res.render("cardsList", pageParams);
    } catch (e) {
        return next(e);
    }
};

exports.getFavouriteCardsPage = async function (req, res, next) {
    try {
        var user = await userService.getUser(req.params.username);
        if (!user) {
            throw createError(404, (properties = { title: "User not found" }));
        }

        let query = formatAggPipeline(req.query, req.i18n.t("lang"));
        var pageParams = {
            description: `${req.params.username}'s favourite Obey Me cards on Karasu-OS.com`,
            path: "fav",
            query: req.query,
            user: req.user,
        };

        var isCollectionOwner = req.user && req.user.name === user.info.name;
        pageParams.title = isCollectionOwner
            ? req.i18n.t("title.my_favourites")
            : req.i18n.t("title.user_favourites", { username: user.info.name });
        pageParams.isPrivate = user.profile.isPrivate && !isCollectionOwner;

        return res.render("cardsList", pageParams);
    } catch (e) {
        return next(e);
    }
};

exports.getCardDetailPage = async function (req, res, next) {
    try {
        let cardData = await cardService.getCard({
            name: req.params.card.replace(/_/g, " "),
        });
        cardData.source_link = cardData.source.map((x) =>
            encodeURIComponent(x.replace(/ /g, "_"))
        );

        let title = cardData.name;
        let lang = req.i18n.t("lang");
        if (lang === "ja") {
            if (cardData.ja_name !== "???") {
                title = cardData.ja_name;
            }
            cardData.source = await getSourceInLanguage(cardData.source, "ja");
        }

        let user = req.user;
        // TODO: remove tree nodes that does not belong to this card.
        if (user) {
            user.tree = (await userService.getUser(user.name)).tree;
        }

        let stats = await cardService.getCardStats(user, cardData.uniqueName);

        return res.render("cardDetail", {
            title: title,
            description: `View "${cardData.name}" and other Obey Me cards on Karasu-OS.com`,
            card: cardData,
            user: user,
            stats: stats,
        });
    } catch (e) {
        return next(e);
    }
};

async function getSourceInLanguage(sources, lng) {
    var arr = [];
    for (const source of sources) {
        // temporary exceptions
        switch (source) {
            case "Chapter M":
                arr.push("Mの章");
                break;
            case "Chapter A":
                arr.push("Aの章");
                break;
            case "Chapter G":
                arr.push("Gの章");
                break;
            default: {
                let relatedEvent = await eventService.getEvent({
                    "name.en": source,
                });
                if (!relatedEvent) {
                    arr.push(source);
                } else if (
                    relatedEvent.name[lng] !== "???" &&
                    relatedEvent.name[lng] !== ""
                ) {
                    arr.push(relatedEvent.name.ja);
                }
            }
        }
    }
    return arr;
}

exports.getProfilePage = async function (req, res, next) {
    try {
        var user = await userService.getUser(
            decodeURIComponent(req.params.username)
        );
        if (!user) {
            throw createError(404, (properties = { title: "User not found" }));
        }

        var title;
        if (req.user && req.user.name === user.info.name) {
            title = req.i18n.t("title.my_profile");
        } else {
            title = req.i18n.t("title.user_profile", {
                username: user.info.name,
            });
        }

        var cards = {
            owned: await userService.getOwnedCardsPreview(user.info.name),
            faved: await userService.getFaveCardsPreview(user.info.name),
        };

        var profileInfo = await userService.getProfileInfo(
            user.info.name,
            req.i18n.t("lang")
        );

        res.render("profile", {
            title: title,
            description: `See ${user.info.name}'s profile on Karasu-OS.com`,
            user: req.user,
            profileInfo: profileInfo,
            cards: cards,
        });
    } catch (e) {
        return next(e);
    }
};

exports.getAnimationList = async function (req, res, next) {
    try {
        let cards = await cardService.getCards(
            { rarity: "UR+" },
            { name: 1, uniqueName: 1, animation: 1 }
        );
        return res.render("animationList", {
            title: "Animations",
            description: "A list of Obey Me! card animations.",
            user: req.user,
            cards: cards,
        });
    } catch (e) {
        Sentry.captureException(e);
        return next(e);
    }
};

// Collection functions
exports.getCards = async function (req, res) {
    try {
        let query = formatAggPipeline(req.query, req.i18n.t("lang"));
        let cards = await cardService.aggregateCards(query);

        let user;
        switch (req.query.path) {
            case "collection":
                user = await userService.getUser(req.query.user);
                cards = cards.filter((card) =>
                    user.cards.owned.includes(card.uniqueName)
                );
                break;
            case "fav":
                user = await userService.getUser(req.query.user);
                cards = cards.filter((card) =>
                    user.cards.faved.includes(card.uniqueName)
                );
                break;
            default:
                let type = req.query.cards;
                if (type && req.user) {
                    user = await userService.getUser(req.user.name);
                    if (type === "owned") {
                        cards = cards.filter((card) =>
                            user.cards.owned.includes(card.uniqueName)
                        );
                    } else if (type === "not_owned") {
                        cards = cards.filter(
                            (card) =>
                                !user.cards.owned.includes(card.uniqueName)
                        );
                    }
                }
        }

        return res.json({ err: null, cards: cards });
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: true, cards: [], message: e.message });
    }
};
// TODO: give getCards more flexibility
exports.getCards2 = async function (req, res) {
    try {
        let pipeline = formatPipeline2(req.query);
        let cards = await cardService.aggregateCards(pipeline);
        return res.json({ err: null, cards: cards });
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: true, cards: [], message: e.message });
    }
};

function getNodeData(card, cost) {
    if (card.nodes.length === 0) return "?";
    let node = card.nodes.find(
        (x) => x.grimmCost == cost && x.type != "level_up" && x.type != "flower"
    );
    // TODO: add exceptions
    if (card.rarity === "N" && cost > 2000) return "--";
    if (card.rarity === "R" && cost > 4500) return "--";
    if (card.rarity === "SR" && cost > 6000) return "--";
    if (card.rarity === "SSR" && cost > 15000) return "--";
    if (node) {
        let str = "<div style='position:relative;'>";
        if (node.unlocked) {
            str += '<div class="unlocked"></div>';
        }
        if (node.type === "icon") {
            if (card.type === "Demon") {
                let unlocked = "";
                if (node.reward.indexOf("(Unlocked)") !== -1) {
                    unlocked = "_Unlocked";
                }
                str += `<img src="https://obey-me.fandom.com/wiki/Special:Redirect/file/${card.name.replace(
                    /:/g,
                    " -"
                )}${unlocked}_icon.png?width=32" onerror="this.src='/images/tree_rewards/${
                    node.type
                }.png'" alt="${node.reward}" style="width:2em;height:2em;">`;
            } else {
                // check wrong names
                if (
                    !node.reward.startsWith(card.name) ||
                    !node.reward.endsWith(")")
                ) {
                    str += `<img src="/images/tree_rewards/${node.type}.png" alt="${node.reward}" style="width:2em;height:2em;">`;
                } else {
                    let charNum =
                        "_" +
                        (card.characters.indexOf(
                            node.reward.substring(
                                node.reward.lastIndexOf("(") + 1,
                                node.reward.length - 1
                            )
                        ) +
                            1);
                    str += `<img src="https://obey-me.fandom.com/wiki/Special:Redirect/file/${card.name.replace(
                        /:/g,
                        " -"
                    )}${charNum}_icon.png?width=64" onerror="this.src='/images/tree_rewards/${
                        node.type
                    }.png'" alt="${node.reward}" style="width:2em;height:2em;">`;
                }
            }
        } else {
            str += `<img src="/images/tree_rewards/${node.type}.png" alt="${node.reward}" style="width:2em;height:2em;">`;
        }
        return str + "</div>";
    }
    return "?";
}

function getRankUpNodeData(card, level) {
    if (card.nodes.length === 0) return "?";
    let node = card.nodes.find((x) => x.reward.startsWith(level));

    if (level !== "Devil's Flower") {
        level = parseInt(level.substring(3, 5));
        if (card.rarity === "N" && level > 10) return "--";
        if (card.rarity === "R" && level > 20) return "--";
        if (card.rarity === "SR" && level > 30) return "--";
        if (card.rarity === "SSR" && level > 40) return "--";
    }

    if (node) {
        let str = "<div style='position:relative;'>";
        if (node.unlocked) {
            str += '<div class="unlocked"></div>';
        }
        str += `<img src="/images/nodes/${node.type}.png" style="width:2em;height:2em;">`;
        return str + "</div>";
    }

    return "?";
}

exports.getTreeData = async function (req, res, next) {
    try {
        let sort = {};
        if (req.query.name) {
            sort["name"] = parseInt(req.query.name) === 0 ? -1 : 1;
        } else {
            sort["number"] = -1;
        }

        let keywords = "";
        if (req.query.filter.length > 0) {
            keywords = req.query.filter[0];
        }

        let match = { name: { $regex: keywords, $options: "i" } };
        if (req.query.rarity && req.query.rarity !== "All") {
            match["rarity"] = req.query.rarity;
        }
        if (req.query.attribute && req.query.attribute !== "All") {
            match["attribute"] = req.query.attribute;
        }
        if (req.query.type && req.query.type !== "All") {
            match["type"] = req.query.type;
        }

        let username = req.user ? req.user.name : "KarasuOS";
        let cards = await userService.getTreeTrackData({
            username: username,
            pageNum: req.query.page,
            sort: sort,
            match: match,
        });

        let rows = [],
            td;
        let isRankUp = req.query.path === "/tree-tracker/rank-up";
        let headers = isRankUp
            ? ["Lv.10", "Lv.20", "Lv.30", "Lv.40", "Lv.50", "Devil's Flower"]
            : [2000, 3000, 4500, 6000, 8000, 10000, 15000, 20000];

        cards.forEach((card, i) => {
            td = [
                `<a href="/card/${encodeURIComponent(
                    card.name.replace(/ /g, "_")
                )}"><img class="mr-2" src="/images/cards/S/${
                    card._id
                }.jpg" style="float:left;width:2em;height:2em;">${
                    req.lang === "ja" ? card.ja_name : card.name
                }</a>`,
            ];
            headers.forEach((i) => {
                if (isRankUp) {
                    td.push(getRankUpNodeData(card, i));
                } else {
                    td.push(getNodeData(card, i));
                }
            });
            rows.push(td);
        });
        headers.unshift("Name");

        return res.json({
            total_rows: cards.length === 0 ? 0 : cards[0].totalCount,
            rows: rows,
            headers: headers,
        });
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: true, message: e.message });
    }
};

// Admin card management
exports.getEditCardPage = async function (req, res, next) {
    if (!req.params.card) {
        return res.render("cardEdit", { title: "Add Card", user: req.user });
    }

    try {
        let cardData = await cardService.getCard({
            uniqueName: req.params.card,
        });

        if (!cardData) {
            throw createError(404, (properties = { title: "Card not found" }));
        }

        return res.render("cardEdit", {
            title: "Edit Card: " + cardData.name,
            card: cardData,
            pendingSuggestion: await suggestionService.getSuggestion({
                status: "pending",
                page: "/card/" + cardData.uniqueName,
                user: { $ne: req.user.name },
            }),
            user: req.user,
        });
    } catch (e) {
        Sentry.captureException(e);
        return next(e);
    }
};

exports.addNewCard = async function (req, res) {
    const result = await cardService.addNewCard(
        req.body.cardData,
        req.user.name
    );
    return res.json(result);
};

exports.updateCard = async function (req, res) {
    let verifyTree = await exports.isVerifiedTreeData(
        req.params.card,
        req.body.cardData
    );
    if (verifyTree.err) {
        return res.json({ err: true, message: verifyTree.message });
    }

    let result = await cardService.updateCard({
        user: req.user.name,
        originalUniqueName: req.params.card,
        cardData: req.body.cardData,
    });

    if (result.err) {
        return res.json({ err: true, message: result.message });
    } else {
        miscController.notifyAdmin(
            `Card updated. \`\`${req.user.name}\`\` just updated: \`\`${req.params.card}\`\`.`
        );
        return res.json({ err: null, message: "Card updated!" });
    }
};

exports.deleteCard = async function (req, res) {
    try {
        var result = await cardService.deleteCard(req.body.card);
        return res.json(result);
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: e });
    }
};

/* helper */
function escapeSearchString(str) {
    return str.replace(/[.*+?^${}()|[\]\\'"]/g, "\\$&");
}

// TODO: refactor
function formatAggPipeline(obj, language = "en") {
    let query = {};
    let sum = [];
    let sortby, order, sortbyVal;
    let match, addFields, sort, project, pipeline;

    for (let [key, value] of Object.entries(obj)) {
        if (value === "") continue;
        if (["characters", "attribute", "rarity"].includes(key)) {
            query[key] = { $in: [].concat(value) };
        } else if (key === "search") {
            // var lang = i18next.t("lang") === "zh" ? "en" : i18next.t("lang");
            // query["name."+lang] = new RegExp(value, 'i');
            value = escapeSearchString(value);
            if (language === "ja") {
                query["ja_name"] = new RegExp(value, "i");
            } else {
                query["name"] = new RegExp(value, "i");
            }
        } else if (key === "sortby") {
            if (!value.match(/^(min|max|fdt)_(-1|1)$/)) {
                continue;
            }
            let t = value.split("_");
            sortby = "total";
            sortbyVal = t[0];
            order = parseInt(t[1]);
        }
    }

    ["pride", "greed", "envy", "wrath", "lust", "gluttony", "sloth"].forEach(
        (attr) => {
            sum.push(`$strength.${attr}.${sortbyVal}`);
        }
    );

    match = { $match: query };

    addFields = {
        $addFields: {
            total: { $sum: sum },
        },
    };

    sort = { $sort: {} };
    if (sortby) {
        sort["$sort"][sortby] = order;
    }
    sort["$sort"]["number"] = -1;

    project = {
        $project: {
            name: 1,
            ja_name: 1,
            uniqueName: 1,
            type: 1,
            total: 1,
        },
    };

    pipeline = [match];
    if (sortby === "total") {
        pipeline.push(addFields);
    }
    pipeline.push(sort, project);

    return pipeline;
}

function formatPipeline2(query) {
    let pipeline = [
        {
            $match: {
                characters: {
                    $in: [query.characters],
                },
            },
        },
    ];

    if (query.rarity) {
        pipeline.push({
            $match: {
                rarity: query.rarity,
            },
        });
    }

    if (query.attribute) {
        pipeline.push({
            $match: {
                attribute: query.attribute,
            },
        });
    }

    if (query.source) {
        let source = query.source;
        if (source === "LonelyDevil") query.source = "PopQuiz";

        pipeline.push(
            {
                $unwind: {
                    path: "$source",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $lookup: {
                    from: "events",
                    localField: "source",
                    foreignField: "name.en",
                    as: "result",
                },
            },
            {
                $match: {
                    "result.type": query.source,
                },
            }
        );

        if (source === "LonelyDevil") {
            pipeline.push({
                $match: {
                    "result.isLonelyDevil": true,
                },
            });
        }
    }

    pipeline.push(
        {
            $sort: {
                number: -1,
            },
        },
        {
            $project: {
                name: 1,
                uniqueName: 1,
                type: 1,
            },
        }
    );

    return pipeline;
}

exports.isVerifiedTreeData = async function (name, data) {
    try {
        let card = await cardService.getCard({ uniqueName: name });

        if (!card.dt || card.dt.length === 0) {
            return { err: null };
        }

        for (const node of card.dt) {
            if (node.reward === "???") {
                continue;
            }

            // NOTE: newNode = same node reward in new data
            let newNode = data.dt.find(
                (element) =>
                    element.reward === node.reward && element.type === node.type
            );

            if (!newNode) {
                return { err: true, message: node.reward + " is removed." };
            }

            if (!newNode._id) {
                newNode._id = node._id;
            } else if (newNode._id && newNode._id != node._id) {
                return {
                    err: true,
                    message: node.reward + " has mismatched id.",
                };
            }
        }

        return { err: null };
    } catch (e) {
        Sentry.captureException(e);
        return { err: true, message: e.message };
    }
};

// TODO: use vue
exports.getIconPage = async function (req, res, next) {
    try {
        const characters = [
            "Lucifer",
            "Mammon",
            "Leviathan",
            "Satan",
            "Asmodeus",
            "Beelzebub",
            "Belphegor",
            "Diavolo",
            "Barbatos",
            "Simeon",
            "Luke",
            "Solomon",
            "Thirteen",
            "Mephistopheles",
            "Raphael",
        ];
        const character = req.params.character;
        if (!characters.includes(character))
            return next(
                createError(404, (properties = { title: "404 Page not found" }))
            );

        let cards = await cardService.getCards(
            {
                characters: { $in: [character] },
                $nor: [{ rarity: "N" }, { rarity: "R" }],
            },
            { name: 1, type: 1, characters: 1, rarity: 1 }
        );

        return res.render("iconList", {
            title: character + "'s Icons",
            description:
                "A complete list of Obey Me " +
                character +
                "'s icons on karasu-os.com.",
            user: req.user,
            character: character,
            cards: cards,
        });
    } catch (e) {
        Sentry.captureException(e);
        return next(e);
    }
};

exports.getCardDirectory = function (req, res, next) {
    return res.render("cardDir", {
        title: "Card Directory",
        description: "",
        user: req.user,
    });
};
