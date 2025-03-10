const Sentry = require("@sentry/node");
const dayjs = require("dayjs");
const createError = require("http-errors");

const customParseFormat = require("dayjs/plugin/customParseFormat");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Events = require("../models/events");
const Revisions = require("../models/revisions");

exports.getEvents = async function (condition = {}, sort = { start: -1 }) {
    try {
        return await Events.find(condition).sort(sort);
    } catch (e) {
        Sentry.captureException(e);
        return [];
    }
};

exports.getEvent = async function (query = {}) {
    return await Events.findOne(query).lean();
};

exports.getLatestEvent = async function (t) {
    return (await Events.find({ type: t }).sort({ start: -1 }).limit(1))[0];
};

exports.addEvent = async function (data, user) {
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

        return { err: null, message: "Event created!" };
    } catch (e) {
        Sentry.captureException(e);
        return { err: true, message: e.message };
    }
};

exports.updateEvent = async function (originalName, data, user) {
    try {
        const updatedData = {
            ...data,
            start: stringToDateTime(data.start),
            end: stringToDateTime(data.end),
        };

        if (updatedData.boostingMultiplier > 1) {
            updatedData.boostingStart = stringToDateTime(data.boostingStart);
            updatedData.boostingEnd = stringToDateTime(data.boostingEnd);
        }

        const event = await Events.findOne({ "name.en": originalName });
        if (!event) {
            throw createError(404, {
                errorMessage: `Event with name ${originalName} doesn't exist`,
            });
        }

        await Promise.all([
            Events.findOneAndUpdate(
                { "name.en": originalName },
                { $set: updatedData }
            ),
            Revisions.create({
                title: updatedData.name.en,
                type: "event",
                user,
                timestamp: new Date(),
                data: updatedData,
            }),
        ]);

        return {
            success: true,
            message: "Event updated!",
        };
    } catch (error) {
        Sentry.captureException(error);
        return {
            success: false,
            message: error.message,
        };
    }
};

exports.deleteEvent = async function (eventName) {
    try {
        await Events.findOneAndRemove({ "name.en": eventName });
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
