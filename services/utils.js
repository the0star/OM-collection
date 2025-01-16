// adds support for async middleware
const express = require("express");

const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};

(function () {
    var proxied = express.Router.get;
    express.Router.get = function (path, ...handlers) {
        let args = handlers.map((fn) => asyncHandler(fn));
        return proxied.apply(this, [path, args]);
    };
})();

(function () {
    var proxied = express.Router.post;
    express.Router.post = function (path, ...handlers) {
        let args = handlers.map((fn) => asyncHandler(fn));
        return proxied.apply(this, [path, args]);
    };
})();
