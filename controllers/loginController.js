require("dotenv").config();

const Sentry = require("@sentry/node");
const createError = require("http-errors");

const bcrypt = require("bcrypt");
const cryptoRandomString = require("crypto-random-string");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { body, validationResult } = require("express-validator");

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: "api", key: process.env.API_KEY });

// TODO: fix structure
const Codes = require("../models/verificationCodes.js");
const Users = require("../models/users.js");
const userService = require("../services/userService");

const blacklist = [
    "card",
    "user",
    "cards",
    "login",
    "logout",
    "signup",
    "collection",
    "image",
    "images",
    "character",
    "characters",
    "rankings",
    "surpriseguest",
    "userpage",
    "calculator",
];

// Helper
function getUserSessionData(user) {
    return {
        name: user.info.name,
        isEmailVerified: user.info.email ? true : false,
        supportStatus: user.info.supportStatus,
        id: user.id,
        // TODO: fix structure. Choose one or the other: user.info.type === "Admin" or user.isAdmin
        type: user.info.type,
        isAdmin: user.info.type === "Admin",
        isSupporter: user.info.supportStatus.some(
            (badge) => badge.name === "adfree"
        ),
    };
}

// Render pages
exports.getLoginPage = function (req, res) {
    return res.render("login", {
        title: req.i18n.t("common.login"),
        message: req.flash("message"),
        user: req.user,
    });
};

exports.getSignupPage = function (req, res) {
    res.render("signup", {
        title: req.i18n.t("common.signup"),
        user: req.user,
    });
};

/** */

exports.authenticate = passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
});

exports.login = async function (req, res) {
    if (req.user) {
        try {
            const user = await Users.findById(req.user.id);
            if (!user) {
                console.error(
                    "User not found after successful authentication!"
                );
                req.flash("message", "An error occurred during login.");
                return res.redirect("/login");
            }

            user.info.lastLogin = new Date();
            await user.save();
            return res.redirect("/");
        } catch (err) {
            console.error("Error updating lastLogin or finding user:", err);
            req.flash("message", "An error occurred during login.");
            return res.redirect("/login");
        }
    } else {
        console.error("req.user is undefined after authentication!");
        req.flash("message", "An error occurred during login.");
        return res.redirect("/login");
    }
};

exports.logout = function (req, res, next) {
    req.logout(function (err) {
        if (err) {
            console.error("req.logout Error: ", err);
            return next(err);
        }
        req.session.destroy(function (err) {
            if (err) {
                console.error("req.session.destroy Error: ", err);
                return next(err);
            }
            req.user = null;
            res.clearCookie("connect.sid");
            res.redirect("/");
        });
    });
};

exports.validateSignupInput = async (req, res, next) => {
    const validations = [
        body("username")
            .notEmpty()
            .withMessage("Username can't be empty")
            .matches(/^[A-Za-z0-9._-]+$/)
            .withMessage("Username contains invalid characters"),
        body("password")
            .isLength({ min: 8 })
            .matches(/^[0-9a-zA-Z!@#$%^]+$/)
            .withMessage("Password contains invalid characters"),
        body("username").escape(),
        body("password").escape(),
    ];

    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    return res.render("signup", {
        title: "Signup",
        user: req.user,
        message: errors.array()[0].msg,
    });
};

exports.signup = async (req, res, next) => {
    if (blacklist.includes(req.body.username.toLowerCase())) {
        return res.render("signup", {
            title: "Signup",
            user: req.user,
            message: "Username unavailable",
        });
    }
    try {
        var exists = await userService.getUser(req.body.username);
    } catch (e) {
        return next(e);
    }

    if (exists) {
        req.flash("message", "Username taken");
        res.render("signup", { title: "Signup", user: req.user });
    } else {
        bcrypt.genSalt(
            Number.parseInt(process.env.SALT_ROUNDS),
            (err, salt) => {
                if (err) return next(err);
                bcrypt.hash(req.body.password, salt, function (err, hash) {
                    if (err) return next(err);
                    var user = new Users({
                        info: {
                            name: req.body.username,
                            password: hash,
                            type: "User",
                        },
                    });
                    user.save(function (err) {
                        if (err) return next(err);
                        req.login(user, function (err) {
                            if (err) return next(err);
                            res.redirect("/");
                        });
                    });
                });
            }
        );
    }
};

exports.signupCheckUsername = async function (req, res) {
    if (blacklist.includes(req.body.username.toLowerCase())) {
        return res.send(true);
    }
    try {
        var exists = await userService.getUser(req.body.username);
    } catch (e) {
        console.error(e);
        return res.send("error");
    }

    if (!exists) {
        return res.send(false);
    }
    res.send(true);
};

// User checks
exports.isLoggedIn = function () {
    return function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash("message", "You must be logged in");
        res.redirect("/login");
    };
};

exports.hasAccess = function (role) {
    return function (req, res, next) {
        var access = { User: 0, Moderator: 1, Admin: 2 };
        if (req.user && access[req.user.type] >= access[role]) return next();
        return next(createError(404));
    };
};

exports.isSameUser = function () {
    return function (req, res, next) {
        if (
            req.user &&
            (req.user.name == req.params.name || exports.hasAccess("Admin"))
        ) {
            return next();
        }
        res.redirect("/login");
    };
};

exports.canEdit = function (type = "regular") {
    return function (req, res, next) {
        if (
            !req.user ||
            req.user.supportStatus.some(
                (badge) => badge.name === "bannedFromMakingSuggestions"
            ) ||
            (type === "trusted" &&
                req.user.type !== "Admin" &&
                !req.user.supportStatus.some(
                    (badge) => badge.name === "trustedContributor"
                ))
        ) {
            return next(
                createError(
                    401,
                    (properties = {
                        errorMessage: "Please log in to access this page.",
                    })
                )
            );
        }
        return next();
    };
};

// Management
exports.sendVerificationEmail = async function (req, res, next) {
    try {
        var userWithEmail = await Users.findOne({
            "info.email": req.body.userData.email,
        });
        if (userWithEmail) {
            throw "Email taken";
        }

        var user = await Users.findOne({ "info.name": req.params.name });
        if (!user) {
            throw "User not found";
        }

        var correctPassword = await bcrypt.compare(
            req.body.userData.password,
            user.info.password
        );
        if (!correctPassword) {
            throw "Wrong password";
        }

        await Codes.deleteMany({ user: req.params.name });

        var code = cryptoRandomString({ length: 128, type: "url-safe" });
        var record = new Codes({
            user: req.params.name,
            email: req.body.userData.email,
            code: code,
        });

        await record.save();

        await mg.messages.create("karasu-os.com", {
            to: [req.body.userData.email],
            from: "Karasu OS <no-reply@karasu-os.com>",
            subject:
                req.i18n.t("settings.email_confirmation") + " - Karasu-OS.com",
            template: req.i18n.t("settings.email_template"),
            "h:X-Mailgun-Variables": JSON.stringify({
                username: req.params.name,
                code: code,
            }),
        });

        return res.json({ err: false });
    } catch (e) {
        const knownErr = [
            "Email taken",
            "User not found",
            "Wrong password",
            "Username contains invalid characters",
        ];
        if (!knownErr.includes(e)) {
            Sentry.captureException(e);
        }

        return res.json({ err: true, message: e });
    }
};

exports.verifyEmail = function (req, res, next) {
    Codes.findOneAndDelete(
        { user: req.params.name, code: req.params.code },
        (err, record) => {
            if (err) {
                return next(err);
            }
            if (!record) {
                return next(
                    createError(
                        404,
                        (properties = { errorMessage: "Invalid link." })
                    )
                );
            }
            var setEmail = Users.updateOne(
                { "info.name": req.user.name },
                { "info.email": record.email },
                (err) => {
                    if (err) {
                        return next(err);
                    }
                    res.redirect("/user");
                }
            );
        }
    );
};

exports.changePassword = function (req, res, next) {
    Users.findOne({ "info.name": req.params.name }, function (err, user) {
        if (err) {
            return res.json({ err: true, message: err.message });
        }
        if (!user) {
            var err = new Error("User not found");
            return res.json({ err: true, message: err.message });
        }
        bcrypt.compare(
            req.body.passwordData.old,
            user.info.password,
            function (err, result) {
                if (err) {
                    return res.json({ err: true, message: err.message });
                }
                if (!result) {
                    var err = new Error("Wrong password");
                    return res.json({ err: true, message: err.message });
                }
                bcrypt.genSalt(
                    Number.parseInt(process.env.SALT_ROUNDS),
                    (err, salt) => {
                        if (err) {
                            return res.json({
                                err: true,
                                message: err.message,
                            });
                        }
                        bcrypt.hash(
                            req.body.passwordData.new,
                            salt,
                            function (err, hash) {
                                if (err) {
                                    return res.json({
                                        err: true,
                                        message: err.message,
                                    });
                                }
                                var setPassword = Users.updateOne(
                                    { "info.name": req.params.name },
                                    { "info.password": hash },
                                    (err) => {
                                        if (err) {
                                            return res.json({
                                                err: true,
                                                message: err.message,
                                            });
                                        }
                                        return res.json({ err: false });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
};

exports.restorePassword = function (req, res, next) {
    Users.findOne({ "info.email": req.body.email }, async function (err, user) {
        if (err) {
            return res.json({ err: true, message: err.message });
        }
        if (!user) {
            var err = new Error("No account linked to this email");
            return res.json({ err: true, message: err.message });
        }
        var newPassword = cryptoRandomString({
            length: 8,
            type: "alphanumeric",
        });

        mg.messages
            .create("karasu-os.com", {
                to: [req.body.email],
                from: "Karasu OS <no-reply@karasu-os.com>",
                subject: "Restore password",
                text: `${req.i18n.t("user.username")}: ${user.info.name}\n${req.i18n.t(
                    "user.password"
                )}: ${newPassword}`,
            })
            .then((result) => {
                bcrypt.genSalt(
                    Number.parseInt(process.env.SALT_ROUNDS),
                    (err, salt) => {
                        if (err) {
                            return res.json({
                                err: true,
                                message: err.message,
                            });
                        }
                        bcrypt.hash(newPassword, salt, function (err, hash) {
                            if (err) {
                                return res.json({
                                    err: true,
                                    message: err.message,
                                });
                            }
                            var setPassword = Users.updateOne(
                                { "info.name": user.info.name },
                                { "info.password": hash },
                                (err) => {
                                    if (err) {
                                        return res.json({
                                            err: true,
                                            message: err.message,
                                        });
                                    }
                                    return res.json({ err: false });
                                }
                            );
                        });
                    }
                );
            })
            .catch((err) => {
                return res.json({ err: true, message: err.message });
            });
    });
};

// Authentication
passport.use(
    new LocalStrategy({ passReqToCallback: true }, async function (
        req,
        username,
        password,
        next
    ) {
        const user = await Users.findOne({
            "info.name": { $regex: new RegExp("^" + username + "$", "i") },
        });
        if (!user)
            return next(null, false, req.flash("message", "User not found"));

        const validPassword = await bcrypt.compare(
            password,
            user.info.password
        );
        if (validPassword === false)
            return next(null, false, req.flash("message", "Wrong password"));

        const userInfo = getUserSessionData(user);
        return next(null, userInfo);
    })
);

passport.serializeUser(function (user, next) {
    process.nextTick(function () {
        next(null, user.id);
    });
});

passport.deserializeUser(function (id, next) {
    process.nextTick(function () {
        Users.findById(id, function (err, user) {
            if (err) {
                console.error(err);
                return next(null, false);
            }
            if (!user) return next(null, false);
            const userInfo = getUserSessionData(user);
            return next(null, userInfo);
        });
    });
});
