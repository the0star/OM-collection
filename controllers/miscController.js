const https = require("https");
const createError = require("http-errors");
const Sentry = require("@sentry/node");
const sharp = require("sharp");

const cacheService = require("../services/cacheService");
const cardService = require("../services/cardService");
const userService = require("../services/userService");

exports.privacyPolicy = function (req, res, next) {
  return res.render("policies", { title: "Privacy Policy", user: req.user });
};

exports.closingNotice = function (req, res, next) {
  return res.render("closingNotice", {
    title: "Closing Notice",
    user: req.user,
  });
};

exports.surpriseGuest = async function (req, res, next) {
  try {
    let c = [
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
    ];
    let character = req.params.character;
    if (character && !c.includes(character))
      return next(createError(404, "Character not found."));

    character = character ? req.i18n.t(character) + req.i18n.t("de") : "";

    return res.render("surpriseGuest", {
      title: character + req.i18n.t("common.spg"),
      description:
        "An all-in-one guide for Obey Me! surprise guest interactions. Karasu's interactive guide features all characters including the demon brothers and side characters. ... Lucifer, Mammon, Leviathan, Satan, Asmodeus, Beelzebub, Belphegor, Luke, Simeon, Barbatos, Diavolo, Solomon.",
      user: req.user,
      interactions: await cacheService.getCachedSurpriseGuest(),
    });
  } catch (e) {
    return next(e);
  }
};

exports.notifyAdmin = function (message) {
  const data = JSON.stringify({ content: message });
  const options = {
    hostname: "discord.com",
    port: 443,
    path: process.env.WEBHOOK,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const r = https.request(options);

  r.on("error", (error) => {
    Sentry.captureException(error);
  });

  r.write(data);
  r.end();
};

exports.getTreeTracker = async function (req, res, next) {
  try {
    let title = "Devil's Tree Tracker";
    if (req.path === "/tree-tracker/rank-up") title += ": Rank Ups";
    return res.render("treeTracker", {
      title: title,
      description:
        "Obey Me Devil's Tree Tracking page that lists all devil's tree rewards, including devil points, demon vouchers, chat, icons, rank ups, and everything that you can get from the devil's tree.",
      path: req.path,
      user: req.user,
    });
  } catch (e) {
    return next(e);
  }
};

exports.getTeamBuilder = function (req, res, next) {
  return res.render("teamBuilder", {
    title: "Team Builder",
    description: "Help you build the best teams to pass Obey Me! battles.",
    user: req.user,
  });
};

// TODO: rewrite
exports.getTeam = async function (req, res) {
  try {
    const a1 = req.query.a1.toLowerCase();
    const a2 = req.query.a2.toLowerCase();
    const type = req.query.type;

    let match = {
      attribute: a1.charAt(0).toUpperCase() + a1.slice(1),
      rarity: {
        $in: ["SSR", "UR", "UR+"],
      },
    };

    if (req.query.owned == "true") {
      let user = await userService.getUser(req.query.user);
      match["uniqueName"] = {
        $in: user.cards.owned,
      };
    }

    let boostA1 = {};
    boostA1[`strength.${a1}.${type}`] = {
      $multiply: [`$strength.${a1}.${type}`, 2.6],
    };

    let boostA2 = {};
    boostA2[`strength.${a2}.${type}`] = {
      $cond: {
        if: {
          $gte: [
            `$strength.${a2}.${type}`,
            {
              $multiply: [`$strength.${a1}.${type}`, 0.7],
            },
          ],
        },
        then: {
          $multiply: [`$strength.${a2}.${type}`, 1.3],
        },
        else: `$strength.${a2}.${type}`,
      },
    };

    const demon = await cardService.aggregateCards([
      {
        $match: {
          type: "Demon",
        },
      },
      {
        $match: match,
      },
      {
        $project: {
          name: 1,
          uniqueName: 1,
          characters: 1,
          strength: 1,
        },
      },
      {
        $set: boostA2,
      },
      {
        $set: boostA1,
      },
      {
        $project: {
          name: 1,
          uniqueName: 1,
          characters: 1,
          total: {
            $add: [
              `$strength.pride.${type}`,
              `$strength.greed.${type}`,
              `$strength.envy.${type}`,
              `$strength.wrath.${type}`,
              `$strength.lust.${type}`,
              `$strength.gluttony.${type}`,
              `$strength.sloth.${type}`,
            ],
          },
        },
      },
      {
        $unwind: {
          path: "$characters",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
      {
        $group: {
          _id: "$characters",
          card: {
            $first: "$$ROOT",
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: "$card",
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
      {
        $limit: 3,
      },
    ]);

    const memory = await cardService.aggregateCards([
      {
        $match: {
          type: "Memory",
        },
      },
      {
        $match: match,
      },
      {
        $project: {
          name: 1,
          uniqueName: 1,
          strength: 1,
        },
      },
      {
        $set: boostA2,
      },
      {
        $set: boostA1,
      },
      {
        $project: {
          name: 1,
          uniqueName: 1,
          total: {
            $add: [
              `$strength.pride.${type}`,
              `$strength.greed.${type}`,
              `$strength.envy.${type}`,
              `$strength.wrath.${type}`,
              `$strength.lust.${type}`,
              `$strength.gluttony.${type}`,
              `$strength.sloth.${type}`,
            ],
          },
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
      {
        $limit: 3,
      },
    ]);

    return res.json({ demon: demon, memory: memory });
  } catch (e) {
    Sentry.captureException(e);
    return res.json({ err: true, message: e.message });
  }
};

exports.getCardImage = async function (req, res, next) {
  try {
    const img = await sharp("./public/images/cards/L/" + req.params.name)
      .resize(820, 1106)
      .composite([{ input: "./public/images/watermark.png" }])
      .toBuffer();
    res.send(img);
  } catch (e) {
    next(createError(404));
  }
};
