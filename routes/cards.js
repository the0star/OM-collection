const express = require("express");
const router = express.Router();

const cardsController = require("../controllers/cardsController");
const userController = require("../controllers/userController");
const loginController = require("../controllers/loginController");

/* Admin */

// Get card edit page
router.get(
    "/new",
    loginController.hasAccess("Moderator"),
    cardsController.getEditCardPage
);
router.get(
    "/:card/edit",
    loginController.canEdit("regular"),
    cardsController.getEditCardPage
);

// Edit or add card
router.post(
    "/new",
    loginController.hasAccess("Moderator"),
    cardsController.addNewCard
);
router.post(
    "/:card/edit",
    loginController.canEdit("trusted"),
    cardsController.updateCard
);

// Make hidden card available to everyone
// router.get('/:card/makePublic', loginController.hasAccess("Admin"), cardsController.makeCardPublic);

// Delete card
router.post(
    "/delete",
    loginController.hasAccess("Admin"),
    cardsController.deleteCard
);

/* General */

// "Add to/ remove from collection" on card detail page
router.post(
    "/:card/submitCardStatusChange",
    loginController.isLoggedIn(),
    userController.submitCardStatusChange
);

// Get card detail page
router.get("/:card", cardsController.getCardDetailPage);

module.exports = router;
