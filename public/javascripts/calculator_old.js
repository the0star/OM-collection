var settings = {};
const DEFAULT_SETTINGS =
    '{"stagesCleared":"0","adBattles":"0","denergy":"0","adAP":"0","spg":"0","friends":"0","toDo":"0","fridgeMission":{"isVIP":false,"count":"0"},"other":"0","popquiz":false}';
$(function () {
    recallTab();
    $("#rewards>li>a").click(function () {
        sessionStorage.setItem("selected", $(this).attr("id"));
    });

    $("input#stagesCleared").change(() =>
        $("input.custom-range").prop(
            "value",
            $("input#stagesCleared").prop("value")
        )
    );
    $("input.custom-range").on("input", () =>
        $("input#stagesCleared").prop(
            "value",
            $("input.custom-range").prop("value")
        )
    );

    checkAdditionalSettings();
    $("[data-dismiss='modal']").on("click", checkAdditionalSettings);
    $("button#apply").on("click", applyAdditionalSettings);
});

function startCountdown() {
    var today = new Date();
    var daysLeft = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
    var noun = "day";

    // set to jst midnight if not last day of pop quiz.
    if (daysLeft > 0) {
        endDate.setUTCHours(15);
        noun = "days";
    }

    var x = setInterval(function () {
        var now = new Date();
        var distance = endDate - now;

        var hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);

        $("p.countdown").text(`${hours}:${minutes}:${seconds}`);
        $("small.total-countdown").text(
            `${daysLeft} ${noun} ${hours}:${minutes}:${seconds}`
        );
    }, 1000);
}

function recallTab() {
    var params = new URLSearchParams(document.location.search.substring(1));
    var custom = params.get("customGoal");
    var selected = sessionStorage.getItem("selected");

    if (custom) {
        selected = "Custom-tab";
    }

    if (selected && $("#" + selected).parent().length !== 0) {
        $("#" + selected).tab("show");
    } else {
        $("#rewards>li:first-child>a").tab("show");
    }
}

function checkAdditionalSettings() {
    var cookie = getCookie("calculator");
    if (cookie) {
        // set values
        settings = JSON.parse(cookie);
        for (let key in settings) {
            switch (key) {
                case "fridgeMission":
                    $("#fridgeMission").val(settings[key].count);
                    $("#isVIP").prop("checked", settings[key].isVIP);
                    break;
                case "popquiz":
                    $("#popquiz").prop("checked", settings[key]);
                    break;
                case "stagesCleared":
                    $("#stagesCleared, #stagesClearedRange").val(settings[key]);
                    break;
                default:
                    $("#" + key).val(settings[key]);
            }
        }
    } else {
        applyAdditionalSettings(); // set default values
    }
    updateIndicator();
}

function applyAdditionalSettings() {
    settings = {
        stagesCleared: $("#stagesCleared").val(),
        adBattles: $("#adBattles").val(),
        denergy: $("#denergy").val(),
        adAP: $("#adAP").val(),
        spg: $("#spg").val(),
        friends: $("#friends").val(),
        toDo: $("#toDo").val(),
        fridgeMission: {
            isVIP: $("#isVIP").is(":checked"),
            count: $("#fridgeMission").val(),
        },
        other: $("#other").val(),
        popquiz: $("#popquiz").is(":checked"),
    };

    document.cookie = `calculator=${JSON.stringify(settings)};expires=${endDate};path=/calculator;`;

    $("#settingsModal").modal("hide");
    updateIndicator();
}

function updateIndicator() {
    if (JSON.stringify(settings) === DEFAULT_SETTINGS) {
        $("#indicator")
            .removeClass()
            .addClass("badge badge-warning")
            .text("OFF");
    } else {
        $("#indicator")
            .removeClass()
            .addClass("badge badge-success")
            .text("ON");
    }
}

// sourced from w3schools https://www.w3schools.com/js/js_cookies.asp
function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
