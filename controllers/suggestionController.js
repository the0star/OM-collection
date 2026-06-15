/**
 * Thin HTTP handlers for the suggestion workflow.
 *
 * Pattern in this file:
 *   1. express-validator chain validates the body.
 *   2. Handler delegates to suggestionService.
 *   3. SuggestionError -> a specific HTTP status; everything else -> next(e).
 *
 * Business logic (path parsing, JSON parsing, resource dispatch, validator
 * dispatch, audit-trail writes) lives in suggestionService — not here.
 */

const { body, param, validationResult } = require("express-validator");
const Sentry = require("@sentry/node");

const miscController = require("./miscController");
const cardService = require("../services/cardService");
const eventService = require("../services/eventService");
const suggestionService = require("../services/suggestionService");
const { SuggestionError } = suggestionService;

// -- helpers -------------------------------------------------------------

/**
 * Convert a SuggestionError into a JSON response, falling back to next(e)
 * for unexpected errors so the central error handler can log them.
 */
function handleServiceError(e, _req, res, next) {
    if (e instanceof SuggestionError) {
        switch (e.code) {
            case SuggestionError.codes.NOT_FOUND:
                return res
                    .status(404)
                    .json({ ok: false, code: e.code, message: e.message });
            case SuggestionError.codes.DUPLICATE_PENDING:
                return res.status(409).json({
                    ok: false,
                    code: e.code,
                    message: e.message,
                    existing: e.existing,
                });
            case SuggestionError.codes.INVALID_PAYLOAD:
            case SuggestionError.codes.INVALID_RESOURCE:
                return res
                    .status(400)
                    .json({ ok: false, code: e.code, message: e.message });
            case SuggestionError.codes.UPDATE_FAILED:
                return res
                    .status(422)
                    .json({ ok: false, code: e.code, message: e.message });
        }
    }
    Sentry.captureException(e);
    return next(e);
}

/**
 * Escape backticks in interpolated user-controlled strings so that a
 * username or page containing a backtick can't break Discord markdown
 * formatting in the admin notification.
 */
function discordSafe(s) {
    return String(s).replace(/`/g, "ʼ");
}

/**
 * Look up the original card or event for the suggestion-detail page so
 * the diff viewer has a "before" file to render. Returns null on miss
 * (the view's existing template handles a null/undefined origin
 * gracefully because the diff is only rendered from the textarea values).
 */
async function loadOriginalResource(suggestion) {
    try {
        if (suggestion.resource === "card") {
            return await cardService.getCard({
                uniqueName: suggestion.identifier,
            });
        }
        if (suggestion.resource === "event") {
            // identifier is already the real name.en (parsePage converts
            // the URL's underscores to spaces for events).
            return await eventService.getEvent({
                "name.en": suggestion.identifier,
            });
        }
        return null;
    } catch (e) {
        Sentry.captureException(e);
        return null;
    }
}

// -- handlers ------------------------------------------------------------

exports.getSuggestionPage = [
    param("id").isMongoId().withMessage("Invalid suggestion id"),
    async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return next({ status: 404, message: "Suggestion not found" });
        }
        try {
            const suggestion = await suggestionService.getSuggestionById(
                req.params.id
            );
            const originalFile = await loadOriginalResource(suggestion);
            return res.render("suggestionDetail", {
                title: req.params.id,
                originalFile: originalFile,
                suggestion: suggestion,
                user: req.user,
            });
        } catch (e) {
            if (e instanceof SuggestionError && e.code === "NOT_FOUND") {
                return next({ status: 404, message: "Suggestion not found" });
            }
            return next(e);
        }
    },
];

exports.getSuggestionList = async function (req, res, next) {
    try {
        // Admins can opt into a "group by page" view with ?sort=page.
        // The previous ?q=s magic string is still accepted for backwards
        // compatibility with any old bookmarks.
        const wantsPageSort =
            req.user &&
            req.user.isAdmin &&
            (req.query.sort === "page" || req.query.q === "s");
        const sort = wantsPageSort ? { page: 1, _id: 1 } : {};

        const suggestions = await suggestionService.listPendingSuggestions({
            sort,
        });
        return res.render("suggestionList", {
            title: "Suggestions",
            suggestions: suggestions,
            user: req.user,
        });
    } catch (e) {
        return next(e);
    }
};

const submitValidators = [
    body("page")
        .isString()
        .matches(/^\/(card|event)\/.+/)
        .withMessage("Invalid suggestion page"),
    body("data").isString().notEmpty().withMessage("Missing edit data"),
];

exports.addSuggestion = [
    ...submitValidators,
    async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                ok: false,
                err: true, // legacy field — old client checks `result.err`
                code: "INVALID_PAYLOAD",
                message: errors.array()[0].msg,
            });
        }
        try {
            const created = await suggestionService.createSuggestion({
                user: req.user.name,
                page: req.body.page,
                data: req.body.data,
            });
            miscController.notifyAdmin(
                `New suggestion from \`\`${discordSafe(req.user.name)}\`\` on ` +
                    `\`\`${discordSafe(req.body.page)}\`\`.`
            );
            // Legacy success shape: clients check `!result.err`.
            return res.json({
                ok: true,
                err: null,
                message: "Suggestion submitted!",
                suggestion: created,
            });
        } catch (e) {
            return handleServiceError(e, req, res, next);
        }
    },
];

exports.replaceSuggestion = [
    ...submitValidators,
    async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                ok: false,
                err: true,
                code: "INVALID_PAYLOAD",
                message: errors.array()[0].msg,
            });
        }
        try {
            const saved = await suggestionService.replacePendingSuggestion({
                user: req.user.name,
                page: req.body.page,
                data: req.body.data,
            });
            return res.json({
                ok: true,
                err: null,
                message: "Existing suggestion replaced.",
                suggestion: saved,
            });
        } catch (e) {
            return handleServiceError(e, req, res, next);
        }
    },
];

exports.approveSuggestion = [
    body("_id").isMongoId().withMessage("Invalid suggestion id"),
    body("data").isString().notEmpty().withMessage("Missing edit data"),
    body("reason").optional({ checkFalsy: true }).isString(),
    async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                ok: false,
                err: true,
                code: "INVALID_PAYLOAD",
                message: errors.array()[0].msg,
            });
        }
        try {
            const result = await suggestionService.approveSuggestion({
                id: req.body._id,
                editedData: req.body.data,
                reason: req.body.reason,
                approver: req.user && req.user.name,
            });
            return res.json({
                ok: true,
                err: null,
                message: result.message,
            });
        } catch (e) {
            return handleServiceError(e, req, res, next);
        }
    },
];

exports.refuseSuggestion = [
    body("_id").isMongoId().withMessage("Invalid suggestion id"),
    body("reason").optional({ checkFalsy: true }).isString(),
    async function (req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                ok: false,
                err: true,
                code: "INVALID_PAYLOAD",
                message: errors.array()[0].msg,
            });
        }
        try {
            const result = await suggestionService.refuseSuggestion({
                id: req.body._id,
                reason: req.body.reason,
                refuser: req.user && req.user.name,
            });
            return res.json({
                ok: true,
                err: null,
                message: result.message,
            });
        } catch (e) {
            return handleServiceError(e, req, res, next);
        }
    },
];
