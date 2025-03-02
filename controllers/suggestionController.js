const miscController = require("../controllers/miscController");
const cardController = require("../controllers/cardsController");
const suggestionService = require("../services/suggestionService");
const cardService = require("../services/cardService");
const eventService = require("../services/eventService");
const Sentry = require("@sentry/node");

exports.getSuggestionPage = async function (req, res, next) {
    try {
        var suggestion = await suggestionService.getSuggestion({
            _id: req.params.id,
        });
        var originalFile = await getOriginalFile(suggestion.page.split("/"));
        return res.render("suggestionDetail", {
            title: req.params.id,
            originalFile: originalFile,
            suggestion: suggestion,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

async function getOriginalFile(path) {
    try {
        let db = path[path.length - 2],
            docName = decodeURIComponent(path[path.length - 1]);
        if (db === "card") {
            return await cardService.getCard({ uniqueName: docName });
        } else if (db === "event") {
            return await eventService.getEvent({
                "name.en": docName.replace(/_/g, " "),
            });
        } else {
            return { error: "Something went wrong." };
        }
    } catch (e) {
        return { error: e.message };
    }
}

exports.getSuggestionList = async function (req, res, next) {
    try {
        let sort = {};
        if (req.user && req.user.isAdmin && req.query.q === "s") {
            sort = { page: 1, _id: 1 };
        }
        let suggestions = await suggestionService.getSuggestionList(
            { status: "pending" },
            sort
        );
        return res.render("suggestionList", {
            title: "Suggestions",
            suggestions: suggestions,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

exports.addSuggestion = async function (req, res) {
    let result = await suggestionService.addSuggestion({
        user: req.user.name,
        page: req.body.page,
        stringifiedJSON: req.body.data,
    });

    if (!result.err) {
        miscController.notifyAdmin(
            `New suggestion from \`\`${req.user.name}\`\` on \`\`${req.body.page}\`\`.`
        );
    }

    return res.json(result);
};

// NOTE: card search use uniqueName, event search use name.en
exports.approveSuggestion = async (req, res) => {
    try {
        const suggestion = await suggestionService.getSuggestion({
            _id: req.body._id,
        });
        if (!suggestion) {
            return res.json({ err: true, message: "Suggestion not found" });
        }

        console.log(suggestion);

        const [, db, encodedDocName] = suggestion.page.split("/");
        const docName = decodeURIComponent(encodedDocName);
        const data = JSON.parse(req.body.data);

        let updateResult;
        switch (db) {
            case "card":
                const verifyTree = await cardController.isVerifiedTreeData(
                    docName,
                    data
                );
                if (verifyTree.err) {
                    return res.json({ err: true, message: verifyTree.message });
                }

                updateResult = await cardService.updateCard({
                    user: suggestion.user,
                    originalUniqueName: docName,
                    cardData: data,
                });
                break;

            case "event":
                updateResult = await eventService.updateEvent(
                    docName.replace(/_/g, " "),
                    data,
                    suggestion.user
                );
                break;

            default:
                return res.json({
                    err: true,
                    message: "Invalid suggestion path",
                });
        }

        if (updateResult?.err) {
            throw new Error(updateResult.message);
        }

        const statusResult = await suggestionService.updateSuggestionStatus(
            req.body._id,
            "approved",
            req.body.reason
        );

        return res.json(statusResult);
    } catch (error) {
        return res.json({
            err: true,
            message: error.message,
        });
    }
};

exports.refuseSuggestion = async function (req, res) {
    return res.json(
        await suggestionService.updateSuggestionStatus(
            req.body._id,
            "refused",
            req.body.reason
        )
    );
};
