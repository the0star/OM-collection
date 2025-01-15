const Cards = require("../models/cards");
const HiddenCards = require("../models/hiddenCards.js");
const Revisions = require("../models/revisions");

const Sentry = require("@sentry/node");
const createError = require("http-errors");

const fileService = require("../services/fileService");
const userService = require("../services/userService");

const skillCharge = require("../staticData/skills.json");

exports.getCards = async function (query = {}, returnVal = {}) {
    return await Cards.find(query, returnVal).sort({ number: -1 });
};

exports.aggregateCards = async function (pipeline) {
    return await Cards.aggregate(pipeline);
};

exports.getHiddenCards = async function () {
    return await HiddenCards.find().sort({ number: -1 });
};

exports.getCard = async function (query = {}) {
    return await Cards.findOne(query);
};

exports.getHiddenCard = async function (cardName, user) {
    if (!user || !user.isAdmin) {
        throw createError(404, (properties = { title: "Card not found" }));
    }
    return await HiddenCards.findOne({ name: cardName });
};

exports.isHidden = async function (cardName) {
    var card = await HiddenCards.findOne({ name: cardName });
    return Boolean(card);
};

exports.getGlobalStats = async function (cardType) {
    try {
        return (
            await Cards.aggregate([
                { $match: { type: cardType } },
                {
                    $facet: {
                        characters: [
                            { $unwind: "$characters" },
                            {
                                $group: {
                                    _id: "$characters",
                                    count: { $sum: 1 },
                                },
                            },
                            {
                                $project: {
                                    k: "$_id",
                                    v: "$count",
                                    _id: false,
                                },
                            },
                        ],
                        rarity: [
                            { $group: { _id: "$rarity", count: { $sum: 1 } } },
                            {
                                $project: {
                                    k: "$_id",
                                    v: "$count",
                                    _id: false,
                                },
                            },
                        ],
                        attribute: [
                            {
                                $group: {
                                    _id: "$attribute",
                                    count: { $sum: 1 },
                                },
                            },
                            {
                                $project: {
                                    k: "$_id",
                                    v: "$count",
                                    _id: false,
                                },
                            },
                        ],
                        cards: [
                            { $group: { _id: "$type", count: { $sum: 1 } } },
                            {
                                $project: {
                                    k: "$_id",
                                    v: "$count",
                                    _id: false,
                                },
                            },
                        ],
                    },
                },
                {
                    $project: {
                        characters: { $arrayToObject: "$characters" },
                        rarity: { $arrayToObject: "$rarity" },
                        attribute: { $arrayToObject: "$attribute" },
                        cards: { $arrayToObject: "$cards" },
                    },
                },
            ])
        )[0];
    } catch (e) {
        console.error(e.message);
        Sentry.captureException(e);
    }
};

exports.encodeCardName = function (cardName) {
    return encodeURIComponent(cardName.replace(/ /g, "_"));
};

exports.decodeCardName = function (cardName) {
    return decodeURIComponent(cardName.replace(/_/g, " "));
};

async function getLatestCardNum(rarity) {
    try {
        var query = {};
        if (rarity !== "UR" && rarity !== "UR+") {
            query = { rarity: rarity };
        }

        var last = await Cards.find(query).sort({ number: -1 }).limit(1);
        return last[0].number + 1;
    } catch (e) {
        return 99999; // reserved error number
    }
}

exports.getCardStats = async function (user, cardName) {
    let stats = {};
    if (user) {
        stats.ownsCard = await userService.ownsCard(user.name, cardName);
        stats.favesCard = await userService.favesCard(user.name, cardName);
    }

    let totalusers = await userService.getNumberOfValidUsers();
    let counts = await getCardCounts(cardName);
    stats.ownedTotal = ((counts.owned / totalusers) * 100).toFixed(2);
    stats.favedTotal = ((counts.faved / totalusers) * 100).toFixed(2);

    return stats;
};

// TODO rewrite using unwind
function getCardCounts(card) {
    var pipeline = [
        {
            $lookup: {
                from: "users",
                let: { uniqueName: "$uniqueName" },
                pipeline: [
                    {
                        $project: {
                            uniqueName: "$$uniqueName",
                            owned: {
                                $cond: [
                                    { $in: ["$$uniqueName", "$cards.owned"] },
                                    1,
                                    0,
                                ],
                            },
                            faved: {
                                $cond: [
                                    { $in: ["$$uniqueName", "$cards.faved"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: "$uniqueName",
                            owned: { $sum: "$owned" },
                            faved: { $sum: "$faved" },
                        },
                    },
                ],
                as: "count",
            },
        },
        {
            $project: {
                _id: 0,
                uniqueName: 1,
                owned: { $arrayElemAt: ["$count.owned", 0] },
                faved: { $arrayElemAt: ["$count.faved", 0] },
            },
        },
    ];

    if (card) {
        var match = { $match: { uniqueName: card } };
        pipeline.splice(0, 0, match);
    }

    var promise = Cards.aggregate(pipeline).then((result) => result[0]);

    return promise;
}

// TODO rework?
exports.getTotalTreeStats = async function () {
    return await Cards.aggregate([
        { $project: { dt: 1 } },
        {
            $unwind: {
                path: "$dt",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $replaceRoot: {
                newRoot: { $mergeObjects: ["$dt"] },
            },
        },
        {
            $match: {
                type: "item",
                reward: { $not: { $regex: /\)$/g } },
            },
        },
        {
            $group: {
                _id: "$reward",
                count: { $count: {} },
            },
        },
        { $sort: { _id: 1 } },
    ]);
};

// TODO: reduce aggregation size.
getOwnedFilter = function (user) {
    return [
        {
            $lookup: {
                from: "users",
                let: { cardUniqueName: "$uniqueName" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$info.name", user.name] },
                                    {
                                        $in: [
                                            "$$cardUniqueName",
                                            "$cards.owned",
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                ],
                as: "owned",
            },
        },
        {
            $unwind: {
                path: "$owned",
                preserveNullAndEmptyArrays: false,
            },
        },
        { $project: { owned: 0 } },
    ];
};

// TODO: fix $lookup exceeds 16MB BSON limit.
// getLockedFilter = function (user) {
// 	return [
// 		{ $lookup: {
// 				from: "users",
// 				let: { nodeId: "$dt._id" },
// 				pipeline: [
// 					{ $match: { $expr: { $eq: ["$info.name", user.name] } } },
// 					{	$unwind: {
// 						path: "$tree",
// 						preserveNullAndEmptyArrays: false}},
// 					{ $match: { $expr: { $not: { $eq: ["$$nodeId", "$tree"] } } } }
// 				],
// 				as: "locked"
// 		}},
// 		{ $project: {"locked": 0} }];
// };

findTreeNodes = async function (matchField, matchValue, user, owned, locked) {
    let match = {};
    match[matchField] = matchValue;

    let pipeline = [
        {
            $unwind: {
                path: "$dt",
                preserveNullAndEmptyArrays: false,
            },
        },
        { $match: match },
        { $sort: { number: -1 } },
    ];

    let doc = await Cards.aggregate(pipeline);

    if (user && owned) {
        // let ownedFilter = getOwnedFilter(user);
        // pipeline = pipeline.concat(ownedFilter);

        let cards = (await userService.getUser(user.name)).cards.owned;
        doc = doc.filter((x) => cards.includes(x.uniqueName));
    }

    if (user && locked) {
        // let lockedFilter = getLockedFilter(user);
        // pipeline = pipeline.concat(lockedFilter);

        let nodes = (await userService.getUser(user.name)).tree;
        doc = doc.filter((x) => !nodes.includes(x.dt._id));
    }

    // pipeline.push(
    // 	{ $sort: { number: -1 } },
    // 	{
    // 		$project: {
    // 			"name": 1,
    // 			"ja_name": 1,
    // 			"uniqueName": 1,
    // 			"dt.reward": 1,
    // 			"dt.type": 1,
    // 			"dt.count": 1,
    // 			"dt.requirements": 1,
    // 			"dt.grimmCost": 1
    // 		}
    // 	});

    return doc;
};

exports.getTreeNodesWithRewardItem = async function (
    item,
    user,
    owned,
    locked
) {
    return await findTreeNodes("dt.reward", item, user, owned, locked);
};

exports.getTreeNodesWithUnlockItem = async function (
    item,
    user,
    owned,
    locked
) {
    return await findTreeNodes(
        "dt.requirements.name",
        item,
        user,
        owned,
        locked
    );
};

exports.getTreeNodesWithMajolishType = async function (
    type,
    user,
    owned,
    locked
) {
    return await findTreeNodes("dt.type", type, user, owned, locked);
};

exports.getCardsWithChargeSpeed = async function (speed, user, owned) {
    let skillDescriptions = skillCharge[speed];
    if (!skillDescriptions) return [];

    let pipeline = [
        {
            $match: {
                "skills.description": { $in: skillDescriptions },
                rarity: { $in: ["SSR", "UR", "UR+"] }, // SR and below have duplicate skills with different charging time..
            },
        },
    ];

    if (user && owned) {
        let ownedFilter = getOwnedFilter(user);
        pipeline = pipeline.concat(ownedFilter);
    }

    pipeline.push(
        { $sort: { number: -1 } },
        {
            $project: {
                name: 1,
                uniqueName: 1,
            },
        }
    );

    return await Cards.aggregate(pipeline);
};

exports.findSkills = async function (keyword, user, owned) {
    let pipeline = [
        {
            $sort: {
                number: -1,
            },
        },
        {
            $project: {
                name: 1,
                uniqueName: 1,
                ja_name: 1,
                skills: 1,
            },
        },
        {
            $unwind: {
                path: "$skills",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $match: {
                "skills.description": {
                    $regex: keyword,
                    $options: "i",
                },
            },
        },
    ];

    if (user && owned) {
        let ownedFilter = getOwnedFilter(user);
        pipeline = pipeline.concat(ownedFilter);
    }

    return await Cards.aggregate(pipeline);
};

exports.updateCard = async function (data) {
    var originalUniqueName = data.originalUniqueName;
    var newUniqueName = data.cardData.uniqueName;
    var promiseList = [];
    var promiseCard = Cards.findOneAndUpdate(
        { uniqueName: originalUniqueName },
        data.cardData,
        { returnDocument: "after" }
    );
    var promiseCard2 = promiseCard.then((result) => {
        return Revisions.create({
            title: result.name,
            type: "card",
            user: data.user,
            timestamp: new Date(),
            data: result,
        });
    });
    promiseList.push(promiseCard2);

    if (newUniqueName !== originalUniqueName) {
        var promiseCollections = userService.renameCardInCollections(
            originalUniqueName,
            newUniqueName
        );
        promiseList.push(promiseCollections);
    }

    if (data.images) {
        var promiseL = fileService.saveImage(
            data.images.L,
            originalUniqueName,
            newUniqueName,
            "cards/L"
        );
        var promiseLB = fileService.saveImage(
            data.images.LB,
            originalUniqueName + "_b",
            newUniqueName + "_b",
            "cards/L"
        );
        var promiseS = fileService.saveImage(
            data.images.S,
            originalUniqueName,
            newUniqueName,
            "cards/S"
        );
        promiseList.push(promiseL, promiseLB, promiseS);
    }

    return await Promise.all(promiseList)
        .then(() => {
            return { err: false, message: "Card successfully updated!" };
        })
        .catch((reason) => {
            return { err: true, message: reason.message };
        });
};

function getDefaultTree(name, data) {
    let tree = [];
    const rar = {
        N: 1,
        R: 2,
        SR: 3,
        SSR: 4,
        UR: 5,
        "UR+": 5,
    };
    const levelCost = [3000, 5000, 8000, 12000, 20000];
    const levelCostSR = [3000, 4500, 6000];
    const flowerCost = {
        N: 10000,
        R: 20000,
        SR: 30000,
        SSR: 50000,
        UR: 80000,
        "UR+": 80000,
    };

    for (let i = 0; i < rar[data.rarity]; i++) {
        tree.push({
            reward: `Lv.${i + 1}0 Rank Up`,
            type: "level_up",
            requirements: [],
            grimmCost: rar[data.rarity] > 3 ? levelCost[i] : levelCostSR[i],
        });
    }

    if (data.type == "Demon") {
        tree.push(
            {
                reward: "Devil's Flower",
                type: "flower",
                requirements: [],
                grimmCost: flowerCost[data.rarity],
            },
            {
                reward: data.name + " (Locked)",
                type: "icon",
                requirements: [],
                grimmCost: "",
            },
            {
                reward: data.name + " (Unlocked)",
                type: "icon",
                requirements: [],
                grimmCost: "",
            }
        );
    } else {
        data.characters.forEach((i) => {
            tree.push({
                reward: `${data.name} (${i})`,
                type: "icon",
                requirements: [],
                grimmCost: "",
            });
        });
    }

    return tree;
}

exports.addNewCard = async function (cardData, images = "", creator) {
    try {
        if (cardData.isHidden == "true") {
            if (cardData.number === "") {
                cardData.number =
                    (await HiddenCards.estimatedDocumentCount()) + 1;
            }
            await HiddenCards.create(cardData);
        } else {
            if (cardData.number === "") {
                cardData.number = await getLatestCardNum(cardData.rarity);
            }
            cardData.dt = getDefaultTree(cardData.name, cardData);
            await Cards.create(cardData);
            await Revisions.create({
                title: cardData.name,
                type: "card",
                user: creator,
                timestamp: new Date(),
                data: cardData,
            });
        }

        if (images) {
            await fileService.saveImage(
                images.L,
                null,
                cardData.uniqueName,
                "cards/L"
            );
            await fileService.saveImage(
                images.LB,
                null,
                cardData.uniqueName + "_b",
                "cards/L"
            );
            await fileService.saveImage(
                images.S,
                null,
                cardData.uniqueName,
                "cards/S"
            );
        }

        return { err: null, message: "Card added!" };
    } catch (err) {
        Sentry.captureException(err);
        return { err: true, message: err.message };
    }
};

exports.deleteCard = async function (cardName) {
    var card = await Cards.findOneAndRemove({ uniqueName: cardName });
    if (!card) {
        card = await HiddenCards.findOneAndRemove({ uniqueName: cardName });
        if (!card) {
            return createError(404, (properties = { title: "Card not found" }));
        }
    }
    return removeCardDependencies(cardName);
};

async function removeCardDependencies(cardName) {
    var promiseCollections = userService.deleteCardInCollections(cardName);
    var promiseL = await fileService.deleteImage("cards/L", cardName);
    var promiseLB = await fileService.deleteImage("cards/L", cardName + "_b");
    var promiseS = await fileService.deleteImage("cards/S", cardName);

    return Promise.all([promiseCollections, promiseL, promiseLB, promiseS])
        .catch((reason) => {
            return { success: false, error: reason };
        })
        .then(() => {
            return { success: true };
        });
}

exports.makeCardPublic = async function (cardName) {
    var card = await HiddenCards.findOneAndRemove({ uniqueName: cardName });
    if (!card) {
        throw createError(404, (properties = { title: "No such card" }));
    }
    var newCard = new Cards(card.toObject());
    newCard.number = await getLatestCardNum(newCard.rarity);
    return await newCard.save();
};
