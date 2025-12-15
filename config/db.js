const mongoose = require("mongoose");

let conn = null;

const uri = process.env.URI;

exports.connect = async function () {
    if (conn == null) {
        mongoose.set("strictQuery", true);
        conn = mongoose
            .connect(uri, {
                // serverSelectionTimeoutMS: 5000,
            })
            .then(() => mongoose);
        await conn;
    }
    return conn;
};
