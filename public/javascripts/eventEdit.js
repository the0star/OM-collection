let originalData, cardNames;
$(document).ready(function () {
    createMasks();

    originalData = JSON.stringify(prepareEventData());

    $(document).on("click", ".add-item", addItem);
    $(document).on("click", ".remove-item", removeItem);

    $("#submit").click(saveChanges); // function is in pug file

    loadCardRewardSelect();
});

function loadCardRewardSelect() {
    $.ajax({
        type: "get",
        url: "/getCards",
        cache: false,
    }).done(function (result) {
        if (result.err) {
            showAlert("danger", result.message);
        } else {
            cardNames = result.cards.map((x) => x.name);
            $(".card-select").autocomplete({ source: cardNames });
        }
    });
}

function createMasks() {
    let maskOptions = {
        mask: "YYYY.MM.DD, hh:mm:ss",
        lazy: false,
        blocks: {
            YYYY: {
                mask: IMask.MaskedRange,
                from: 2019,
                to: 2050,
            },
            MM: {
                mask: IMask.MaskedRange,
                from: 1,
                to: 12,
                maxLength: 2,
            },
            DD: {
                mask: IMask.MaskedRange,
                from: 1,
                to: 31,
                maxLength: 2,
            },
            hh: {
                mask: IMask.MaskedRange,
                from: 0,
                to: 23,
                maxLength: 2,
            },
            mm: {
                mask: IMask.MaskedRange,
                from: 0,
                to: 60,
                maxLength: 2,
            },
            ss: {
                mask: IMask.MaskedEnum,
                enum: ["00"],
            },
        },
    };
    let start = $("#start")[0];
    let end = $("#end")[0];
    let boostingStart = $("#boostingStart")[0];
    let boostingEnd = $("#boostingEnd")[0];
    let maskStart = IMask(start, maskOptions);
    let maskEnd = IMask(end, maskOptions);
    let mbs = IMask(boostingStart, maskOptions);
    let mbe = IMask(boostingEnd, maskOptions);
    maskStart.value = start.value;
    maskEnd.value = end.value;
    mbs.value = boostingStart.value;
    mbe.value = boostingEnd.value;
}

function removeItem() {
    $(this).closest(".item-container").remove();
}

function addItem() {
    var template = $(this).data("clone");
    $(this).parent().children("div:first-of-type").append($(template).html());

    if (template === "#rewardTemplate") {
        $(".card-select").autocomplete({ source: cardNames });
    }
}

function validateFields() {
    if (!$("#en-name").val()) {
        showAlert("danger", "English name must be filled");
        return false;
    }
    return true;
}

function prepareEventData() {
    const form = document.getElementById("info");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.name = {
        en: data["en-name"],
        ja: data["ja-name"],
        zh: data["zh-name"],
    };
    ["en-name", "ja-name", "zh-name"].forEach((e) => delete data[e]);

    if (data.type !== "PopQuiz") {
        return data;
    }

    const rewardType = $("input[name='rewardListType']:checked").val();
    const popQuizData = {
        rewardListType: rewardType,
        hasKeys: $("input#has-keys").is(":checked"),
        isLonelyDevil: $("input#lonelydevil").is(":checked"),
        isBirthday: $("input#birthday").is(":checked"),
        boostingMultiplier: parseInt($("#boostingMultiplier").val()),
        stages: $("input#stages").val(),
        stageList: getStages(),
    };

    if (popQuizData.hasKeys) {
        popQuizData.lockedStages = getLockedStages();
    }

    if (rewardType === "points") {
        popQuizData.listRewards = getRewards();
    } else {
        popQuizData.boxRewards = getBoxRewards();
    }

    if (popQuizData.boostingMultiplier > 1) {
        popQuizData.boostingStart = $("#boostingStart").val();
        popQuizData.boostingEnd = $("#boostingEnd").val();
    }

    return { ...data, ...popQuizData };
}

function getRewards() {
    let rewards = $("#rewards form")
        .map((index, form) => {
            const formData = new FormData(form);
            let reward = {};
            formData.forEach((value, key) => (reward[key] = value));
            return reward;
        })
        .toArray();
    return rewards.filter((r) => r.card && r.points);
}

function getBoxRewards() {
    let sets = [];

    $("div.boxset").each(function () {
        let set = {
            name: $(this).find("input[name='box-set-name']").val(),
            cost: $(this).find("input[name='box-set-cost']").val(),
            boxes: [],
        };

        $(this)
            .find("form")
            .each(function () {
                let formData = new FormData(this);
                let boxData = {};
                formData.forEach((value, key) => (boxData[key] = value));
                let rewards = [];
                boxData.specialRewards.split("\n").forEach((item) => {
                    let t = item.split("/");
                    rewards.push({ name: t[0].trim(), req: parseInt(t[1]) });
                });
                boxData.specialRewards = rewards.filter((i) => i.name && i.req);
                set.boxes.push(boxData);
            });

        sets.push(set);
    });

    return sets.filter((r) => r.name && r.cost);
}

function getStages() {
    let stages = [];
    let str = $("div#stageList textarea").val();
    str.split("\n").forEach((item) => {
        let d = item.split(",");
        stages.push({
            name: d.shift().trim(),
            rewards: d.map((e) => e.trim()),
        });
    });
    return stages.filter((e) => e.name && e.rewards);
}

function getLockedStages() {
    let stages = [];
    let str = $("div#keys textarea").val();
    str.split("\n").forEach((item) => {
        let i = item.split(",");
        stages.push({
            name: i[0].trim(),
            req: parseInt(i[1]),
        });
    });
    return stages.filter((e) => e.name && e.req);
}
