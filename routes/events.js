var express = require("express");
var router = express.Router();

const eventsController = require("../controllers/eventsController");
const loginController = require("../controllers/loginController");

// Calculate DP and AP needed for rewards
// router.post("/:event/calculate", eventsController.calculate);

// Event page
router.get(
    "/new",
    loginController.hasAccess("Moderator"),
    eventsController.getEventAddPage
);
router.get(
    "/:event/edit",
    loginController.canEdit(),
    eventsController.getEventEditPage
);

router.post(
    "/new",
    loginController.hasAccess("Moderator"),
    eventsController.addEvent
);
router.post(
    "/:event/edit",
    loginController.canEdit("trusted"),
    eventsController.updateEvent
);
router.post(
    "/:event/delete",
    loginController.hasAccess("Moderator"),
    eventsController.deleteEvent
);

router.get("/:event", eventsController.getEventDetail);

module.exports = router;
