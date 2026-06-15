/**
 * Suggestion service.
 *
 * This module owns all business logic for the user-submitted edit workflow:
 *   submit  -> createSuggestion / replacePendingSuggestion
 *   moderate-> approveSuggestion / refuseSuggestion
 *   query   -> getSuggestionById / getPendingSuggestion / listPendingSuggestions
 *   bulk    -> refuseAllPendingFrom (used when a user is banned)
 *
 * Error contract: on the unhappy path these functions THROW a
 * `SuggestionError` whose `.code` is a member of `SuggestionError.codes`.
 * Controllers map codes to HTTP responses. This replaces the previous
 * mixed-shape returns (`{err: true, message}` / `[]` / raw mongoose
 * results / undefined) which made callers impossible to reason about.
 */

const Sentry = require("@sentry/node");

const Suggestions = require("../models/suggestions.js");
const cardService = require("./cardService");
const eventService = require("./eventService");

// -- Errors --------------------------------------------------------------

class SuggestionError extends Error {
    constructor(code, message, extra = {}) {
        super(message);
        this.name = "SuggestionError";
        this.code = code;
        Object.assign(this, extra);
    }
}
SuggestionError.codes = Object.freeze({
    NOT_FOUND: "NOT_FOUND",
    DUPLICATE_PENDING: "DUPLICATE_PENDING",
    INVALID_PAYLOAD: "INVALID_PAYLOAD",
    INVALID_RESOURCE: "INVALID_RESOURCE",
    UPDATE_FAILED: "UPDATE_FAILED",
});
exports.SuggestionError = SuggestionError;

// -- Helpers -------------------------------------------------------------

/**
 * Parse a `/card/<id>` or `/event/<name>` page string into
 * { resource, identifier, page }. Throws INVALID_RESOURCE for anything
 * else.
 */
function parsePage(page) {
    if (typeof page !== "string") {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_PAYLOAD,
            "Suggestion page must be a string"
        );
    }
    const segments = page.split("/");
    // expect ["", "<resource>", "<identifier>"]
    if (segments.length !== 3 || segments[0] !== "") {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_RESOURCE,
            `Unsupported suggestion page "${page}"`
        );
    }
    const resource = segments[1];
    if (resource !== "card" && resource !== "event") {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_RESOURCE,
            `Unsupported resource "${resource}"`
        );
    }
    // Normalize the URL segment into the resource's natural lookup key:
    //   - card:  uniqueName, used verbatim (never contains spaces).
    //   - event: name.en, where the URL encodes spaces as underscores
    //            (see eventsController.getEditEventPage / getEventDetail),
    //            so we must convert `_` back to spaces here. Forgetting
    //            this makes the event lookup miss and the approve fail.
    let identifier = decodeURIComponent(segments[2] || "");
    if (resource === "event") {
        identifier = identifier.replace(/_/g, " ");
    }
    if (!identifier) {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_RESOURCE,
            `Missing identifier in page "${page}"`
        );
    }
    return { resource, identifier, page };
}

/**
 * Backward-compat shim for records written under the OLD schema
 * (`{ page, stringifiedJSON }`, no `resource`/`identifier`/`data`).
 * Given a lean suggestion document, fills in the new-schema fields by
 * deriving them from `page` and `stringifiedJSON` at read time. New-schema
 * records pass through unchanged. We intentionally do NOT persist the
 * derived fields — there is no migration; this is read-only normalization.
 */
function normalizeRecord(doc) {
    if (!doc) return doc;
    // Already new-schema: nothing to do.
    if (doc.resource && doc.identifier && doc.data !== undefined) {
        return doc;
    }
    const normalized = { ...doc };
    if (!normalized.resource || !normalized.identifier) {
        try {
            const parsed = parsePage(normalized.page);
            normalized.resource = normalized.resource || parsed.resource;
            normalized.identifier = normalized.identifier || parsed.identifier;
        } catch {
            // Leave fields undefined; callers that need them will surface
            // an INVALID_RESOURCE error, which is the honest outcome for a
            // record whose page we can't parse.
        }
    }
    if (normalized.data === undefined && normalized.stringifiedJSON != null) {
        try {
            normalized.data = JSON.parse(normalized.stringifiedJSON);
        } catch {
            // Same rationale as above — defer the error to the caller.
        }
    }
    return normalized;
}

/**
 * Accept either a JSON string (what the existing client sends) or an
 * already-parsed object. Returns the object form; throws INVALID_PAYLOAD
 * on a malformed string.
 */
function coerceData(data) {
    if (data == null) {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_PAYLOAD,
            "Missing suggestion data"
        );
    }
    if (typeof data === "object") return data;
    if (typeof data === "string") {
        try {
            return JSON.parse(data);
        } catch {
            throw new SuggestionError(
                SuggestionError.codes.INVALID_PAYLOAD,
                "Suggestion data is not valid JSON"
            );
        }
    }
    throw new SuggestionError(
        SuggestionError.codes.INVALID_PAYLOAD,
        "Suggestion data must be an object or JSON string"
    );
}

// -- Queries -------------------------------------------------------------

/**
 * Fetch one suggestion by id. Throws NOT_FOUND if no document matches.
 */
exports.getSuggestionById = async function (id) {
    let doc;
    try {
        doc = await Suggestions.findById(id).lean();
    } catch (e) {
        // Invalid ObjectId, etc.
        Sentry.captureException(e);
        throw new SuggestionError(
            SuggestionError.codes.NOT_FOUND,
            "Suggestion not found"
        );
    }
    if (!doc) {
        throw new SuggestionError(
            SuggestionError.codes.NOT_FOUND,
            "Suggestion not found"
        );
    }
    // Normalize old-schema records so the approve/detail flows can rely
    // on resource/identifier/data regardless of when the record was written.
    return normalizeRecord(doc);
};

/**
 * Find a single pending suggestion by ({user, page}) for the duplicate
 * check. Returns the lean document or null. Does not throw on miss.
 */
exports.getPendingSuggestion = async function ({ user, page }) {
    return await Suggestions.findOne({ user, page, status: "pending" }).lean();
};

/**
 * List pending suggestions. `sort` defaults to {} (mongo's natural order,
 * which matches the previous behavior).
 */
exports.listPendingSuggestions = async function ({ sort = {} } = {}) {
    return await Suggestions.find({ status: "pending" }).sort(sort).lean();
};

// -- Backwards-compat shim ----------------------------------------------
// Old callers (e.g. cardsController.editCardPage) still call
// `suggestionService.getSuggestion({status, page, user: {$ne}})`. Keep
// the old name returning a lean doc or null, so we don't break those
// call sites in this PR.
exports.getSuggestion = async function (query = {}) {
    try {
        return await Suggestions.findOne(query).lean();
    } catch (e) {
        Sentry.captureException(e);
        return null; // was `[]` — wrong shape, never matched what callers expected
    }
};

// -- Submission ----------------------------------------------------------

/**
 * Create a new pending suggestion. If the user already has a pending
 * suggestion on the same page, throw DUPLICATE_PENDING with the existing
 * suggestion attached so the controller can present a choice.
 *
 *   const s = await createSuggestion({ user, page, data });
 *
 * `data` may be an object or a JSON string.
 */
exports.createSuggestion = async function ({ user, page, data }) {
    const parsed = parsePage(page);
    const body = coerceData(data);

    const existing = await Suggestions.findOne({
        user,
        page,
        status: "pending",
    }).lean();
    if (existing) {
        throw new SuggestionError(
            SuggestionError.codes.DUPLICATE_PENDING,
            "You already have a pending suggestion on this page.",
            { existing }
        );
    }

    return await Suggestions.create({
        user,
        resource: parsed.resource,
        identifier: parsed.identifier,
        page: parsed.page,
        data: body,
        status: "pending",
    });
};

/**
 * Replace the user's existing pending suggestion on this page with new
 * data. If there is no existing pending suggestion, create one. This is
 * the explicit-overwrite path triggered by the "Replace with this edit"
 * button in the new duplicate-handling modal.
 */
exports.replacePendingSuggestion = async function ({ user, page, data }) {
    const parsed = parsePage(page);
    const body = coerceData(data);

    return await Suggestions.findOneAndUpdate(
        { user, page, status: "pending" },
        {
            $set: {
                user,
                resource: parsed.resource,
                identifier: parsed.identifier,
                page: parsed.page,
                data: body,
                status: "pending",
                reason: "",
                decidedBy: null,
                decidedAt: null,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

// -- Moderation ----------------------------------------------------------

/**
 * Apply a suggestion to its underlying resource and mark it approved.
 *
 *   await approveSuggestion({ id, editedData, reason, approver });
 *
 * - `editedData` is the admin-edited JSON from the textarea (object or
 *   JSON string). If omitted, the suggestion's own `data` is used.
 * - `approver` is the admin's name; recorded both in `decidedBy` and as
 *   the writer of the resource revision.
 *
 * Throws NOT_FOUND / INVALID_PAYLOAD / INVALID_RESOURCE / UPDATE_FAILED.
 */
exports.approveSuggestion = async function ({
    id,
    editedData,
    reason,
    approver,
}) {
    const suggestion = await exports.getSuggestionById(id);
    const data =
        editedData === undefined ? suggestion.data : coerceData(editedData);

    if (suggestion.resource === "card") {
        const verify = await cardService.isVerifiedTreeData(
            suggestion.identifier,
            data
        );
        if (verify.err) {
            throw new SuggestionError(
                SuggestionError.codes.INVALID_PAYLOAD,
                verify.message
            );
        }
        // Revisions record `user` = the writer. We now use the approver
        // (was the suggester, which obscured the audit trail). The
        // suggester credit is preserved on the Suggestion record itself
        // via the `user` field, which keeps decidedBy alongside it.
        const result = await cardService.updateCard({
            user: approver,
            originalUniqueName: suggestion.identifier,
            cardData: data,
        });
        if (result.err) {
            throw new SuggestionError(
                SuggestionError.codes.UPDATE_FAILED,
                result.message
            );
        }
    } else if (suggestion.resource === "event") {
        const result = await eventService.updateEvent(
            suggestion.identifier,
            data,
            approver
        );
        if (result && result.err) {
            throw new SuggestionError(
                SuggestionError.codes.UPDATE_FAILED,
                result.message
            );
        }
    } else {
        throw new SuggestionError(
            SuggestionError.codes.INVALID_RESOURCE,
            `Unsupported resource "${suggestion.resource}"`
        );
    }

    const update = await Suggestions.updateOne(
        { _id: id },
        {
            $set: {
                status: "approved",
                reason: reason || "",
                decidedBy: approver || null,
                decidedAt: new Date(),
            },
        }
    );
    if (update.matchedCount === 0) {
        // Vanishingly unlikely: deleted between fetch and update.
        throw new SuggestionError(
            SuggestionError.codes.NOT_FOUND,
            "Suggestion disappeared during approval"
        );
    }
    return { message: "Suggestion approved." };
};

/**
 * Mark a suggestion refused.
 */
exports.refuseSuggestion = async function ({ id, reason, refuser }) {
    const update = await Suggestions.updateOne(
        { _id: id },
        {
            $set: {
                status: "refused",
                reason: reason || "",
                decidedBy: refuser || null,
                decidedAt: new Date(),
            },
        }
    );
    if (update.matchedCount === 0) {
        throw new SuggestionError(
            SuggestionError.codes.NOT_FOUND,
            "Suggestion not found"
        );
    }
    return { message: "Suggestion refused." };
};

/**
 * Bulk-refuse all pending suggestions from a given user (called from
 * the ban flow). Returns { refusedCount } so callers can decide what to
 * report. Was checking the deprecated `.ok` property; now uses Mongoose
 * 6's `modifiedCount`.
 */
exports.refuseAllPendingFrom = async function (user) {
    const update = await Suggestions.updateMany(
        { user, status: "pending" },
        { $set: { status: "refused", decidedAt: new Date() } }
    );
    return { refusedCount: update.modifiedCount || 0 };
};

// -- Deprecated shims ----------------------------------------------------
// Old names preserved temporarily so any out-of-tree caller doesn't
// break. Routes / controllers in this PR use the new names directly.
exports.refuseSuggestionsFrom = exports.refuseAllPendingFrom;

/**
 * Legacy generic list: accepts an arbitrary filter and sort.
 * `userController.getUserSuggestionPage` still calls this with
 * `{ user: req.user.name }` and expects all statuses back (the view
 * filters by status itself). Keep until that caller is migrated.
 */
exports.getSuggestionList = async function (query = {}, sort = {}) {
    return await Suggestions.find(query).sort(sort).lean();
};
