const express = require("express");
const router = express.Router();
const https = require("https");

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
router.get("/card_pages", cardController.getCardDirectory);

// Events
router.get("/events", eventsController.getEventsPage);
router.get("/calculator/:type", eventsController.getCalculatorPage);

// Account management
router.get("/login", loginController.getLoginPage);
router.post("/login", loginController.authenticate, loginController.login);
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
router.get("/getCards", cardController.getCards); // card list page
router.get("/getCards2", cardController.getCards2); // character card page
router.get("/getTreeData", cardController.getTreeData);
router.get("/tree-tracker/rank-up", miscController.getTreeTracker);
router.get("/tree-tracker", miscController.getTreeTracker);

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
    if (/^\/(cards\/|events\/|bg\/)/.test(req.path)) {
        res.redirect(`${remoteImgURL}${req.originalUrl}`);
    } else {
        next();
    }
});

module.exports = router;
