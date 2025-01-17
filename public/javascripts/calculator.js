const utc = "Etc/Greenwich";
const jst = "Asia/Tokyo";
let dailyFreeBattles = POPQUIZ.stages * 3;
let dailyFreeAP = 288;
let resetsLeft;
let settings = {
    automaticRefill: true,
    todo: true,
    spg: true,
    apAds: false,
    friends: 50,
    fridgeMission: 60, // 0, non-vip 60, vip 120
    dailyReset: true,
    battleAds: false,
    battlesCleared: false,
}; // default

$(function () {
    dayjs().format();
    dayjs.extend(window.dayjs_plugin_utc);
    dayjs.extend(window.dayjs_plugin_timezone);

    getSavedSettings();

    if (new Date() < new Date(POPQUIZ.start)) {
        countdown(POPQUIZ.start, "cd");
    } else {
        countdown(POPQUIZ.end, "cd");
    }
    if (
        POPQUIZ.boostingMultiplier > 1 &&
        new Date() < new Date(POPQUIZ.boostingEnd)
    ) {
        if (new Date() < new Date(POPQUIZ.boostingStart)) {
            countdown(POPQUIZ.boostingStart, "boostingcd");
        } else {
            countdown(POPQUIZ.boostingEnd, "boostingcd");
        }
    }

    calculate();

    $("form#settings").on("change", syncSettings);
    $("form#calculator").on("change", calculate);
});

function getSavedSettings() {
    let savedSettings = JSON.parse(localStorage.getItem("calculatorSettings"));
    if (savedSettings) {
        settings = savedSettings;
        $("#automaticRefill").prop("checked", settings.automaticRefill);
        $("#todo").prop("checked", settings.todo);
        $("#spg").prop("checked", settings.spg);
        $("#apAds").prop("checked", settings.apAds);
        $("#friends").val(settings.friends);
        $("#fridgeMission").val(settings.fridgeMission);
        $("#dailyReset").prop("checked", settings.dailyReset);
        $("#battleAds").prop("checked", settings.battleAds);
        $(
            "input[name='battlesCleared'][value=" +
                settings.battlesCleared +
                "]"
        ).prop("checked", true);
    }
    syncSettings();
}

function syncSettings() {
    settings = {
        automaticRefill: $("#automaticRefill").is(":checked"),
        todo: $("#todo").is(":checked"),
        spg: $("#spg").is(":checked"),
        apAds: $("#apAds").is(":checked"),
        friends: parseInt($("#friends").val()),
        fridgeMission: parseInt($("#fridgeMission").val()),
        dailyReset: $("#dailyReset").is(":checked"),
        battleAds: $("#battleAds").is(":checked"),
        battlesCleared:
            $("input[name='battlesCleared']:checked").val() === "true",
    };

    dailyFreeAP = 288;
    if (settings.todo) dailyFreeAP += 30;
    if (settings.spg) dailyFreeAP += 40;
    if (settings.apAds) dailyFreeAP += 50;
    dailyFreeAP += settings.friends;
    dailyFreeAP += settings.fridgeMission;

    dailyFreeBattles = POPQUIZ.stages * 3;
    if (settings.battleAds) dailyFreeBattles += 5;

    resetsLeft = getDaysLeft();
    if (!settings.battlesCleared) resetsLeft += 1;

    localStorage.setItem("calculatorSettings", JSON.stringify(settings));

    calculate();
}

function resetResult() {
    $(
        "#resultTabContent span, #absfree, #goal, .table td, .additionalpts"
    ).text("--");
}

function getBattleCost(battles) {
    return Math.ceil(battles / 3) * 5;
}

function getAPCost(ap) {
    return Math.ceil(ap / 10);
}

/*
function remainingFreeAP() {
	let mintuesLeft;

	if (getDaysLeft() === 0) {
		minutesLeft = (new Date(POPQUIZ.end) - new Date()) / 1000 / 60;
	} else {
		let endTime = new Date();
		let timezoneOffset = endTime.getTimezoneOffset() / 60 + 9;
		endTime.setHours(24 - timezoneOffset,0,0,0);
		if (new Date() > endTime) {
			endTime.setDate(endTime.getDate() + 1);
		}
		// time left until next refresh
		minutesLeft = (endTime - new Date()) / 1000 / 60;
	}

	return Math.floor(minutesLeft / 5);
}*/

function startResetCountdown() {
    let now = dayjs();
    let end = dayjs.tz(POPQUIZ.end, utc);
    let daysLeft = end.diff(now, "day");
    let jstMidnight = dayjs()
        .tz(jst)
        .set("hour", 0)
        .set("minute", 0)
        .set("second", 0);

    if (daysLeft > 0) {
        if (now > jstMidnight) end = jstMidnight.add(1, "day");
        else end = jstMidnight;
    }

    let timer = setInterval(function () {
        let h = end
            .diff(dayjs(), "h")
            .toLocaleString("en-US", { minimumIntegerDigits: 2 });
        let m = (end.diff(dayjs(), "m") % 60).toLocaleString("en-US", {
            minimumIntegerDigits: 2,
        });
        let s = (end.diff(dayjs(), "s") % 60).toLocaleString("en-US", {
            minimumIntegerDigits: 2,
        });
        $("#resetCd").text(`${h}:${m}:${s}`);
    }, 1000);
}

function getDaysLeft(start = dayjs()) {
    let end = dayjs.tz(POPQUIZ.end, utc);
    let daysLeft = end.diff(start, "day");
    let jstMidnight = dayjs()
        .date(dayjs().date())
        .tz(jst)
        .hour(0)
        .minute(0)
        .second(0);
    if (start < jstMidnight) daysLeft++; // before daily refresh
    return daysLeft;
}

function getBoostingDaysLeft() {
    if (POPQUIZ.boostingMultiplier == 1) {
        return 0;
    }
    let now = new Date();
    let start = new Date(POPQUIZ.boostingStart);
    let end = new Date(POPQUIZ.boostingEnd);
    if (now > end) return 0;
    if (now > start) {
        start = now;
    }
    return Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
}

function calculateDailyGoal(
    pointsToGoal /* already removed bonus */,
    ptsPerBattle,
    currentPts
) {
    let remainingFreePts = dailyFreeBattles * resetsLeft * ptsPerBattle;
    let totalBattles, todaysFreeBattles;

    if (settings.battlesCleared) {
        todaysFreeBattles = 0;
        totalBattles = 0;
    } else {
        totalBattles = Math.ceil(pointsToGoal / ptsPerBattle / resetsLeft);
        todaysFreeBattles = dailyFreeBattles;
    }

    let todaysGoal = currentPts + totalBattles * ptsPerBattle;
    $("#goal").text(todaysGoal.toLocaleString("en"));

    let buyBattles = Math.max(totalBattles - todaysFreeBattles, 0);
    let freeBattles = totalBattles - buyBattles;
    let battlesCost = getBattleCost(buyBattles);
    let totalAP = totalBattles * 8;
    let freeAP = Math.min(dailyFreeAP, totalAP);
    let buyAP = totalAP - freeAP;
    let apCost = getAPCost(buyAP);

    $("#freeap").text(freeAP.toLocaleString("en"));
    $("#buyap").text(buyAP.toLocaleString("en"));
    $("#total-daily-ap").text(totalAP.toLocaleString("en"));
    $("#freebattles").text(freeBattles.toLocaleString("en"));
    $("#buybattles").text(buyBattles.toLocaleString("en"));
    $("#total-daily-battles").text(totalBattles.toLocaleString("en"));
    $("#apcost").text(apCost.toLocaleString("en"));
    $("#battlescost").text(battlesCost.toLocaleString("en"));
    $("#total-daily-cost").text((apCost + battlesCost).toLocaleString("en"));
}

function calculateAdditional(buyBattles, pointsToPurchase, ptsPerBattle) {
    let battlesCost = getBattleCost(buyBattles);
    let totalAP = buyBattles * 8;
    $("#ap-non-boosting").html(
        `${totalAP.toLocaleString("en")}<br>for ${Math.ceil(totalAP / 10).toLocaleString("en")} DP`
    );
    $("#battles-non-boosting").html(
        `${buyBattles.toLocaleString("en")}<br>for ${battlesCost.toLocaleString("en")} DP (${Math.ceil(battlesCost / 5).toLocaleString("en")} D-Energy)`
    );

    let multiplier = POPQUIZ.boostingMultiplier;
    ptsPerBattle += 120 * (multiplier - 1);

    let totalBattles = Math.ceil(pointsToPurchase / ptsPerBattle);
    battlesCost = getBattleCost(totalBattles);
    totalAP = totalBattles * 8;

    $("#ap-boosting").html(
        `${totalAP.toLocaleString("en")}<br>for ${Math.ceil(totalAP / 10).toLocaleString("en")} DP`
    );
    $("#battles-boosting").html(
        `${totalBattles.toLocaleString("en")}<br>for ${battlesCost.toLocaleString("en")} DP (${Math.ceil(battlesCost / 5).toLocaleString("en")} D-Energy)`
    );
}

/**
 * 1. Find how many "free" points can be obtained.
 * 2. Divide "paid" points among remaining days.
 */
function calculate() {
    let goal = parseInt($("input[name='goal']").val());
    let currentPts = parseInt($("input[name='currpts']").val());
    let ptsPerBattle = parseInt($("input[name='ppb']").val());

    if (
        isNaN(goal) ||
        isNaN(currentPts) ||
        isNaN(ptsPerBattle) ||
        goal <= 0 ||
        currentPts < 0 ||
        ptsPerBattle < 0 ||
        goal <= currentPts
    ) {
        resetResult();
        return;
    }

    let pointsToGoal = goal - currentPts;

    let boostingFreePoints =
        dailyFreeBattles *
        120 *
        (POPQUIZ.boostingMultiplier - 1) *
        getBoostingDaysLeft();
    let baseFreePoints = dailyFreeBattles * ptsPerBattle * resetsLeft;
    let totalFreePoints = baseFreePoints + boostingFreePoints;

    let pointsToPurchase = Math.max(goal - currentPts - totalFreePoints, 0);

    $("#freepts").text((currentPts + totalFreePoints).toLocaleString("en"));
    $(".additionalpts").text(pointsToPurchase.toLocaleString("en"));

    let absFreeBattles = Math.floor(dailyFreeAP / 8);
    $("#absfree").text(
        (
            currentPts +
            absFreeBattles * ptsPerBattle * resetsLeft +
            absFreeBattles *
                120 *
                (POPQUIZ.boostingMultiplier - 1) *
                getBoostingDaysLeft()
        ).toLocaleString("en")
    );

    if (pointsToGoal > baseFreePoints)
        pointsToGoal = Math.max(pointsToGoal - boostingFreePoints, 0);

    let totalBattles = Math.ceil(pointsToGoal / ptsPerBattle);
    let freeBattles = Math.min(dailyFreeBattles * resetsLeft, totalBattles);
    let buyBattles = totalBattles - freeBattles;
    let totalBattlesCost = getBattleCost(buyBattles);

    let totalAP = totalBattles * 8;
    let freeAP = Math.min(dailyFreeAP * resetsLeft, totalAP);
    let buyAP = totalAP - freeAP;
    let totalAPCost = getAPCost(buyAP);

    $("#total-freeap").text(freeAP.toLocaleString("en"));
    $("#total-buyap").text(buyAP.toLocaleString("en"));
    $("#total-ap").text(totalAP.toLocaleString("en"));
    $("#total-freebattles").text(freeBattles.toLocaleString("en"));
    $("#total-buybattles").text(buyBattles.toLocaleString("en"));
    $("#total-battles").text(totalBattles.toLocaleString("en"));
    $("#total-ap-cost").text(totalAPCost.toLocaleString("en"));
    $("#total-battle-cost").text(totalBattlesCost.toLocaleString("en"));
    $("#total-dp").text((totalAPCost + totalBattlesCost).toLocaleString("en"));

    calculateDailyGoal(pointsToGoal, ptsPerBattle, currentPts);
    calculateAdditional(buyBattles, pointsToPurchase, ptsPerBattle);
}

function countdown(d, id) {
    let countDownDate = new Date(d).getTime();
    let timer = setInterval(function () {
        let now = new Date().getTime();
        let distance = countDownDate - now;
        let days = Math.floor(distance / (1000 * 60 * 60 * 24));
        let hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ).toLocaleString("en-US", { minimumIntegerDigits: 2 });
        let minutes = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60)
        ).toLocaleString("en-US", { minimumIntegerDigits: 2 });
        let seconds = Math.floor(
            (distance % (1000 * 60)) / 1000
        ).toLocaleString("en-US", { minimumIntegerDigits: 2 });

        document.getElementById(id).innerHTML =
            `${days} days ${hours}:${minutes}:${seconds}`;

        if (distance < 0) {
            clearInterval(timer);
            document.getElementById(id).innerHTML = "--";
        }
    }, 1000);
}
