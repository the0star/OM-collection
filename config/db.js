const mongoose = require("mongoose");

let conn = null;
const uri = process.env.URI;

function setupConnectionListeners() {
    mongoose.connection.on("connected", () => {
        console.log("MongoDB lifecycle: Connection established successfully.");
    });

    mongoose.connection.on("error", (err) => {
        console.error(`MongoDB lifecycle error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("MongoDB lifecycle: Disconnected.");
    });
}

exports.connect = async function () {
    if (conn !== null) {
        return conn;
    }

    if (!uri) {
        throw new Error("MongoDB URI is missing from environment variables.");
    }

    mongoose.set("strictQuery", true);
    setupConnectionListeners();

    try {
        conn = await mongoose.connect(uri, {
            // serverSelectionTimeoutMS: 5000,
        });
        return conn;
    } catch (err) {
        conn = null;
        console.error("MongoDB connection attempt failed:", err);
        throw err;
    }
};

exports.disconnect = async function () {
    if (conn === null) {
        return;
    }
    await mongoose.disconnect();
    conn = null;
    console.log("MongoDB lifecycle: Connection closed cleanly.");
};
