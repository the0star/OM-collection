const createError = require("http-errors");
const async = require("async");
const fs = require("fs");
const i18next = require("i18next");
const Sentry = require("@sentry/node");

const cardService = require("../services/cardService");
const eventService = require("../services/eventService");
const userService = require("../services/userService");
const fileService = require("../services/fileService");

exports.index = function (req, res, next) {
	return res.render("index", {
		title: "Karasu OS",
		description: i18next.t("description.cards"),
		user: req.user
	});
};

exports.getCardsListPage = async function(req, res, next) {
	try {
		let pipeline = formatAggPipeline(req.query);
		let cards = await cardService.aggregateCards(pipeline);

		if (req.user && req.query.cards) {
			let user = await userService.getUser(req.user.name);
			if (req.query.cards === 'owned') {
				cards = cards.filter(card => user.cards.owned.includes(card.uniqueName));
			} else if (req.query.cards === 'notowned') {
				cards = cards.filter(card => !user.cards.owned.includes(card.uniqueName));
			}
		}

		return res.render("cardsList", {
			title: i18next.t("title.cards"),
			description: "The place to view all of Obey Me!'s cards. The largest and most complete card databse with all sorts of filters for you to find the card you want! This is also the place to manage your card collection. Create an account to access more features! ... Pride, Greed, Envy, Wrath, Lust, Gluttony, Sloth, UR+, UR, SSR, SR, N, Lucifer, Mammon, Leviathan, Satan, Asmodeus, Beelzebub, Belphegor, Luke, Simeon, Barbatos, Diavolo, Solomon, Little D., Owned, Not owned.",
			cardsList: cards,
			path: "list",
			query: req.query,
			user: req.user
		});
	} catch(e) {
		return next(e);
	}
};

exports.getOwnedCardsPage = async function(req, res, next) {
	try {
		var user = await userService.getUser(req.params.username);
		if (!user) {
			throw createError(404, "User not found");
		}

		let query = formatAggPipeline(req.query);
		var pageParams = {
			description: `${req.params.username}'s Collection on Karasu-OS.com`,
			path: "collection",
			query: req.query,
			user: req.user
		};

		var isCollectionOwner = req.user && req.user.name === user.info.name;
		pageParams.title = isCollectionOwner ? i18next.t("title.my_collection") : i18next.t("title.user_collection", { username: user.info.name });

		var isPrivate = user.profile.isPrivate && !isCollectionOwner;
		if (isPrivate) {
			pageParams.isPrivate = true;
		} else {
			// get collection stats
			var allCards = await cardService.getCards();
			var ownedCards = await userService.getOwnedCards(user.info.name);

			pageParams.ownedStats = cardService.getCollectionStats(ownedCards);
			pageParams.totalStats = cardService.getCollectionStats(allCards);

			for ([category, entries] of Object.entries(pageParams.totalStats)) {
				for (entry in entries) {
					pageParams.ownedStats[category][entry] = pageParams.ownedStats[category][entry] || 0;
				}
			}

			// get cards
			let cardList = await cardService.aggregateCards(query);
			pageParams.cardsList = cardList.filter(card => user.cards.owned.includes(card.uniqueName));
		}

		return res.render("cardsList", pageParams);
	} catch (e) {
		return next(e);
	}
};

exports.getFavouriteCardsPage = async function(req, res, next) {
	try {
		var user = await userService.getUser(req.params.username);
		if (!user) {
			throw createError(404, "User not found");
		}

		let query = formatAggPipeline(req.query);
		var pageParams = {
			description: `${req.params.username}'s favourite Obey Me cards on Karasu-OS.com`,
			path: "fav",
			query: req.query,
			user: req.user
		};

		var isCollectionOwner = req.user && req.user.name === user.info.name;
		pageParams.title = isCollectionOwner ? i18next.t("title.my_favourites") : i18next.t("title.user_favourites", { username: user.info.name });

		var isPrivate = user.profile.isPrivate && !isCollectionOwner;
		if (isPrivate) {
			pageParams.isPrivate = true;
		} else {
			let favedCards = await cardService.aggregateCards(query);
			pageParams.cardsList = favedCards.filter(card => user.cards.faved.includes(card.uniqueName));
		}

		return res.render("cardsList", pageParams);
	} catch (e) {
		return next(e);
	}
};

exports.getCardDetailPage = async function(req, res, next) {
	try {
		var cardData = await cardService.getCard({ "name": req.params.card.replace(/_/g, " ") });
		if (!cardData) {
			return await getHiddenCardDetailPage(req, res, next);
		}

		var stats = await cardService.getCardStats(req.user, cardData.uniqueName);

		cardData.source_link = cardData.source.map(x => encodeURIComponent(x.replace(/ /g, "_")));

		var title = cardData.name;
		var lang = i18next.t("lang");

		if (lang === "ja") {
			if (cardData.ja_name !== "???") {
				title = cardData.ja_name;
			}

			cardData.source = await getSourceInLanguage(cardData.source, "ja");
		}

		return res.render("cardDetail", {
			title: title,
			description: `View "${cardData.name}" and other Obey Me cards on Karasu-OS.com`,
			card: cardData,
			isHidden: false,
			user: req.user,
			stats: stats
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
				let relatedEvent = await eventService.getEvent({ "name.en": source });
				if (!relatedEvent) {
					arr.push(source);
				} else if (relatedEvent.name[lng] !== "???" && relatedEvent.name[lng] !== "") {
					arr.push(relatedEvent.name.ja);
				}
			}
		}
	}
	return arr;
}

async function getHiddenCardDetailPage(req, res, next) {
	var cardName = req.params.card.replace(/_/g, " ");
	var cardData = await cardService.getHiddenCard(cardName, req.user);
	if (!cardData) {
		throw createError(404, "Card not found");
	}
	cardData.source_link = cardData.source.map(x => encodeURIComponent(x.replace(/ /g, "_")));
	return res.render("cardDetail", {
		title: cardData.name,
		description: `View "${cardData.name}" and other Obey Me cards on Karasu-OS.com`,
		card: cardData,
		isHidden: true,
		user: req.user
	});
}

exports.getHiddenCardsListPage = async function(req, res, next) {
	try {
		var cards = await cardService.getHiddenCards();
		return res.render("cardsList", { title: "Hidden Cards", cardsList: cards, user: req.user, path: "hidden" });
	} catch(e) {
		return next(e);
	}
};

exports.getProfilePage = async function(req, res, next) {
	try {
		var user = await userService.getUser(decodeURIComponent(req.params.username));
		if (!user) {
			throw createError(404, "User not found");
		}

		var title;
		if (req.user && req.user.name === user.info.name) {
			title = i18next.t("title.my_profile");
		} else {
			title = i18next.t("title.user_profile", { username: user.info.name });
		}

		var cards = {
			owned: (await userService.getOwnedCards(user.info.name)).slice(0, 15),
			faved: (await userService.getFaveCards(user.info.name)).slice(0, 15)
		};

		var profileInfo = await userService.getProfileInfo(user.info.name);

		res.render("profile", {
			title: title,
			description: `See ${user.info.name}'s profile on Karasu-OS.com`,
			user: req.user,
			profileInfo: profileInfo,
			cards: cards
		});
	} catch (e) {
		return next(e);
	}
};

exports.directImage = async function (req, res, next) {
	var cardName = req.url.substring(1).replace("_b.jpg", "").replace(".jpg", "");
	cardName = cardService.decodeCardName(cardName);
	var isHidden = await cardService.isHidden(cardName);
	if (isHidden && (!req.user || !req.user.isAdmin)) {
		return next(createError(404));
	}
	next();
};


// Collection functions
// TODO: merge with getCardsListPage
exports.getCards = async function (req, res) {
	try {
		let query = formatAggPipeline(req.query);
		let cards = await cardService.aggregateCards(query);

		let user;
		switch (req.query.path) {
			case "collection":
				user = await userService.getUser(req.query.user);
				cards = cards.filter(card => user.cards.owned.includes(card.uniqueName));
				break;
			case "favourites":
				user = await userService.getUser(req.query.user);
				cards = cards.filter(card => user.cards.faved.includes(card.uniqueName));
				break;
			default:
				let type = req.query.cards;
				if (type && req.user) {
					user = await userService.getUser(req.user.name);
					if (type === "owned") {
						cards = cards.filter(card => user.cards.owned.includes(card.uniqueName));
					} else if (type === "not_owned") {
						cards = cards.filter(card => !user.cards.owned.includes(card.uniqueName));
					}
				}
		}

		return res.json({ err: null, cards: cards });
	} catch(e) {
		return res.json({ err: true, message: e.message });
	}
}

// Admin card management
exports.getEditCardPage = async function(req, res, next) {
	if (!req.params.card) {
		return res.render("cardEdit", { title: "Add Card", user: req.user });
	}

	try {
		var cardData = await cardService.getCard({ uniqueName: req.params.card });

		if (!cardData) {
			throw createError(404, "Card not found");
		}

		return res.render("cardEdit", { title: "Edit Card", card: cardData, user: req.user });
	} catch (e) {
		console.error(e.message);
		Sentry.captureException(e);
		next(e);
	}
};

exports.addNewCard = async function(req, res) {
	var result = await cardService.addNewCard(req.body.cardData, req.body.images);
	return res.json(result);
};

exports.updateCard = async function(req, res) {
	try {
		let result = await cardService.updateCard({
			originalUniqueName: req.params.card,
			cardData: req.body.cardData,
			images: req.body.images
		});

		if (result.err) {
			throw new Error(result.message);
		}

		return res.json({ err: null, message: "Card updated!" });
	} catch(e) {
		console.log(e);
		return res.json({ err: true, message: e.message });
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

exports.makeCardPublic = async function (req, res, next) {
	try {
		var newCard = await cardService.makeCardPublic(req.params.card);
		res.redirect("/card/"+ cardService.encodeCardName(newCard.name));
	} catch (e) {
		console.error(e.message);
		Sentry.captureException(e);
		next(e);
	}
};


/* helper */
function formatAggPipeline(obj) {
	let query = {};
	let sum = [];
	let sortby = "number";
	let order = -1;
	let sortbyVal;
	let match, addFields, sort, project, pipeline;

	for (let [key, value] of Object.entries(obj)) {
		if (value === "") continue;
		if (["characters", "attribute", "rarity"].includes(key)) {
			query[key] = { $in: [].concat(value) };
		} else if (key === "search") {
			// var lang = i18next.t("lang") === "zh" ? "en" : i18next.t("lang");
			// query["name."+lang] = new RegExp(value, 'i');

			if (i18next.t("lang") === "ja") {
				query["ja_name"] = new RegExp(value, 'i');
			} else {
				query["name"] = new RegExp(value, 'i');
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

	["pride", "greed", "envy", "wrath", "lust", "gluttony", "sloth"].forEach((attr) => {
		sum.push(`$strength.${attr}.${sortbyVal}`);
	});


	match = { '$match': query };

	addFields = {
		'$addFields': {
			'total': { '$sum': sum }
		}
	};

	sort = { '$sort': {} };
	sort['$sort'][sortby] = order;

	project = {
		'$project': {
			'name': 1,
			'ja_name': 1,
			'uniqueName': 1,
			'type': 1,
			'total': 1
		}
	};

	pipeline = [match];
	if (sortby === "total") {
		pipeline.push(addFields);
	}
	pipeline.push(sort, project);

	return pipeline;
}
