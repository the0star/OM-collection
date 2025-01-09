const Sentry = require("@sentry/node");
const ObjectId = require("mongodb").ObjectID;

const suggestionService = require("../services/suggestionService");
const Users = require("../models/users.js");

exports.getUser = async function (username) {
  var usernameRegexp = new RegExp("^" + username + "$", "i");
  try {
    var user = await Users.findOne({ "info.name": { $regex: usernameRegexp } });
    return user;
  } catch (e) {
    console.error(e.message);
    Sentry.captureException(e);
  }
};

exports.getAccountData = async function (username) {
  let usernameRegexp = new RegExp("^" + username + "$", "i");
  let user = (
    await Users.aggregate([
      { $match: { "info.name": { $regex: usernameRegexp } } },
      {
        $project: {
          name: "$info.name",
          email: "$info.email",
          profile: "$profile",
          _id: false,
        },
      },
    ])
  )[0];
  user.profile = user.profile || {};
  user.profile.display = user.profile.display || "The_Mammon_Way";
  user.profile.characters = user.profile.characters || [];
  return user;
};

exports.getUserList = async function (sortField, sortOrder, limit, startIndex) {
  let query = Users.find({}, "info.name info.email info.supportStatus");

  let sortBy = sortField ? `info.${sortField}` : "_id";
  let sort = {};
  sort[sortBy] = sortOrder ?? 1;
  query.sort(sort);

  if (limit) {
    query.limit(limit);
  }

  query.skip(startIndex);

  return await query;
};

exports.getOwnedCardsPreview = async (username) =>
  await getCardCollectionPreview(username, "owned");

exports.getFaveCardsPreview = async (username) =>
  await getCardCollectionPreview(username, "faved");

getCardCollectionPreview = function (username, collectionType) {
  return Users.aggregate([
    { $match: { "info.name": username } },
    { $unwind: `$cards.${collectionType}` },
    {
      $lookup: {
        from: "cards",
        localField: `cards.${collectionType}`,
        foreignField: "uniqueName",
        as: "cardData",
      },
    },
    { $sort: { "cardData.number": -1 } },
    { $limit: 15 },
    {
      $project: {
        name: "$cardData.name",
        uniqueName: `$cards.${collectionType}`,
        _id: false,
      },
    },
    { $unwind: "$name" },
  ]);
};

exports.getOwnedUniqueNames = async function (username) {
  let uniqueNames = await Users.aggregate([
    { $match: { "info.name": username } },
    { $project: { ownedUniqueNames: "$cards.owned", _id: false } },
  ]);
  return uniqueNames[0]?.ownedUniqueNames ?? [];
};

exports.modifyCollection = function (username, collectionType, changedCards) {
  let addedCards = [];
  let removedCards = [];

  for (let key in changedCards) {
    if (changedCards[key]) {
      addedCards.push(key);
    } else {
      removedCards.push(key);
    }
  }

  let addPipeline = { $addToSet: {} };
  addPipeline.$addToSet[`cards.${collectionType}`] = { $each: addedCards };

  let removePipeline = { $pullAll: {} };
  removePipeline.$pullAll[`cards.${collectionType}`] = removedCards;

  let addPromise = Users.findOneAndUpdate(
    { "info.name": username },
    addPipeline
  );
  let removePromise = Users.findOneAndUpdate(
    { "info.name": username },
    removePipeline
  );

  return Promise.all([addPromise, removePromise])
    .then((value) => {
      return { err: false };
    })
    .catch((e) => {
      return { err: true, message: e.message };
    });
};

exports.updateUserData = async (username, data) =>
  await Users.updateOne({ "info.name": username }, { $set: data });

exports.getOwnedCardsStats = async function (username, cardType) {
  let collectionType = "owned";
  try {
    return (
      await Users.aggregate([
        { $match: { "info.name": username } },
        { $unwind: `$cards.${collectionType}` },
        {
          $lookup: {
            from: "cards",
            localField: `cards.${collectionType}`,
            foreignField: "uniqueName",
            as: "cardData",
          },
        },
        { $unwind: "$cardData" },
        { $replaceWith: "$cardData" },
        { $match: { type: cardType } },
        {
          $facet: {
            characters: [
              { $unwind: "$characters" },
              { $group: { _id: "$characters", count: { $sum: 1 } } },
              { $project: { k: "$_id", v: "$count", _id: false } },
            ],
            rarity: [
              { $group: { _id: "$rarity", count: { $sum: 1 } } },
              { $project: { k: "$_id", v: "$count", _id: false } },
            ],
            attribute: [
              { $group: { _id: "$attribute", count: { $sum: 1 } } },
              { $project: { k: "$_id", v: "$count", _id: false } },
            ],
            cards: [
              { $group: { _id: "$type", count: { $sum: 1 } } },
              { $project: { k: "$_id", v: "$count", _id: false } },
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

exports.getProfileInfo = async function (username, language) {
  try {
    var user = await exports.getUser(username);
    var info = { ...user.profile };

    if (language === "en") {
      info.joinKarasu = `${new Intl.DateTimeFormat("en", {
        month: "long",
      }).format(ObjectId(user._id).getTimestamp())} ${ObjectId(user._id)
        .getTimestamp()
        .getFullYear()}`;
    } else {
      info.joinKarasu = `${ObjectId(user._id).getTimestamp().getFullYear()}年${
        ObjectId(user._id).getTimestamp().getMonth() + 1
      }月`;
    }

    if (info.joined) {
      var date = info.joined.getUTCDate(),
        month = info.joined.getUTCMonth() + 1,
        year = info.joined.getUTCFullYear();
      if (language === "en") {
        info.joined = `${date} ${new Intl.DateTimeFormat("en", {
          month: "long",
        }).format(info.joined)} ${year}`;
      } else {
        info.joined = `${year}年${month}月${date}日`;
      }
    }

    info.badges = sortObjArrayByKey(user.info.supportStatus, "name");
    info.karasu_name = user.info.name;

    return info;
  } catch (e) {
    console.error(e);
    Sentry.captureException(e);
    return {};
  }
};

exports.getUserTreeStats = async function (username) {
  let user = await Users.findOne({ "info.name": username });
  if (!user.tree || user.tree.length === 0) {
    return [];
  }

  // TODO rework?
  return await Users.aggregate([
    { $match: { "info.name": username } },
    { $project: { tree: 1 } },
    {
      $unwind: {
        path: "$tree",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "cards",
        let: { tree_id: "$tree" },
        pipeline: [
          { $project: { dt: 1 } },
          {
            $unwind: {
              path: "$dt",
              preserveNullAndEmptyArrays: false,
            },
          },
          { $replaceRoot: { newRoot: { $mergeObjects: ["$dt"] } } },
          { $match: { $expr: { $eq: ["$_id", "$$tree_id"] } } },
        ],
        as: "item",
      },
    },
    {
      $unwind: {
        path: "$item",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $group: {
        _id: "$item.reward",
        count: { $count: {} },
      },
    },
  ]);
};

exports.getTreeTrackData = async function (data) {
  try {
    let pipeline = [
      {
        $facet: {
          totalCount: [
            {
              $match: {
                "info.name": data.username,
              },
            },
            {
              $unwind: {
                path: "$cards.owned",
              },
            },
            {
              $project: {
                card: "$cards.owned",
                tree: 1,
              },
            },
            {
              $lookup: {
                from: "cards",
                localField: "card",
                foreignField: "uniqueName",
                as: "result",
              },
            },
            {
              $unwind: {
                path: "$result",
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    {
                      tree: "$tree",
                      card: "$card",
                    },
                    "$result",
                  ],
                },
              },
            },
            {
              $match: data.match,
            },
            {
              $count: "value",
            },
          ],
          pipelineResults: [
            {
              $match: {
                "info.name": data.username,
              },
            },
            {
              $unwind: {
                path: "$cards.owned",
              },
            },
            {
              $project: {
                card: "$cards.owned",
                tree: 1,
              },
            },
            {
              $lookup: {
                from: "cards",
                localField: "card",
                foreignField: "uniqueName",
                as: "result",
              },
            },
            {
              $unwind: {
                path: "$result",
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    {
                      tree: "$tree",
                      card: "$card",
                    },
                    "$result",
                  ],
                },
              },
            },
            {
              $match: data.match,
            },
            {
              $sort: data.sort,
            },
            {
              $skip: data.pageNum * 25,
            },
            {
              $limit: 25,
            },
            {
              $unwind: {
                path: "$dt",
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $addFields: {
                "dt.unlocked": {
                  $in: ["$dt._id", "$tree"],
                },
              },
            },
            {
              $group: {
                _id: "$card",
                name: {
                  $first: "$name",
                },
                ja_name: {
                  $first: "$ja_name",
                },
                type: {
                  $first: "$type",
                },
                rarity: {
                  $first: "$rarity",
                },
                characters: {
                  $first: "$characters",
                },
                nodes: {
                  $push: "$dt",
                },
              },
            },
            {
              $sort: data.sort,
            },
          ],
        },
      },
      {
        $unwind: "$pipelineResults",
      },
      {
        $unwind: "$totalCount",
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$pipelineResults",
              {
                totalCount: "$totalCount.value",
              },
            ],
          },
        },
      },
    ];
    let nodes = await Users.aggregate(pipeline);
    return nodes;
  } catch (e) {
    console.error(e);
    return [];
  }
};

function sortObjArrayByKey(array, key) {
  return array.sort(function (a, b) {
    var x = a[key],
      y = b[key];
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

exports.ownsCard = function (user, card) {
  return Users.exists({ "info.name": user, "cards.owned": card });
};

exports.favesCard = function (username, card) {
  return Users.exists({ "info.name": username, "cards.faved": card });
};

exports.getNumberOfUsers = function () {
  return Users.estimatedDocumentCount();
};

exports.getNumberOfValidUsers = function () {
  return Users.countDocuments({
    $or: [
      { "info.email": { $exists: true, $ne: "" } },
      { "cards.owned": { $exists: true, $ne: [] } },
      { "cards.faved": { $exists: true, $ne: [] } },
    ],
  });
};

exports.getOwnedCardCount = (card) => getCardCountInCollections(card, "owned");

exports.getFavedCardCount = (card) => getCardCountInCollections(card, "faved");

getCardCountInCollections = function (card, collection) {
  let countCondition = {};
  countCondition[`cards.${collection}`] = card;
  return Users.countDocuments(countCondition);
};

exports.renameCardInCollections = function (oldName, newName) {
  if (oldName === newName) {
    return Promise.resolve(true);
  }

  const promiseFaved = Users.updateMany(
    { "cards.faved": oldName },
    {
      $push: { "cards.faved": newName },
    }
  );

  const promiseOwned = Users.updateMany(
    { "cards.owned": oldName },
    {
      $push: { "cards.owned": newName },
    }
  );

  const promisePull = Users.updateMany(
    {},
    { $pull: { "cards.owned": oldName, "cards.faved": oldName } }
  );

  return promiseFaved.then(() => promiseOwned).then(() => promisePull);
};

exports.deleteCardInCollections = function (cardName) {
  var promise = Users.updateMany(
    {},
    { $pull: { "cards.owned": cardName, "cards.faved": cardName } }
  );

  return promise;
};

exports.updateSupport = async function (user, status) {
  let result = await Users.updateOne(
    { "info.name": user },
    { $set: { "info.supportStatus": status } }
  );
  if (!result.ok) {
    return { err: true, message: "Something went wrong!" };
  }
  return { err: false, message: "Status updated!" };
};

// TODO combine with updateSupport
exports.banUser = async function (name) {
  let banResult = await Users.findOneAndUpdate(
    { "info.name": name },
    { $push: { "info.supportStatus": { name: "bannedFromMakingSuggestions" } } }
  );
  let deleteSuggestionResult = await suggestionService.refuseSuggestionsFrom(
    name
  );
  if (!banResult.ok || !deleteSuggestionResult.ok) {
    return { err: true, message: "Something went wrong!" };
  }
  return { err: false, message: "User banned" };
};

exports.updateUserTree = async function (username, node, isUnlocked) {
  if (isUnlocked && isUnlocked == "true") {
    await Users.findOneAndUpdate(
      { "info.name": username },
      { $addToSet: { tree: new ObjectId(node) } }
    );
  } else {
    await Users.findOneAndUpdate(
      { "info.name": username },
      { $pull: { tree: new ObjectId(node) } }
    );
  }
};

// TODO only retrieve name of the correct language
exports.getRankingData = async function () {
  return await Users.aggregate([
    { $unwind: "$cards.faved" },
    { $group: { _id: "$cards.faved", total: { $sum: 1 } } },
    { $sort: { total: -1, _id: 1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "cards",
        localField: "_id",
        foreignField: "uniqueName",
        as: "cardData",
      },
    },
    { $addFields: { name: { $arrayElemAt: ["$cardData", 0] } } },
    { $set: { name: "$name.name", ja_name: "$name.ja_name" } },
    { $unset: ["cardData"] },
  ]);
};
