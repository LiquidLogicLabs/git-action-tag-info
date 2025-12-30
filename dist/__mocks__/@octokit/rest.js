"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Octokit = void 0;
// Mock for @octokit/rest - not used in tests since github-client is mocked
const Octokit = class {
    constructor() { }
    static plugin() {
        return this;
    }
};
exports.Octokit = Octokit;
//# sourceMappingURL=rest.js.map