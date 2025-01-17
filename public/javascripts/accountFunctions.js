let updatedInfo = {};
$(document).ready(function () {
    $("#inputJoinOM").attr("max", new Date().toISOString().split("T")[0]);

    $("#sortable").sortable();
    $("#sortable").disableSelection();
    $("#sortable").on("DOMSubtreeModified", () => {
        updatedInfo["characters"] = true;
    });

    $("#select-picker").selectpicker({
        liveSearch: true,
        style: "",
        styleBase: "form-control mb-3",
        title: "--",
    });
    loadProfileCards();
    $("#select-picker, input[name='card']").on("change", updateCardDisplay);

    $("#sendVerification").on("click", sendVerificationMessage);
    $("#changePassword").on("click", changePassword);
    $("input#updateProfile, input#updatePrivacy").on("click", updateProfile);
    $("form#profile, #v-pills-privacy form").on("change", (event) => {
        updatedInfo[event.target.name] = event.target.value;
    });
});

function loadProfileCards() {
    $.ajax({
        type: "get",
        url: "/getCards",
        cache: false,
    }).done(function (result) {
        if (result.err) {
            showAlert("danger", result.message);
        } else {
            let lang = document.documentElement.lang;
            result.cards.forEach((card) => {
                $("#select-picker").append(
                    `<option value="${card.uniqueName}" data-type="${card.type}">${lang === "ja" ? card.ja_name : card.name}</option>`
                );
            });
            $("#select-picker").selectpicker("refresh");
            let c = profileCard;
            if (c.endsWith("_b")) c = c.substring(0, c.length - 2);
            $("#select-picker").val(c);
            $("#select-picker").selectpicker("render");
        }
    });
}

$(window).on("beforeunload", () => {
    if (Object.keys(updatedInfo).length !== 0) {
        return confirm(
            "You have unsaved change for your profile. Do you wish to exit without saving?"
        );
    }
});

function sendVerificationMessage() {
    if (!validateFieldsEmail()) {
        showAlert("danger", "Invalid fields");
        return;
    }
    var userData = {
        email: $("#email").val(),
        password: $("#password").val(),
    };
    $.ajax({
        type: "post",
        url: "/user/" + username + "/sendVerificationEmail",
        contentType: "application/json",
        data: JSON.stringify({ userData: userData }),
        cache: false,
    }).done(function (result) {
        if (result.err) {
            showAlert("danger", result.message);
            return;
        }
        $("#sendVerification").attr("disabled", "disabled");
        showAlert("success", "Confirmation sent!");
        var cooldown = 120;
        var cooldownTimer = setInterval(function () {
            if (cooldown <= 0) {
                clearInterval(cooldownTimer);
                $("#cooldown").text("");
                $("#sendVerification").removeAttr("disabled");
            } else {
                $("#cooldown").text(cooldown + "s left to try again");
            }
            cooldown--;
        }, 1000);
    });
}

function validateFieldsEmail() {
    var email = $("#email").val();
    var password = $("#password").val();
    const re =
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (
        email.length === 0 ||
        password.length === 0 ||
        !re.test(email.toLowerCase())
    ) {
        return false;
    }
    return true;
}

function changePassword() {
    if (!validateFieldsPassword()) {
        return;
    }
    var passwordData = {
        new: $("#newPassword").val(),
        old: $("#oldPassword").val(),
    };
    $.ajax({
        type: "post",
        url: "/user/" + username + "/changePassword",
        contentType: "application/json",
        data: JSON.stringify({ passwordData: passwordData }),
        cache: false,
    }).done(function (result) {
        if (result.err) {
            showAlert("danger", result.message);
            return;
        }
        showAlert("success", "Password changed");
    });
}

function validateFieldsPassword() {
    var newPassword = $("#newPassword").val();
    var newPasswordConfirm = $("#newPasswordConfirm").val();
    if (!/^[0-9a-zA-Z!@#$%^]+$/.test(newPassword)) {
        showAlert(
            "danger",
            "Password can only contain alphabets, numbers, and !@#$%^"
        );
        return false;
    }
    if (newPassword.length < 8) {
        showAlert("danger", "Password must be at least 8 characters long");
        return false;
    }
    if (newPassword == "") {
        showAlert("danger", "Password can't be empty");
        return false;
    }
    if (newPassword != newPasswordConfirm) {
        showAlert("danger", "Confirmation password doesn't match");
        return false;
    }
    return true;
}

function updateProfile(e) {
    e.preventDefault();

    if (Object.keys(updatedInfo).length === 0) {
        showAlert("warning", "Your profile is up-to-date :)");
        return;
    }

    // characters need to be specially updated because it's an array
    if (updatedInfo["characters"]) {
        var formData = new FormData($("form#profile")[0]);
        updatedInfo["characters"] = formData.getAll("characters");
    }

    $.ajax({
        type: "post",
        url: "/user/" + username + "/updateUserProfile",
        contentType: "application/json",
        data: JSON.stringify({ updatedInfo: updatedInfo }),
        cache: false,
    }).done(function (result) {
        if (result.err) {
            showAlert("danger", result.message);
        } else {
            updatedInfo = {};
            showAlert("success", "Changes saved");
        }
    });
}

function updateCardDisplay() {
    let card = $("#select-picker").val();
    if ($(`#select-picker option[value="${card}"]`).data("type") === "Demon") {
        card += $("input[name='card']:checked").val();
    }
    $("#cardSearch img").attr("src", `/images/cards/L/${card}.jpg`);
    updatedInfo["display"] = card;
}
