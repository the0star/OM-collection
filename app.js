require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const createError = require("http-errors");
const cookieParser = require("cookie-parser");
const Sentry = require("@sentry/node");
const logger = require("morgan");
const helmet = require("helmet");
const passport = require("passport");
const compression = require("compression");
const flash = require("connect-flash");
const bodyParser = require("body-parser");

const db = require("./config/db");
const limiter = require("./config/redis-limiter");

const indexRouter = require("./routes/index");
const cardsRouter = require("./routes/cards");
const userRouter = require("./routes/user");
const eventsRouter = require("./routes/events");
const suggestionRouter = require("./routes/suggestions");
const askKarasuRouter = require("./routes/askKarasu");

const localizationService = require("./services/localizationService");

Sentry.init({ environment: process.env.NODE_ENV, dsn: process.env.SENTRY });

const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "pug");

db.connect()
    .then(() => console.log("MongoDB connected"))
    .catch((err) => {
        console.error("MongoDB connection failed", err);
    });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(compression());
app.use(logger(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.static(__dirname + "/public"));

app.set("trust proxy", 1);
app.use(
    session({
        store: MongoStore.create({
            mongoUrl: process.env.URI,
            touchAfter: 24 * 3600,
        }),
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 90,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(limiter);
app.use(localizationService.getLocalizationMiddleware(false));
app.use(flash());

app.use((req, res, next) => {
    res.locals.cookies = req.cookies;
    next();
});

app.use("/", indexRouter);
app.use("/card", cardsRouter);
app.use("/user", userRouter);
app.use("/event", eventsRouter);
app.use("/suggestion", suggestionRouter);
app.use("/ask", askKarasuRouter);

app.use((req, res, next) =>
    next(createError(404, { title: "Page not found" }))
);

Sentry.setupExpressErrorHandler(app);

app.use(function (err, req, res, next) {
    let ignoredErrors = [401, 404];
    if (!ignoredErrors.includes(err.status)) {
        console.error(err);
        if (req.app.get("env") === "production") {
            Sentry.captureException(err);
        }
    }

    let errorTitle = err.title || "Something went wrong";
    let errorMessage =
        err.errorMessage ||
        "Oops, looks like you found our error page. Double check the link, maybe?";

    if (
        req.is("application/*") ||
        (req.headers["content-type"] &&
            req.headers["content-type"].includes("application/json"))
    ) {
        res.json({ err: true, message: errorTitle });
    } else {
        res.status(err.status || 500);
        res.locals.error = errorTitle;
        res.locals.message = errorMessage;
        res.render("error", { title: "Error", user: req.user });
    }
});

module.exports = app;
