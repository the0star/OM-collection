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
        const cardName = req.params.card.replace(/_/g, " ");
        const cardData = await cardService.getCard({ name: cardName });

        if (!cardData) {
            throw createError(404, { title: "Card not found" });
        }

        cardData.source_link = cardData.source.map((x) =>
            encodeURIComponent(x.replace(/ /g, "_"))
        );

        let title = cardData.name;
        const lang = req.i18n.t("lang");
        if (lang === "ja") {
            if (cardData.ja_name !== "???") {
                title = cardData.ja_name;
            }
            cardData.source = await getEventNames_JA(cardData.source);
        }

        let user = req.user;
        // TODO: remove tree nodes that does not belong to this card.
        if (user) {
            user.tree = (await userService.getUser(user.name)).tree;
        }

        const stats = await cardService.getCardStats(user, cardData.uniqueName);

        return res.render("cardDetail", {
            title: title,
            description: `View "${cardData.name}" and other Obey Me cards on Karasu-OS.com`,
            card: cardData,
            user,
            stats,
        });
    } catch (e) {
        return next(e);
    }
};

async function getEventNames_JA(sources) {
    const arr = [];
    const permanent_gacha = {
        "Chapter M": "Mの章",
        "Chapter A": "Aの章",
        "Chapter G": "Gの章",
    };

    for (const source of sources) {
        if (permanent_gacha[source]) {
            arr.push(permanent_gacha[source]);
            continue;
        }

        try {
            const relatedEvent = await eventService.getEvent({
                "name.en": source,
            });
            if (
                relatedEvent &&
                relatedEvent.name?.ja &&
                relatedEvent.name.ja !== "???" &&
                relatedEvent.name.ja.trim() !== ""
            ) {
                arr.push(relatedEvent.name.ja);
            } else {
                arr.push(source);
            }
        } catch (err) {
            console.error(`Failed to fetch event for source: ${source}`, err);
            arr.push(source);
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

exports.getTreeData = async function (req, res) {
    try {
        const { type, character, rarity, attribute, reward } = req.query;

        if (!req.user) {
            return res.status(400).json({ error: "Log in required" });
        }

        // 1. Get user data
        const user = await userService.getUser(req.user.name);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userRewards = new Set(user.tree.map((id) => id.toString()));

        // 2. Build query for cards
        const pipeline = [
            {
                $match: {
                    type,
                    characters: character,
                },
            },
        ];

        if (rarity === "UR") {
            pipeline.push({ $match: { rarity: { $in: ["UR", "UR+"] } } });
        } else {
            pipeline.push({ $match: { rarity } });
        }
        if (attribute && attribute !== "All") {
            pipeline.push({ $match: { attribute } });
        }
        if (reward && reward !== "All") {
            pipeline.push({ $match: { "dt.reward": reward } });
        }

        pipeline.push({
            $project: {
                name: 1,
                uniqueName: 1,
                ja_name: 1,
                dt: {
                    $map: {
                        input: {
                            $filter: {
                                input: "$dt",
                                as: "r",
                                cond: {
                                    $not: {
                                        $in: [
                                            "$$r.type",
                                            ["level_up", "flower"],
                                        ],
                                    },
                                },
                            },
                        },
                        as: "r",
                        in: {
                            _id: "$$r._id",
                            name: "$$r.reward",
                            type: "$$r.type",
                            cost: "$$r.grimmCost",
                        },
                    },
                },
            },
        });
        pipeline.push({
            $sort: {
                name: 1,
            },
        });

        // 3. Get cards
        const cards = await cardService.aggregateCards(pipeline);
        const annotatedCards = cards.map((card) => ({
            ...card,
            owned: user.cards.owned.includes(card.uniqueName),
            dt: card.dt
                .map((r) => ({
                    ...r,
                    owned: userRewards.has(r._id.toString()),
                }))
                .sort((a, b) => a.cost - b.cost),
        }));

        return res.json(annotatedCards);
    } catch (e) {
        console.error(e);
        Sentry.captureException(e);
        return res.status(500).json({ error: "Server error" });
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

function formatAggPipeline(obj, language = "en") {
    const query = {};
    const sum = [];
    let sortby, order, sortbyVal;

    for (const [key, value] of Object.entries(obj)) {
        if (!value) continue;
        switch (key) {
            case "characters":
                query["$or"] = [
                    { type: "Memory", characters: { $all: [].concat(value) } },
                    { type: "Demon", characters: { $in: [].concat(value) } },
                ];
                break;

            case "attribute":
            case "rarity":
                query[key] = { $in: [].concat(value) };
                break;

            case "search":
                const searchValue = escapeSearchString(value);
                query[language === "ja" ? "ja_name" : "name"] = new RegExp(
                    searchValue,
                    "i"
                );
                break;

            case "sortby":
                if (!/^(min|max|fdt)_(-1|1)$/.test(value)) continue;
                [sortbyVal, order] = value.split("_");
                sortby = "total";
                order = parseInt(order, 10);
                break;
        }
    }

    const attributes = [
        "pride",
        "greed",
        "envy",
        "wrath",
        "lust",
        "gluttony",
        "sloth",
    ];
    sum.push(...attributes.map((attr) => `$strength.${attr}.${sortbyVal}`));

    const pipeline = [
        { $match: query },
        ...(sortby === "total"
            ? [{ $addFields: { total: { $sum: sum } } }]
            : []),
        { $sort: { [sortby || "number"]: order || -1 } },
        {
            $project: {
                name: 1,
                ja_name: 1,
                uniqueName: 1,
                type: 1,
                total: 1,
                _id: 0,
            },
        },
    ];

    return pipeline;
}

// TODO: what is this..?
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
