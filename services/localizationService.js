const i18next = require("i18next");
const i18nextMiddleware = require("i18next-http-middleware");
const Backend = require("i18next-fs-backend");

const languages = ["en", "ja", "zh"];
const defaultLanguage = "en";

exports.getLocalizationMiddleware = function (isDebug) {
	const detectorName = "subdomain";

	let languageDetector = new i18nextMiddleware.LanguageDetector();
	languageDetector.addDetector({
		name: detectorName,
		lookup: function (req, res, options) {
			let subdomain = options.getHeaders(req).host.split(".")[0];
			if (languages.includes(subdomain)) {
				return subdomain;
			}
			return defaultLanguage;
		}
	});

	i18next
		.use(languageDetector)
		.use(Backend)
		.init({
			debug: isDebug,
			backend: {
				loadPath: __dirname + "/../locales/{{lng}}/{{ns}}.json",
				addPath: __dirname + "/../locales/{{lng}}/{{ns}}.missing.json"
			},
			fallbackLng: defaultLanguage,
			preload: languages,
			// saveMissing: true,
			detection: { order: [detectorName] }
		});

	return i18nextMiddleware.handle(i18next);
}
