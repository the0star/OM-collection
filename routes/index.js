const express = require("express");
const router = express.Router();

const cardController = require("../controllers/cardsController");
const userController = require("../controllers/userController");
const miscController = require("../controllers/miscController");
const eventsController = require("../controllers/eventsController");
const loginController = require("../controllers/loginController");
const storyController = require("../controllers/storyController");

const remoteImgURL = process.env.REMOTE_IMG_URL;

// Static pages
router.get("/", cardController.index);
router.get("/policies", miscController.privacyPolicy);
router.get("/surpriseGuest/:character", miscController.surpriseGuest);
router.get("/surpriseGuest", miscController.surpriseGuest);
router.get("/rankings", userController.getRankingsPage);
router.get("/icons/:character", cardController.getIconPage);
router.get("/icons", cardController.getIconDirectory);
router.get("/closing_notice", miscController.closingNotice);

// Cards lists
router.get("/cards/:character", cardController.getCharacterCardPage);
router.get("/cards", cardController.getCardsListPage);
router.get(
    "/hiddenCards",
    loginController.hasAccess("Admin"),
    cardController.getHiddenCardsListPage
);
router.get("/card_pages", cardController.getCardDirectory);

// Events
router.get("/events", eventsController.getEventsPage);
router.get("/calculator/:type", eventsController.getCalculatorPage);

// Account management
router.get("/login", loginController.getLoginPage);
router.post("/login", loginController.login);
router.get("/logout", loginController.isLoggedIn(), loginController.logout);
router.get("/signup", loginController.getSignupPage);
router.post(
    "/signup",
    loginController.validateSignupInput,
    loginController.signup
);
router.post("/signup/checkUsername", loginController.signupCheckUsername);

// User's personal collection
router.get(
    "/collection/getOwnedCards",
    loginController.isLoggedIn(),
    userController.getOwnedUniqueNames
);
router.post(
    "/collection/submitCollectionChanges",
    loginController.isLoggedIn(),
    userController.submitCollectionChanges
);
router.get("/:username/collection", cardController.getOwnedCardsPage);
router.get("/:username/favourites", cardController.getFavouriteCardsPage);
router.get("/:username/profile", cardController.getProfilePage);

// User Management
router.get(
    "/userList",
    loginController.hasAccess("Admin"),
    userController.getUserListPage
);
router.post(
    "/updateSupport",
    loginController.hasAccess("Admin"),
    userController.updateSupport
);

// Misc.
router.get("/getCards", cardController.getCards); // TODO: refactor
router.get("/getCards2", cardController.getCards2); // TODO: refactor
// router.get("/animations", cardController.getAnimationList);
router.get("/getTreeData", cardController.getTreeData);
router.get("/tree-tracker/rank-up", miscController.getTreeTracker);
router.get("/tree-tracker", miscController.getTreeTracker);
router.get("/tree_tracker/rank_up", (req, res) => {
    res.redirect(301, "/tree-tracker/rank-up");
});
router.get("/tree_tracker", (req, res) => {
    res.redirect(301, "/tree-tracker");
});

router.post(
    "/update_tree",
    loginController.isLoggedIn(),
    userController.updateUserTree
);

router.get("/getTeam", miscController.getTeam);
router.get("/team-builder", miscController.getTeamBuilder);

router.get("/stories", storyController.getStories);
router.get("/story/main/:name", storyController.getStory);

router.use("/images", (req, res, next) => {
    const imgPaths = ["/cards/", "/events/", "/bg/"];
    const match = imgPaths.find((path) => req.path.startsWith(path));
    if (match) {
        res.redirect(301, `${remoteImgURL}/images${req.path}`);
    } else {
        next();
    }
});

module.exports = router;
