"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTags = addTags;
exports.getRootSpanFromRequestContext = getRootSpanFromRequestContext;
exports.setResource = setResource;
exports.setError = setError;
var dd_trace_1 = __importDefault(require("dd-trace"));
var env_1 = __importDefault(require("@server/env"));
// If the DataDog agent is installed and the DD_API_KEY environment variable is
// in the environment then we can safely attempt to start the DD tracer
if (env_1.default.DD_API_KEY) {
    dd_trace_1.default.init({
        version: env_1.default.VERSION,
        service: env_1.default.DD_SERVICE,
        env: env_1.default.ENVIRONMENT,
        logInjection: true,
    });
}
var getCurrentSpan = function () { return dd_trace_1.default.scope().active(); };
/**
 * Add tags to a span to have more context about how and why it was running.
 * If added to the root span, tags are searchable and filterable.
 *
 * @param tags An object with the tags to add to the span
 * @param span An optional span object to add the tags to. If none provided,the current span will be used.
 */
function addTags(tags, span) {
    if (dd_trace_1.default) {
        var currentSpan = span || getCurrentSpan();
        if (!currentSpan) {
            return;
        }
        currentSpan.addTags(tags);
    }
}
/**
 * The root span is an undocumented internal property that DataDog adds to `context.req`.
 * The root span is required in order to add searchable tags.
 * Unfortunately, there is no API to access the root span directly.
 * See: node_modules/dd-trace/src/plugins/util/web.js
 *
 * @param context A Koa context object
 */
function getRootSpanFromRequestContext(context) {
    var _a, _b, _c;
    // eslint-disable-next-line no-undef
    return (_c = (_b = (_a = context === null || context === void 0 ? void 0 : context.req) === null || _a === void 0 ? void 0 : _a._datadog) === null || _b === void 0 ? void 0 : _b.span) !== null && _c !== void 0 ? _c : null;
}
/**
 * Change the resource of the active APM span. This method wraps addTags to allow
 * safe use in environments where APM is disabled.
 *
 * @param name The name of the resource
 */
function setResource(name) {
    if (dd_trace_1.default) {
        addTags({
            "resource.name": "".concat(name),
        });
    }
}
/**
 * Mark the current active span as an error. This method wraps addTags to allow
 * safe use in environments where APM is disabled.
 *
 * @param error The error to add to the current span
 */
function setError(error, span) {
    if (dd_trace_1.default) {
        addTags({
            errorMessage: error.message,
            "error.type": error.name,
            "error.msg": error.message,
            "error.stack": error.stack,
        }, span);
    }
}
exports.default = dd_trace_1.default;
