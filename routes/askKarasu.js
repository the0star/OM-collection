const express = require("express");
const askKarasuController = require("../controllers/askKarasuController");
const router = express.Router();

router.get("/dt-rewards", askKarasuController.getDTRewardsPage);
router.get("/card-unlock-items", askKarasuController.getUnlockItemsPage);
router.get("/majolish-cards", askKarasuController.getMajolishCardsPage);
router.get("/skill-charge-time", askKarasuController.getSkillChargeSpeedPage);
router.get("/skills", askKarasuController.getSkillsPage);

// redirect old links
router.get("/:q", (req, res, next) => {
    if (
        [
            "dt_rewards",
            "card_unlock_items",
            "majolish_cards",
            "skill_charge_time",
        ].includes(req.params.q)
    ) {
        return res.redirect(301, req.originalUrl.replace(/_/g, "-"));
    }
    next();
});

module.exports = router;
