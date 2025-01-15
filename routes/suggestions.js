var express = require("express");
var router = express.Router();

const loginController = require("../controllers/loginController");
const suggestionController = require("../controllers/suggestionController");

router.post(
    "/add",
    loginController.canEdit(),
    suggestionController.addSuggestion
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
