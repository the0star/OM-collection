const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const loginController = require("../controllers/loginController");

// Restore password
router.post("/restorePassword", loginController.restorePassword);

// Email verification
router.post(
    "/:name/sendVerificationEmail",
    loginController.isSameUser(),
    loginController.sendVerificationEmail
);
router.get(
    "/:name/confirmEmail/:code",
    loginController.isSameUser(),
    loginController.verifyEmail
);

// Password change
router.post(
    "/:name/changePassword",
    loginController.isSameUser(),
    loginController.changePassword
);

// update profile
router.post(
    "/:name/updateUserProfile",
    loginController.isSameUser(),
    userController.updateUserProfile
);

router.post(
    "/issueBan",
    loginController.hasAccess("Admin"),
    userController.banUser
);

// Misc.
router.get(
    "/tree-progress",
    loginController.isLoggedIn(),
    userController.getTreeProgressPage
);
router.get(
    "/edits",
    loginController.isLoggedIn(),
    userController.getUserSuggestionPage
);

// Account settings page
router.get("/", loginController.isLoggedIn(), userController.getAccountPage);

module.exports = router;
