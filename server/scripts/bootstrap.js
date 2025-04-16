"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config({
        silent: true,
    });
}
require("../storage/database");
require("../storage/redis");
