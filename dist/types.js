"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagType = exports.ItemType = exports.Platform = void 0;
/**
 * Supported Git hosting platforms
 */
var Platform;
(function (Platform) {
    Platform["GITHUB"] = "github";
    Platform["GITEA"] = "gitea";
    Platform["BITBUCKET"] = "bitbucket";
})(Platform || (exports.Platform = Platform = {}));
/**
 * Item type enumeration
 */
var ItemType;
(function (ItemType) {
    ItemType["COMMIT"] = "commit";
    ItemType["TAG"] = "tag";
    ItemType["RELEASE"] = "release";
})(ItemType || (exports.ItemType = ItemType = {}));
/**
 * Tag type enumeration (deprecated - use ItemType)
 * @deprecated Use ItemType instead. TagType.COMMIT maps to ItemType.COMMIT, TagType.ANNOTATED maps to ItemType.TAG.
 */
var TagType;
(function (TagType) {
    TagType["COMMIT"] = "commit";
    TagType["ANNOTATED"] = "annotated";
})(TagType || (exports.TagType = TagType = {}));
//# sourceMappingURL=types.js.map