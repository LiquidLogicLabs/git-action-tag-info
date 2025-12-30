// Mock for @octokit/rest - not used in tests since github-client is mocked
export const Octokit = class {
  constructor() {}
  static plugin() {
    return this;
  }
};
