"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = __importDefault(require("chalk"));
var isArray_1 = __importDefault(require("lodash/isArray"));
var isEmpty_1 = __importDefault(require("lodash/isEmpty"));
var isObject_1 = __importDefault(require("lodash/isObject"));
var winston_1 = __importDefault(require("winston"));
var env_1 = __importDefault(require("@server/env"));
var Metrics_1 = __importDefault(require("@server/logging/Metrics"));
var sentry_1 = __importDefault(require("@server/logging/sentry"));
var ShutdownHelper_1 = __importDefault(require("@server/utils/ShutdownHelper"));
var Tracing = __importStar(require("./tracer"));
var Logger = /** @class */ (function () {
    function Logger() {
        var _this = this;
        /**
         * Sanitize data attached to logs and errors to remove sensitive information.
         *
         * @param input The data to sanitize
         * @returns The sanitized data
         */
        this.sanitize = function (input, level) {
            if (level === void 0) { level = 0; }
            // Short circuit if we're not in production to enable easier debugging
            if (!env_1.default.isProduction) {
                return input;
            }
            var sensitiveFields = [
                "accessToken",
                "refreshToken",
                "token",
                "password",
                "content",
            ];
            if (level > 3) {
                return "[…]";
            }
            if ((0, isArray_1.default)(input)) {
                return input.map(function (item) { return _this.sanitize(item, level + 1); });
            }
            if ((0, isObject_1.default)(input)) {
                var output = __assign({}, input);
                for (var _i = 0, _a = Object.keys(output); _i < _a.length; _i++) {
                    var key = _a[_i];
                    if ((0, isObject_1.default)(output[key])) {
                        output[key] = _this.sanitize(output[key], level + 1);
                    }
                    else if ((0, isArray_1.default)(output[key])) {
                        output[key] = output[key].map(function (value) {
                            return _this.sanitize(value, level + 1);
                        });
                    }
                    else if (sensitiveFields.includes(key)) {
                        output[key] = "[Filtered]";
                    }
                    else {
                        output[key] = _this.sanitize(output[key], level + 1);
                    }
                }
                return output;
            }
            return input;
        };
        this.output = winston_1.default.createLogger({
            // The check for log level validity is here in addition to the ENV validation
            // as entering an incorrect LOG_LEVEL in env could otherwise prevent the
            // related error message from being displayed.
            level: [
                "error",
                "warn",
                "info",
                "http",
                "verbose",
                "debug",
                "silly",
            ].includes(env_1.default.LOG_LEVEL)
                ? env_1.default.LOG_LEVEL
                : "info",
        });
        this.output.add(new winston_1.default.transports.Console({
            format: env_1.default.isProduction
                ? winston_1.default.format.json()
                : winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(function (_a) {
                    var message = _a.message, level = _a.level, label = _a.label, extra = __rest(_a, ["message", "level", "label"]);
                    return "".concat(level, ": ").concat(label ? chalk_1.default.bold("[" + label + "] ") : "").concat(message, " ").concat((0, isEmpty_1.default)(extra) ? "" : JSON.stringify(extra));
                })),
        }));
        if (env_1.default.DEBUG &&
            env_1.default.DEBUG !== "http" &&
            !["silly", "debug"].includes(env_1.default.LOG_LEVEL)) {
            this.warn("\"DEBUG\" set in configuration but the \"LOG_LEVEL\" configuration is filtering debug messages. To see all logging, set \"LOG_LEVEL\" to \"debug\".");
        }
    }
    /**
     * Log information
     *
     * @param category A log message category that will be prepended
     * @param extra Arbitrary data to be logged that will appear in prod logs
     */
    Logger.prototype.info = function (label, message, extra) {
        this.output.info(message, __assign(__assign({}, this.sanitize(extra)), { label: label }));
    };
    /**
     * Debug information
     *
     * @param category A log message category that will be prepended
     * @param extra Arbitrary data to be logged that will appear in development logs
     */
    Logger.prototype.debug = function (label, message, extra) {
        this.output.debug(message, __assign(__assign({}, this.sanitize(extra)), { label: label }));
    };
    /**
     * Detailed information – for very detailed logs, more detailed than debug. "silly" is the
     * lowest priority npm log level.
     *
     * @param category A log message category that will be prepended
     * @param extra Arbitrary data to be logged that will appear in verbose logs
     */
    Logger.prototype.silly = function (label, message, extra) {
        this.output.silly(message, __assign(__assign({}, this.sanitize(extra)), { label: label }));
    };
    /**
     * Log a warning
     *
     * @param message A warning message
     * @param extra Arbitrary data to be logged that will appear in prod logs
     */
    Logger.prototype.warn = function (message, extra) {
        var _this = this;
        Metrics_1.default.increment("logger.warning");
        if (env_1.default.SENTRY_DSN) {
            sentry_1.default.withScope(function (scope) {
                scope.setLevel("warning");
                for (var key in extra) {
                    scope.setExtra(key, _this.sanitize(extra[key]));
                }
                sentry_1.default.captureMessage(message);
            });
        }
        if (env_1.default.isProduction) {
            this.output.warn(message, this.sanitize(extra));
        }
        else if (extra) {
            console.warn(message, extra);
        }
        else {
            console.warn(message);
        }
    };
    /**
     * Report a runtime error
     *
     * @param message A description of the error
     * @param error The error that occurred
     * @param extra Arbitrary data to be logged that will appear in prod logs
     * @param request An optional request object to attach to the error
     */
    Logger.prototype.error = function (message, error, extra, request) {
        var _this = this;
        Metrics_1.default.increment("logger.error", {
            name: error.name,
        });
        Tracing.setError(error);
        if (env_1.default.SENTRY_DSN) {
            sentry_1.default.withScope(function (scope) {
                scope.setLevel("error");
                for (var key in extra) {
                    scope.setExtra(key, _this.sanitize(extra[key]));
                }
                if (request) {
                    scope.addEventProcessor(function (event) {
                        return sentry_1.default.Handlers.parseRequest(event, request);
                    });
                }
                sentry_1.default.captureException(error);
            });
        }
        if (env_1.default.isProduction) {
            this.output.error(message, {
                error: error.message,
                stack: error.stack,
            });
        }
        else {
            console.error(message);
            console.error(error);
            if (extra) {
                console.error(extra);
            }
        }
    };
    /**
     * Report a fatal error and shut down the server
     *
     * @param message A description of the error
     * @param error The error that occurred
     * @param extra Arbitrary data to be logged that will appear in prod logs
     */
    Logger.prototype.fatal = function (message, error, extra) {
        this.error(message, error, extra);
        void ShutdownHelper_1.default.execute();
    };
    return Logger;
}());
exports.default = new Logger();
