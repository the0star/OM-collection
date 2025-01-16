const { series, src, dest } = require("gulp");
const nodemon = require("gulp-nodemon");
const terser = require("gulp-terser");

function minify() {
    return src("./public/javascripts/*.js")
        .pipe(terser())
        .pipe(dest("./public/dist/js"));
}

function devstart(done) {
    const stream = nodemon({
        script: "./bin/www",
        ext: "pug js",
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

exports.minify = minify;
exports.devstart = devstart;
exports.default = series(minify, devstart);
