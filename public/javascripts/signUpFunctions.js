$(document).ready(function () {
    var username = $("input#username").val();
    $("input#username").attr("value", username);
    if (username) {
        checkUsername();
    }
    var password = $("input#password").val();
    $("input#password").attr("value", password);
    if (password) {
        checkPassword();
    }
    var confirmPassword = $("input#confirmPassword").val();
    $("input#confirmPassword").attr("value", confirmPassword);
    if (confirmPassword) {
        checkConfirmationPassword();
    }

    $("input#username").on("change", checkUsername);
    $("input#password").on("keyup", checkPassword);
    $("input#confirmPassword").on("keyup", checkConfirmationPassword);
    $("button#signUp").on("click", checkSignUp);
});

function checkUsername(e) {
    var username = $("input#username").val();
    $("input#username").attr("value", username);

    if (!/^[0-9a-zA-Z_.-]+$/.test(username)) {
        $("small#usernameError").html(
            "Username can only contain alphabets, numbers, and ._-"
        );
        return;
    }

    $.ajax({
        type: "post",
        url: "/signup/checkUsername",
        data: { username: username },
    }).done(function (data) {
        if (data === "error") {
            $("small#usernameError").html("Error");
            return;
        }
        if (data) {
            $("small#usernameError").html("Username already taken or invalid");
            $("input#username")[0].setCustomValidity(
                "Username already taken or invalid"
            );
        } else {
            if (username == "")
                $("small#usernameError").html("Username can't be empty");
            else {
                $("small#usernameError").html("");
                $("input#username")[0].setCustomValidity("");
            }
        }
    });
}

function checkPassword(e) {
    var password = $("input#password").val();
    $("input#password").attr("value", password);

    var confirmPassword = $("input#confirmPassword").val();

    if (!/^[0-9a-zA-Z!@#$%^]+$/.test(password)) {
        $("small#passwordError").html(
            "Password can only contain alphabets, numbers, and !@#$%^"
        );
        return;
    }

    if (password.length < 8) {
        $("small#passwordError").html(
            "Password must be at least 8 characters long"
        );
        return;
    }
    if (password == "")
        $("small#passwordError").html("Password can't be empty");
    else $("small#passwordError").html("");
    if (password != confirmPassword) {
        $("small#passwordConfirmationError").html("Passwords don't match");
        $("input#confirmPassword")[0].setCustomValidity(
            "Passwords don't match"
        );
        return;
    }
    $("small#passwordConfirmationError").html("");
    $("input#confirmPassword")[0].setCustomValidity("");
}

function checkConfirmationPassword(e) {
    var password = $("input#password").val();
    var confirmPassword = $("input#confirmPassword").val();
    $("input#confirmPassword").attr("value", confirmPassword);

    if (password != confirmPassword) {
        $("small#passwordConfirmationError").html("Passwords don't match");
        $("input#confirmPassword")[0].setCustomValidity(
            "Passwords don't match"
        );
        return;
    }
    $("small#passwordConfirmationError").html("");
    $("input#confirmPassword")[0].setCustomValidity("");
}

function checkSignUp(e) {
    if (
        $("small#usernameError").text() != "" ||
        $("small#passwordError").text() != "" ||
        $("small#passwordConfirmationError").text() != ""
    ) {
        e.preventDefault();
        return;
    }

    if ($("input#username").val() == "") {
        $("small#usernameError").text("Username can't be empty");
        e.preventDefault();
        return;
    } else {
        $("small#usernameError").text("");
    }

    if ($("input#password").val() == "") {
        $("small#passwordError").text("Password can't be empty");
        e.preventDefault();
        return;
    } else {
        $("small#passwordError").text("");
    }
}
