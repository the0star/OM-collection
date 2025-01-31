const { series, src, dest } = require("gulp");
const nodemon = require("gulp-nodemon");
const terser = require("gulp-terser");
const cleanCSS = require("gulp-clean-css");

function minifyCSS() {
    return src("./public/stylesheets/**/*.css")
        .pipe(cleanCSS({ compatibility: "ie8" }))
        .pipe(dest("./public/dist/css"));
}

function minifyJS() {
    return src("./public/javascripts/**/*.js")
        .pipe(terser())
        .pipe(dest("./public/dist/js"));
}

function devstart(done) {
    const stream = nodemon({
        script: "./bin/www",
        ext: "pug js css",
        ignore: ["public/dist/*", "gulpfile.js"],
        tasks: ["minify"],
        done: done,
    });

    stream
        .on("restart", function () {
            console.log("\n\nRestarted!\n\n");
        })
        .on("crash", function () {
            console.error("\n\nApplication has crashed!\n\n");
        });
}

exports.minify = series(minifyJS, minifyCSS);
exports.devstart = series(minifyJS, minifyCSS, devstart);
exports.default = exports.minify;
