var express = require("express");
var router = express.Router();

const loginController = require("../controllers/loginController");
const suggestionController = require("../controllers/suggestionController");

router.post(
    "/add",
    loginController.canEdit(),
    suggestionController.addSuggestion
);
// Explicit "I know I have a pending suggestion on this page — replace it"
// path. Triggered by the duplicate-detected modal in cardEdit/eventEdit.
router.post(
    "/replace",
    loginController.canEdit(),
    suggestionController.replaceSuggestion
);
router.post(
    "/refuse",
    loginController.hasAccess("Admin"),
    suggestionController.refuseSuggestion
);
router.post(
    "/approve",
    loginController.hasAccess("Admin"),
    suggestionController.approveSuggestion
);

router.get(
    "/:id",
    loginController.hasAccess("Admin"),
    suggestionController.getSuggestionPage
);
router.get("/", suggestionController.getSuggestionList);

module.exports = router;
