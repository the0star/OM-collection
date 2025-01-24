const createError = require("http-errors");
const async = require("async");
const dayjs = require("dayjs");
const Sentry = require("@sentry/node");

const customParseFormat = require("dayjs/plugin/customParseFormat");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const eventService = require("../services/eventService");
const eventCalculatorService = require("../services/eventCalculatorService");
const cardService = require("../services/cardService");
const miscController = require("../controllers/miscController");

exports.getEventsPage = async function (req, res, next) {
    let events = await eventService.getEvents();
    events = Array.prototype.flatMap.call(events, (item) => ({
        name: item.name,
        type: item.type,
        isLonelyDevil: item.isLonelyDevil,
        start: getFormatedDate(item.start, req.i18n.t("lang")),
        end: getFormatedDate(item.end, req.i18n.t("lang")),
    }));
    return res.render("eventList", {
        title: "Events",
        description:
            "A list of Obey Me events, including Nightmare and Pop Quizzes.",
        user: req.user,
        events: events,
    });
};

function getFormatedDate(d, lang) {
    if (!d) return "???";

    var day = d.getDate(),
        year = d.getFullYear();
    if (lang === "en") {
        let month = d.toLocaleString("en", { month: "long" });
        return `${day} ${month} ${year}`;
    } else {
        let month = d.getMonth() + 1;
        return `${year}年${month}月${day}日`;
    }
}

exports.getEventDetail = async function (req, res, next) {
    try {
        let eventName = decodeURIComponent(req.params.event.replace(/_/g, " "));
        let event = await eventService.getEvent({ "name.en": eventName });

        if (!event)
            throw createError(
                404,
                (properties = {
                    title: "Event not found",
                    errorMessage:
                        "Work in progress. Trying to figure out how to save this kind of events.",
                })
            );

        let locals = {
            title: event.name.en,
            description: `View "${event.name.en}" and other Obey Me events on Karasu-OS.com`,
            event: event,
            user: req.user,
        };

        if (req.i18n.t("lang") === "ja" && event.name.ja !== "") {
            locals.title = event.name.ja;
        }

        if (event.type === "PopQuiz" || event.type === "Nightmare") {
            locals.cards = await cardService.getCards(
                { source: { $in: [eventName] } },
                { name: 1, ja_name: 1, uniqueName: 1, type: 1, dt: 1 }
            );
        }

        return res.render("eventDetail", locals);
    } catch (e) {
        return next(e);
    }
};

exports.getCalculatorPage = function (req, res, next) {
    switch (req.params.type.toLowerCase()) {
        case "points":
            return exports.getPointsCalculator(req, res, next);
            break;
        case "lonely-devil":
            return exports.getCustomCalculator(req, res, next);
            break;
        case "bonus":
            return exports.getCheatCardBonusCalculator(req, res, next);
            break;
        case "bonus-(general)":
            return exports.getGeneralBonusCalculator(req, res, next);
            break;
        case "ap-recovery":
            return exports.getAPCalculator(req, res, next);
            break;
        case "bonus_(general)":
            return res.redirect(301, "/calculator/general-bonus");
            break;
        case "ap_recovery":
            return res.redirect(301, "/calculator/ap-recovery");
            break;
        default:
            return next(createError(404));
    }
};

exports.getPointsCalculator = async function (req, res, next) {
    try {
        return res.render("calculators/points", {
            title: "Pop Quiz Calculator",
            description:
                "Pop quiz calculator for obey me. Help you calculate the amount of stages/ap/d-energy/dp you need to spend to reach a certain point.",
            data: await eventService.getLatestEvent("PopQuiz"),
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

exports.getCustomCalculator = async function (req, res, next) {
    return res.render("calculators/customPoints", {
        title: "Lonely Devil Calculator",
        description: "",
        user: req.user,
    });
};

exports.getCheatCardBonusCalculator = async function (req, res, next) {
    try {
        let cards = [];
        let latestPopQuiz = await eventService.getLatestEvent("PopQuiz");
        if (!latestPopQuiz.isBirthday) {
            let latestEvent = await eventService.getLatestEvent("Nightmare");
            cards = await cardService.getCards({
                source: { $in: [latestEvent.name.en] },
            });
        }
        return res.render("calculators/bonus", {
            title: "Cheat Card Bonus",
            description:
                "Cheat card bonus calculator for NTT Solmare's otome game: Obey Me.",
            cards: cards,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

exports.getGeneralBonusCalculator = function (req, res, next) {
    return res.render("calculators/generalBonus", {
        title: "Cheat Card Bonus (General)",
        description:
            "A general cheat card bonus calculator for NTT Solmare's otome game: Obey Me.",
        user: req.user,
    });
};

exports.getAPCalculator = function (req, res, next) {
    return res.render("calculators/ap", {
        title: "AP Recovery",
        description:
            "Karasu calculator that calculates when your AP will fill in Obey Me.",
        user: req.user,
    });
};

/*
exports.getCalculatorPage = async function (req, res, next) {
	try {
		var event = await eventService.getLatestEvent();
	} catch (e) {
		return next(e);
	}

	var cookieData = req.cookies.calculator ? JSON.parse(req.cookies.calculator) : {};
	var reqData = req.query;
	reqData.advanced = cookieData;
	var locals = { title: req.i18n.t("title.calculator"), description: req.i18n.t("description.calculator"), event: event, query: req.query, user: req.user };
	[locals.calculationError, locals.result] = eventCalculatorService.calculate(event, reqData);
	return res.render("calculator", locals);
};

exports.calculate = async function(req, res) {
	var eventName = req.params.event.replace(/_/g, ' ');
	var event = await eventService.getCalculatorEvent(eventName);

	if (!event) return res.json({ err: true });

	var result = eventCalculatorService.calculate(event, req.body.currentPoints, req.body.pointsPerBattle, req.body.isVip);
	return res.json({ err: false, result: result });
}
*/

exports.getAddEventPage = async function (req, res, next) {
    try {
        const data = eventService.getDefaultEventData();
        return res.render("eventEdit", {
            title: "Add Event",
            description: ":)",
            data: data,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

exports.addEvent = async function (req, res) {
    try {
        const result = await eventService.addEvent(
            req.body.data,
            req.user.name
        );
        return res.json(result);
    } catch (e) {
        return res.json({ err: true, message: e.message });
    }
};

exports.deleteEvent = async function (req, res, next) {
    try {
        var eventName = decodeURIComponent(req.params.event.replace(/_/g, " "));
        return res.json(await eventService.deleteEvent(eventName));
    } catch (err) {
        Sentry.captureException(err);
        return res.json({ err: true, message: err.message });
    }
};

exports.updateEvent = async function (req, res) {
    try {
        let eventName = decodeURIComponent(req.params.event.replace(/_/g, " "));
        let result = await eventService.updateEvent(
            eventName,
            req.body.data,
            req.user.name
        );
        if (result.err) throw new Error(result.message);
        miscController.notifyAdmin(
            `Event updated. \`\`${req.user.name}\`\` just updated: \`\`${eventName}\`\`.`
        );
        return res.json(result);
    } catch (e) {
        Sentry.captureException(e);
        return res.json({ err: true, message: e.message });
    }
};

exports.getEditEventPage = async function (req, res, next) {
    try {
        let eventName = decodeURIComponent(req.params.event.replace(/_/g, " "));
        let data = await eventService.getEvent({ "name.en": eventName });
        if (!data)
            throw createError(404, (properties = { title: "Event not found" }));
        return res.render("eventEdit", {
            title: "Edit Event",
            description: ":)",
            data: data,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};
