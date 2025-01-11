require("dotenv").config();

const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo")(session);
const createError = require("http-errors");
const cookieParser = require("cookie-parser");
const Sentry = require("@sentry/node");
const logger = require("morgan");
const helmet = require("helmet");
const passport = require("passport");
const compression = require("compression");
const flash = require("connect-flash");
const bodyParser = require("body-parser");

const indexRouter = require("./routes/index");
const cardsRouter = require("./routes/cards");
const userRouter = require("./routes/user");
const eventsRouter = require("./routes/events");
const suggestionRouter = require("./routes/suggestions");
const askKarasuRouter = require("./routes/askKarasu");

const localizationService = require("./services/localizationService");
const cacheService = require("./services/cacheService");

Sentry.init({ environment: process.env.NODE_ENV, dsn: process.env.SENTRY });

const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "pug");

mongoose.set("strictQuery", true);
mongoose.connect(process.env.URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.Promise = global.Promise;
mongoose.connection.on(
  "error",
  console.error.bind(console, "MongoDB connection error:")
);

Sentry.setupExpressErrorHandler(app);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  logger("dev", { skip: (req, res) => req.app.get("env") !== "production" })
);

app.use(express.static(__dirname + "/public"));

app.use(
  session({
    store: new MongoStore({ url: process.env.URI }),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 90,
      sameSite: "strict",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

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

cacheService.init();

module.exports = app;
