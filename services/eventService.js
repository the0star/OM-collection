const Sentry = require("@sentry/node");
const async = require("async");
const dayjs = require("dayjs");
const createError = require("http-errors");

const customParseFormat = require("dayjs/plugin/customParseFormat");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Events = require("../models/events");
const APPresets = require("../models/apPresets");
const Revisions = require("../models/revisions");

const cacheService = require("../services/cacheService");
const fileService = require("../services/fileService");

exports.getEvents = async function (condition = {}, sort = { start: -1 }) {
  try {
    return await Events.find(condition).sort(sort);
  } catch (e) {
    Sentry.captureException(e);
    return [];
  }
};

exports.getEvent = async function (query = {}) {
  return await Events.findOne(query);
};

exports.getLatestEvent = async function (t) {
  return (await Events.find({ type: t }).sort({ start: -1 }).limit(1))[0];
};

/*
exports.getCalculatorEvent = async function(eventName) {
var event = cacheService.getCachedEvent();
if (!event || eventName != event.name) {
event = await getFullEventData(eventName);
}

return event;
}

exports.getLatestEvent = async function () {
var latestEventName = await getLatestEventName();

var cachedEvent = cacheService.getCachedEvent();
if (cachedEvent && cachedEvent.name === latestEventName) {
return cachedEvent;
}

try {
var latestEventData = await getFullEventData(latestEventName);
cacheService.setCachedEvent(latestEventData);
return latestEventData;
} catch (e) {
// console.error(e);
Sentry.captureException(e);
return {};
}
}

async function getLatestEventName() {
var currentTime = new Date();
try {
var latestEvent = await Events.find({
start: { "$lte": currentTime },
type: { "$ne": "Nightmare" }
}).sort({ end: -1 }).limit(1);
if (!latestEvent[0] || !latestEvent[0].name) return;

return latestEvent[0].name.en;
} catch (e) {
console.error(e);
Sentry.captureException(e);
}
}

exports.getLatestEventData = async function () {
var latestEventName = await getLatestEventName();
if (!latestEventName) return;

var latestEventData = await getFullEventData(latestEventName);
return latestEventData;
}

async function getFullEventData(eventName) {
try {
var event = await Events.aggregate([
{ $match: { "name.en": eventName }},
{
$unwind: {
"path": "$rewards",
"preserveNullAndEmptyArrays": true
}},
{ $lookup: {
from: "cards",
localField: "rewards.card",
foreignField: "name",
as: "rewards.card"
}},
{ $unwind: { path: "$rewards.card", preserveNullAndEmptyArrays: true }},
{ $project: {
"rewards.card.attribute": 0,
"rewards.card.type": 0,
"rewards.card.rarity": 0,
"rewards.card.characters": 0
}},
{
$sort: {
"rewards.points": -1,
"rewards.card.number": -1
}},
{ $group: {
_id: "$_id",
temp: { "$first": "$$ROOT" },
rewards: { "$push": "$rewards" }
}},
{ $replaceRoot: { "newRoot": { "$mergeObjects": ["$temp", { rewards: "$rewards" }]}}}
]);

return event?.length ? event[0] : null;
} catch (e) {
console.error(e);
Sentry.captureException(e);
}
}
*/

exports.addEvent = async function (data, img, user) {
  try {
    let event = await Events.findOne({ "name.en": data.name.en });
    if (event) {
      throw createError(500, "Event already exists.");
    }

    await Events.create(data);
    await Revisions.create({
      title: data.name.en,
      type: "event",
      user: user,
      timestamp: new Date(),
      data: data,
    });
    await fileService.saveImage(img, null, data.name.en, "events");

    return { err: null, message: "Event created!" };
  } catch (e) {
    Sentry.captureException(e);
    return { err: true, message: e.message };
  }
};

exports.updateEvent = async function (originalName, data, img = null, user) {
  try {
    data.start = stringToDateTime(data.start);
    data.end = stringToDateTime(data.end);

    if (data.boostingMultiplier > 1) {
      data.boostingStart = stringToDateTime(data.boostingStart);
      data.boostingEnd = stringToDateTime(data.boostingEnd);
    }

    let event = await Events.findOne({ "name.en": originalName });

    if (!event) {
      throw createError(
        404,
        (properties = {
          errorMessage: `Event with name ${originalName} doesn't exist`,
        })
      );
    }

    await Events.replaceOne({ "name.en": originalName }, data);

    // TODO: make function to create revision; refactor?
    await Revisions.create({
      title: data.name.en,
      type: "event",
      user: user,
      timestamp: new Date(),
      data: data,
    });

    if (img) {
      await fileService.saveImage(img, originalName, data.name.en, "events");
    }

    return { err: null, message: "Event updated!" };
  } catch (e) {
    Sentry.captureException(e);
    return { err: true, message: e.message };
  }
};

exports.deleteEvent = async function (eventName) {
  try {
    var event = await Events.findOneAndRemove({ "name.en": eventName });
    if (event) {
      await fileService.deleteImage("events", event.name.en);
    }
    return { err: null, message: "Event deleted!" };
  } catch (err) {
    Sentry.captureException(err);
    return { err: true, message: err.message };
  }
};

exports.getChangeStream = function () {
  return Events.watch();
};

exports.getDefaultEventData = function () {
  var start = dayjs.utc().startOf("day").hour(1);
  var end = dayjs.utc().startOf("day").hour(6);
  var data = {
    name: {
      ja: "???",
      zh: "???",
    },
    start: start,
    end: end,
    boostingStart: dayjs.utc().startOf("day").hour(15),
    boostingEnd: dayjs.utc().startOf("day").hour(15),
    stages: 26,
    type: "PopQuiz",
  };
  return data;
};

function stringToDateTime(dateString) {
  return dayjs(dateString).format("YYYY-MM-DDTHH:mm:ss.000+00:00");
}

exports.getAPPresets = async function () {
  var apPresets = await APPresets.find({});
  var apPresetsMap = {};
  apPresets.forEach((x) => (apPresetsMap[x.name] = x.rewards));
  return apPresetsMap;
};
