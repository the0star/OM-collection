const Sentry = require("@sentry/node");
const async = require("async");
const fs = require("fs");
const path = require("path");

exports.saveImage = async function (baseImage, oldName, newName, imagePath) {
    if (!baseImage) {
        return renameImage(imagePath, oldName, newName);
    }

    var extension = baseImage.substring(
        baseImage.indexOf("/") + 1,
        baseImage.indexOf(";base64")
    );

    if (oldName === newName || !oldName) {
        return writeImage(baseImage, imagePath, newName, extension);
    } else {
        var deletePromise = await exports.deleteImage(imagePath, oldName);
        var writePromise = writeImage(baseImage, imagePath, newName, extension);
        return Promise.all([deletePromise, writePromise]);
    }
};

exports.deleteImage = async function (imagePath, name) {
    var directory = path.join("public/images", imagePath);
    var files = await fs.promises.readdir(directory);
    var image = files.find((file) => file.split(".")[0] === name);
    return new Promise((resolve, reject) => {
        if (!image) {
            resolve();
            return;
        }
        fs.unlink(path.join(directory, image), (err) => {
            if (err) reject(err);
            resolve();
        });
    });
};

function writeImage(baseImage, imagePath, name, extension) {
    const fileType = baseImage.substring(
        "data:".length,
        baseImage.indexOf("/")
    );
    const regex = new RegExp(`^data:${fileType}\/${extension};base64,`, "gi");
    const base64Data = baseImage.replace(regex, "");
    const imageData = new Buffer.from(base64Data, "base64");
    const fullPath =
        path.join("./public/images", imagePath, name) +
        "." +
        extension.replace("jpeg", "jpg");

    return new Promise((resolve, reject) => {
        fs.writeFile(fullPath, imageData, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

async function renameImage(imagePath, oldName, newName) {
    var directory = path.join("public/images", imagePath);
    var files = await fs.promises.readdir(directory);
    var image = files.find((file) => file.replace(/\.[^/.]+$/, "") === oldName);

    if (!image) {
        return Promise.resolve(true);
    }

    var fullPath = path.join(directory, image);
    return new Promise((resolve, reject) => {
        fs.rename(fullPath, fullPath.replace(oldName, newName), (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}
