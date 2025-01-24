let originalData;
let selectPickerOptions = {
    liveSearch: true,
    style: "",
    styleBase: "form-control mb-0",
    title: "required item name",
};

$(document).ready(function () {
    originalData = JSON.stringify(getCardData());

    // TODO: add style
    $(".autocomplete").autocomplete({ source: rewards });

    $("#name").on("change", fillUniqueName);

    $("#submit").on("click", submitChange); // function is in pug file

    $("#addEvent").on("click", addEvent);
    $("#removeEvent").on("click", removeEvent);

    $(".item-select").selectpicker(selectPickerOptions);
});

$(document).on("click", ".add-item", function () {
    let template = $(this).data("clone");
    $(this).parent().children("div:first-of-type").append($(template).html());
    // TODO: auto add node count to new node
    $(".autocomplete").autocomplete({ source: rewards });
    $(".item-select").selectpicker(selectPickerOptions);
});
$(document).on("click", ".remove-item", function () {
    $(this).parent().remove();
});

function fillUniqueName() {
    var name = $("#name").val();
    var uniqueName = name.replace(/[\\/:*?"<>|]/g, "");
    uniqueName = uniqueName.replace(/ /g, "_");
    $("#uniqueName").val(uniqueName);
}

function validateFields() {
    var uniqueName = $("#uniqueName").val();
    if (/[\\/:*?"<>| ]/.test(uniqueName)) {
        showAlert("danger", "Invalid unique name");
        return false;
    }
    if (!$("#name").val() || !uniqueName) {
        showAlert("danger", "Name and unique name must be filled");
        return false;
    }
    return true;
}

function getCardData() {
    let data = {
        name: $("#name").val(),
        uniqueName: $("#uniqueName").val(),
        ja_name: $("#ja_name").val(),
        source: getCardSource("#source"),
        strength: getCardStrength(),
        type: $("#type").val(),
        rarity: $("#rarity").val(),
        attribute: $("#attribute").val(),
        characters: getSelectedCharacters(),
        dt: getTreeRewards(),
        skills: getCardSkills(),
        number: $("#number").val(),
    };
    if (data.rarity === "UR+") {
        data.animation = $("input[name='animationType']:checked").val();
    }
    return data;
}

function getCardStrength() {
    let formData = new FormData($("div#strength>form")[0]);
    let data = {
        pride: [],
        greed: [],
        envy: [],
        wrath: [],
        lust: [],
        gluttony: [],
        sloth: [],
    };

    for (var pair of formData.entries()) {
        data[pair[0]].push(parseInt(pair[1]));
    }

    for (const key in data) {
        data[key] = {
            min: data[key][0],
            max: data[key][1],
            fdt: data[key][2],
        };
    }

    return data;
}

function getSelectedCharacters() {
    var arr = [];
    $('input[name="characters"]:checked').each(function () {
        arr.push($(this).val());
    });
    return arr;
}

function getCardSource(src) {
    var list = $.map($(src).children(), (input) => $(input).val()).filter(
        (x) => x !== ""
    );
    return list;
}

function addEvent() {
    var target = $(this).data("target");
    $(target).append('<input class="form-control" type="text">');
}

function removeEvent() {
    var target = $(this).data("target");
    $(target + " input:last-child").remove();
}

function getTreeRewards() {
    let rewards = [];

    $("div#tree form").each(function () {
        let formData = new FormData(this);
        let node = { requirements: [] };
        let name;
        for (let pair of formData.entries()) {
            if (["count", "amount", "grimmCost"].includes(pair[0])) {
                pair[1] = parseInt(pair[1]) || null;
            }
            if (pair[0] === "name") {
                name = pair[1];
            } else if (pair[0] === "amount") {
                node.requirements.push({ name: name, amount: pair[1] });
            } else if (pair[0] === "_id" && pair[1] === "") {
                continue;
            } else {
                node[pair[0]] = pair[1];
            }
        }

        if (node.type === "level_up") {
            node.reward = `Lv.${node.reward} Rank Up`;
        }

        rewards.push(node);
    });

    rewards = rewards.filter((x) => x.reward && x.type);

    return rewards;
}

function getCardSkills() {
    let skills = [];

    $("div#skills form").each(function () {
        let formData = new FormData(this);
        let skill = { skillType: "", title: "", description: "" };
        for (let pair of formData.entries()) {
            skill[pair[0]] = pair[1].trim();
        }
        skills.push(skill);
    });

    return skills.filter((x) => x.skillType && x.title && x.description);
}

function setCD(countdown) {
    $("button#submit").prop("disabled", true);
    let cd = setInterval(() => {
        $("span#cd").text(--countdown + "s");
        if (countdown === 0) {
            clearInterval(cd);
            $("span#cd").text("");
            $("button#submit").prop("disabled", false);
        }
    }, 1000);
}
