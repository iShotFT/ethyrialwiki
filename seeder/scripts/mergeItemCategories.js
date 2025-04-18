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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
/**
 * Merges item data from a source JSON file into a target JSON file
 * Items in the source file will overwrite corresponding items in the target file
 * New items in the target file that don't exist in the source will be preserved
 */
function mergeItemCategories(sourceFilePath, targetFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var sourceContent, targetContent, sourceData, targetData, sourceItemsMap, _i, _a, category, _b, _c, item, rarityMap, _d, _e, rarity, i, rarity, itemsUpdated, itemsPreserved, _f, _g, targetCategory, updatedItems, _h, _j, targetItem, sourceItem, resourceCount, mergedItem, backupPath;
        return __generator(this, function (_k) {
            console.log("Starting item category merge...");
            console.log("Source: ".concat(sourceFilePath));
            console.log("Target: ".concat(targetFilePath));
            try {
                sourceContent = fs_1.default.readFileSync(sourceFilePath, "utf-8");
                targetContent = fs_1.default.readFileSync(targetFilePath, "utf-8");
                sourceData = JSON.parse(sourceContent);
                targetData = JSON.parse(targetContent);
                // Validate the JSON structures
                if (!sourceData.rarities || !Array.isArray(sourceData.rarities)) {
                    throw new Error('Invalid source JSON: missing or invalid rarities array');
                }
                if (!sourceData.categories || !Array.isArray(sourceData.categories)) {
                    throw new Error('Invalid source JSON: missing or invalid categories array');
                }
                if (!targetData.rarities || !Array.isArray(targetData.rarities)) {
                    throw new Error('Invalid target JSON: missing or invalid rarities array');
                }
                if (!targetData.categories || !Array.isArray(targetData.categories)) {
                    throw new Error('Invalid target JSON: missing or invalid categories array');
                }
                console.log("Source contains ".concat(sourceData.categories.length, " categories and ").concat(sourceData.categories.reduce(function (total, cat) { return total + cat.items.length; }, 0), " items"));
                console.log("Target contains ".concat(targetData.categories.length, " categories and ").concat(targetData.categories.reduce(function (total, cat) { return total + cat.items.length; }, 0), " items"));
                sourceItemsMap = new Map();
                // Populate the lookup map
                for (_i = 0, _a = sourceData.categories; _i < _a.length; _i++) {
                    category = _a[_i];
                    for (_b = 0, _c = category.items; _b < _c.length; _b++) {
                        item = _c[_b];
                        sourceItemsMap.set(item.slug, item);
                    }
                }
                console.log("Created lookup map with ".concat(sourceItemsMap.size, " source items"));
                rarityMap = new Map();
                for (_d = 0, _e = sourceData.rarities; _d < _e.length; _d++) {
                    rarity = _e[_d];
                    rarityMap.set(rarity.slug, rarity);
                }
                // Update target rarities if they exist in source
                for (i = 0; i < targetData.rarities.length; i++) {
                    rarity = targetData.rarities[i];
                    if (rarityMap.has(rarity.slug)) {
                        targetData.rarities[i] = rarityMap.get(rarity.slug);
                    }
                }
                itemsUpdated = 0;
                itemsPreserved = 0;
                // For each category in the target data
                for (_f = 0, _g = targetData.categories; _f < _g.length; _f++) {
                    targetCategory = _g[_f];
                    updatedItems = [];
                    // For each item in this category
                    for (_h = 0, _j = targetCategory.items; _h < _j.length; _h++) {
                        targetItem = _j[_h];
                        // Check if this item exists in the source data
                        if (sourceItemsMap.has(targetItem.slug)) {
                            sourceItem = sourceItemsMap.get(targetItem.slug);
                            resourceCount = targetItem.resourceCount;
                            mergedItem = __assign(__assign(__assign({}, targetItem), sourceItem), { resourceCount: resourceCount // Always keep the original resourceCount
                             });
                            updatedItems.push(mergedItem);
                            itemsUpdated++;
                        }
                        else {
                            // Keep the original item
                            updatedItems.push(targetItem);
                            itemsPreserved++;
                        }
                    }
                    // Update the items in this category
                    targetCategory.items = updatedItems;
                    // Recalculate totals for this category
                    targetCategory.totalItems = updatedItems.length;
                    targetCategory.totalResources = updatedItems.reduce(function (sum, item) { return sum + item.resourceCount; }, 0);
                }
                backupPath = targetFilePath + '.backup';
                console.log("Creating backup of original target file to ".concat(backupPath));
                fs_1.default.copyFileSync(targetFilePath, backupPath);
                console.log("Writing merged data to ".concat(targetFilePath));
                fs_1.default.writeFileSync(targetFilePath, JSON.stringify(targetData, null, 2));
                console.log("Merge completed successfully:");
                console.log("- Updated ".concat(itemsUpdated, " items with source data"));
                console.log("- Preserved ".concat(itemsPreserved, " items only in target"));
                console.log("- Total items in result: ".concat(itemsUpdated + itemsPreserved));
            }
            catch (error) {
                console.error("Error merging item categories:", error);
                throw error;
            }
            return [2 /*return*/];
        });
    });
}
// Determine file paths
var targetPath = process.argv[2] || path_1.default.resolve(process.cwd(), "seeder", "output", "item-categories.json");
var sourcePath = process.argv[3] || path_1.default.resolve(process.cwd(), "seeder", "output", "item-categories_one.json");
// Verify both files exist
if (!fs_1.default.existsSync(targetPath)) {
    console.error("Error: Target file not found at path: ".concat(targetPath));
    process.exit(1);
}
if (!fs_1.default.existsSync(sourcePath)) {
    console.error("Error: Source file not found at path: ".concat(sourcePath));
    process.exit(1);
}
// Run the merge function
mergeItemCategories(sourcePath, targetPath)
    .then(function () {
    console.log("Script completed successfully");
    process.exit(0);
})
    .catch(function (error) {
    console.error("Script failed:", error);
    process.exit(1);
});
