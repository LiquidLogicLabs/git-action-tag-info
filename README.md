# Get Tag Info Action

[![CI](https://github.com/LiquidLogicLabs/git-tag-info-action/actions/workflows/ci.yml/badge.svg)](https://github.com/LiquidLogicLabs/git-tag-info-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

Get tag and release information from local and remote repositories (GitHub, Gitea, Bitbucket). Supports both URL and separate input formats, with "latest" tag/release resolution using semver-first logic.

## Features

- **Multi-platform support**: Works with GitHub, Gitea, and Bitbucket
- **Local repositories**: Query tags from local git repositories
- **Remote repositories**: Query tags and releases via API from remote repositories
- **Tags and Releases**: Support for both git tags and platform releases
- **Flexible input**: Support both URL format and separate inputs
- **Latest resolution**: Automatically resolve "latest" tag or release using semver-first, date fallback strategy
- **Comprehensive info**: Get item SHA, commit SHA, item type, details, and verification status

## Usage

### Basic Usage - Local Repository

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: ./my-repo
```

### GitHub Repository (URL)

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://github.com/owner/repo
    # token is optional - automatically uses GITHUB_TOKEN if not provided
```

Or with a custom token:

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://github.com/owner/repo
    token: ${{ secrets.CUSTOM_TOKEN }}  # Optional: for cross-repo access or higher rate limits
```

### GitHub Repository (Separate Inputs)

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    platform: github
    owner: owner
    repo: repo
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Gitea Repository

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://gitea.example.com/owner/repo
    base_url: https://gitea.example.com
    token: ${{ secrets.GITEA_TOKEN }}
```

### Self-Hosted Gitea with Self-Signed Certificate

```yaml
- name: Get tag info from self-hosted instance
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://git.example.com/owner/repo
    base_url: https://git.example.com
    token: ${{ secrets.GITEA_TOKEN }}
    ignore_cert_errors: true  # Required for self-signed certificates
```

### Bitbucket Repository

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://bitbucket.org/owner/repo
    token: ${{ secrets.BITBUCKET_TOKEN }}
```

### Get Latest Tag

```yaml
- name: Get latest tag
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use latest tag
  run: echo "Latest tag is ${{ steps.tag-info.outputs.name }}"
```

### Get Latest Tag with Format Filtering

Filter tags by format pattern when resolving "latest". This is useful when repositories have multiple tag formats (e.g., version tags like `3.23` and edge tags like `edge-e9613ab3-ls213`):

```yaml
- name: Get latest version tag
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/linuxserver/docker-baseimage-alpine
    tag_format: X.X  # Finds latest tag like "3.23" instead of "edge-e9613ab3-ls213"

- name: Use latest version tag
  run: echo "Latest version tag is ${{ steps.tag-info.outputs.name }}"
```

**Format Pattern Types:**

1. **Simple Patterns**: Use `X` as a placeholder for numbers
   - `"X.X"` matches tags like `3.23`, `1.2`, `10.5`
   - `"X.X.X"` matches tags like `1.2.3`, `10.5.0`
   - `"vX.X.X"` matches tags like `v1.2.3`, `v10.5.0`

2. **Wildcard Patterns**: Use `*` as a placeholder for any characters
   - `"*"` matches tags with no dots, like `latest`, `edge`, `dev`
   - `"*.*"` matches tags with one dot, like `3.23`, `abc.def`, `1.2`
   - `"*.*.*"` matches tags with two dots, like `1.2.3`, `abc.def.ghi`
   - `"v*.*.*"` matches tags like `v1.2.3`, `vabc.def.ghi`

3. **Regex Patterns**: For advanced matching, use regex patterns
   - `"^v\\d+\\.\\d+$"` matches tags like `v1.2`, `v10.5`
   - `"^\\d+\\.\\d+\\.\\d+-.*"` matches tags like `1.2.3-alpha`, `2.0.0-beta`

**Matching Behavior:**
- **Full Match**: Pattern must match the entire tag name (e.g., `"3.23"` matches `"3.23"` exactly)
- **Prefix Match**: If full match fails, tries to match the tag prefix (e.g., `"X.X"` matches `"3.23-bae0df8a-ls3"` by extracting `"3.23"`)

**Examples:**

```yaml
# Match tags with format X.X (e.g., 3.23, 1.2)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: X.X

# Match tags with format X.X.X (e.g., 1.2.3, 10.5.0)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: X.X.X

# Match tags with v prefix (e.g., v1.2.3)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: vX.X.X

# Match tags with wildcard pattern *.* (e.g., 3.23, abc.def)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '*.*'  # Matches any two segments separated by a dot

# Match tags with wildcard pattern *.*.* (e.g., 1.2.3, abc.def.ghi)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '*.*.*'  # Matches any three segments separated by dots

# Use regex for advanced patterns
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '^v\\d+\\.\\d+\\.\\d+$'  # Matches v1.2.3, v10.5.0, etc.
```

### Array Support with Fallback Patterns

You can provide multiple format patterns as fallbacks. Patterns are tried in order - if the first pattern matches no tags, the second pattern is tried, and so on. This is useful when repositories have tags in different formats.

**Supported formats:**

- **JSON array string**: `'["*.*.*", "*.*"]'` (from YAML arrays)
- **Comma-separated**: `"*.*.*,*.*"` (simpler syntax)

**Examples:**

```yaml
# Try 3-segment tags first (e.g., 3.19.5), fallback to 2-segment (e.g., 3.19)
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '["*.*.*", "*.*"]'  # JSON array string format

# Same as above, using comma-separated format
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: "*.*.*,*.*"  # Comma-separated format

# Try numeric 3-segment, then 2-segment, then any 2-segment
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '["X.X.X", "X.X", "*.*"]'

# Try v-prefixed tags, then any tags
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '["v*.*.*", "*.*.*", "*.*"]'
```

**Fallback Behavior:**

- Patterns are tried in the order specified
- First pattern that matches at least one tag is used
- If a pattern matches tags, subsequent patterns are not tried
- If no patterns match any tags, the action fails with a clear error message listing all attempted patterns

### Version Pinning

This action supports flexible version pinning to balance stability and updates:

**Major Version** (`@v1`):
- Automatically updates to the latest `v1.x.x` release
- Recommended for most users who want bug fixes and minor updates
- Example: `uses: LiquidLogicLabs/git-tag-info-action@v1`

**Minor Version** (`@v1.0`):
- Automatically updates to the latest `v1.0.x` patch release
- Recommended when you want to stay on a specific minor version
- Example: `uses: LiquidLogicLabs/git-tag-info-action@v1.0`

**Exact Version** (`@v1.0.3`):
- Pins to a specific release
- Recommended for production workflows requiring maximum stability
- Example: `uses: LiquidLogicLabs/git-tag-info-action@v1.0.3`

> **Note**: Major and minor version tags (e.g., `v1`, `v1.0`) are automatically created/updated with each stable release to point to the latest patch version.

### Get Release Information

Query releases from remote repositories. Releases are not supported for local repositories.

```yaml
- name: Get release info
  id: release-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    tag_type: release
    repository: https://github.com/owner/repo
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Display release info
  run: |
    echo "Release: ${{ steps.release-info.outputs.name }}"
    echo "SHA: ${{ steps.release-info.outputs.item_sha }}"
    echo "Draft: ${{ steps.release-info.outputs.is_draft }}"
    echo "Prerelease: ${{ steps.release-info.outputs.is_prerelease }}"
```

### Get Latest Release

```yaml
- name: Get latest release
  id: release-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    tag_type: release
    repository: https://github.com/owner/repo
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use latest release
  run: echo "Latest release is ${{ steps.release-info.outputs.name }}"
```

### Using Outputs

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://github.com/owner/repo

- name: Check if item exists
  if: steps.tag-info.outputs.exists == 'true'
  run: echo "Item exists!"

- name: Display tag info
  run: |
    echo "Name: ${{ steps.tag-info.outputs.name }}"
    echo "SHA: ${{ steps.tag-info.outputs.item_sha }}"
    echo "Commit: ${{ steps.tag-info.outputs.commit_sha }}"
    echo "Type: ${{ steps.tag-info.outputs.item_type }}"
    echo "Details: ${{ steps.tag-info.outputs.details }}"
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `tag_name` | Tag name or "latest" to get the most recent tag | Yes | - |
| `repository` | Repository URL or local path. Auto-detects: URLs (http://, https://, git@) → Remote repository, Paths → Local repository. Examples: `https://github.com/owner/repo`, `./my-repo`, `/path/to/repo` | No | - |
| `platform` | Platform type (github/gitea/bitbucket) for separate input mode | No | - |
| `owner` | Repository owner (for separate input mode) | No | - |
| `repo` | Repository name (for separate input mode) | No | - |
| `base_url` | Custom base URL for self-hosted instances (e.g., https://gitea.example.com) | No | - |
| `token` | Custom Personal Access Token (works for all platforms). If not provided, automatically falls back to `GITHUB_TOKEN` environment variable when available (e.g., in GitHub Actions) | No | - |
| `ignore_cert_errors` | Ignore SSL certificate errors (useful for self-hosted instances with self-signed certificates). **Warning**: This is a security risk and should only be used with trusted self-hosted instances | No | `false` |
| `tag_type` | Type of item to fetch: `"tags"` (git tags) or `"release"` (platform releases). Releases are only supported for remote repositories (not local). Default: `"tags"` | No | `tags` |
| `tag_format` | Format pattern(s) to filter tags/releases when resolving "latest". Supports single pattern (e.g., `"X.X"`), JSON array string (e.g., `'["*.*.*", "*.*"]'`), or comma-separated values (e.g., `"*.*.*,*.*"`). Patterns are tried in order as fallbacks - if first pattern matches no items, second pattern is tried, etc. Only items matching the first successful format pattern will be considered when resolving "latest" | No | - |

## Outputs

| Name | Description |
|------|-------------|
| `exists` | Boolean indicating if item exists |
| `name` | Item name (tag name for tags/releases) |
| `item_sha` | Item SHA (tag SHA for tags/releases) |
| `item_type` | Item type (commit/tag/release) |
| `commit_sha` | Commit SHA |
| `details` | Item details (tag message or release body) |
| `verified` | Whether item is verified (tags only, false for releases) |
| `is_draft` | Whether release is a draft (releases only, false for tags) |
| `is_prerelease` | Whether release is a prerelease (releases only, false for tags) |

## Workflow Examples

### Using Default GITHUB_TOKEN (No Token Input Required)

```yaml
name: Get Tag Info

on:
  push:
    branches: [main]

jobs:
  get-tag:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Get tag info
        id: tag-info
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: latest
          repository: https://github.com/owner/repo
          # No token needed - automatically uses GITHUB_TOKEN

      - name: Display tag
        run: echo "Latest tag: ${{ steps.tag-info.outputs.name }}"
```

### Using Custom Personal Access Token

For cross-repository access or higher rate limits:

```yaml
name: Get Tag Info from External Repo

on:
  workflow_dispatch:

jobs:
  get-tag:
    runs-on: ubuntu-latest
    steps:
      - name: Get tag info from external repository
        id: tag-info
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: latest
          repository: https://github.com/other-org/other-repo
          token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}  # Custom PAT with access to other-org

      - name: Display tag
        run: echo "Latest tag: ${{ steps.tag-info.outputs.name }}"
```

### Using Custom Token for Private Repositories

```yaml
name: Get Tag from Private Repo

on:
  workflow_dispatch:

jobs:
  get-tag:
    runs-on: ubuntu-latest
    steps:
      - name: Get tag info from private repository
        id: tag-info
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: v1.0.0
          repository: https://github.com/private-org/private-repo
          token: ${{ secrets.PRIVATE_REPO_TOKEN }}  # Token with access to private repo

      - name: Use tag info
        run: |
          echo "Tag: ${{ steps.tag-info.outputs.name }}"
          echo "SHA: ${{ steps.tag-info.outputs.item_sha }}"
```

### Complete Workflow with Multiple Token Scenarios

```yaml
name: Multi-Repository Tag Check

on:
  workflow_dispatch:

jobs:
  check-tags:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # Current repo - uses default GITHUB_TOKEN
      - name: Get tag from current repo
        id: current-repo
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: latest
          # No token - uses GITHUB_TOKEN automatically

      # External public repo - uses default GITHUB_TOKEN
      - name: Get tag from external public repo
        id: external-public
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: latest
          repository: https://github.com/actions/checkout
          # No token needed for public repos

      # External private repo - requires custom token
      - name: Get tag from external private repo
        id: external-private
        uses: LiquidLogicLabs/git-tag-info-action@v1
        with:
          tag_name: latest
          repository: https://github.com/private-org/private-repo
          token: ${{ secrets.PRIVATE_REPO_TOKEN }}

      - name: Summary
        run: |
          echo "Current repo latest: ${{ steps.current-repo.outputs.name }}"
          echo "External public latest: ${{ steps.external-public.outputs.name }}"
          echo "External private latest: ${{ steps.external-private.outputs.name }}"
```

## Latest Tag/Release Resolution

When `tag_name` is set to `"latest"`, the action uses the following strategy:

1. **Format Filtering** (if `tag_format` is provided): Filter tags/releases to only those matching the specified format pattern(s)
   - If `tag_format` is an array, patterns are tried in order as fallbacks
   - First pattern that matches at least one item is used
   - If no patterns match any items, the action fails with a clear error message
2. **Semver First**: If semantic version tags/releases exist (e.g., v1.2.3, 1.0.0), it selects the highest version
3. **Date Fallback**: If no semver items exist, it selects the most recent item by creation/published date
4. **Alphabetical Fallback**: If no date information is available, it uses alphabetical order

**Note**: Format filtering happens before sorting, so only items matching the format are considered. If `tag_format` is an array and no patterns match any items, the action will fail with a clear error message listing all attempted patterns. For releases, the date used is the release published date.

## Repository Detection

The action automatically detects repository type based on the `repository` input:

- **URLs** (starting with `http://`, `https://`, or `git@`) → Treated as remote repository
- **Paths** (anything else) → Treated as local repository path

Examples:
- `https://github.com/owner/repo` → Remote (GitHub)
- `./my-repo` → Local
- `/absolute/path/to/repo` → Local
- `git@github.com:owner/repo.git` → Remote (GitHub)

**Important**: Releases are only supported for remote repositories. If you set `tag_type: release` with a local repository, the action will throw an error.

## Authentication

For remote repositories, you may need to provide an authentication token:

- **GitHub**: 
  - If `token` input is not provided, the action automatically uses `GITHUB_TOKEN` environment variable (available in GitHub Actions)
  - You can provide a custom Personal Access Token via the `token` input for:
    - Cross-repository access (accessing repos outside the current workflow)
    - Higher API rate limits
    - Accessing private repositories
- **Gitea**: Use a Gitea access token (required via `token` input)
- **Bitbucket**: Use an App Password or access token (required via `token` input)

**Note**: The token is automatically masked in logs for security. In GitHub Actions, you can omit the `token` input to automatically use `${{ secrets.GITHUB_TOKEN }}`.

## Self-Signed Certificates

For self-hosted instances (especially Gitea) that use self-signed SSL certificates, you may encounter certificate validation errors. You can use the `ignore_cert_errors` input to bypass certificate validation:

```yaml
- name: Get tag from self-hosted instance
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://git.example.com/owner/repo
    base_url: https://git.example.com
    ignore_cert_errors: true  # Bypass SSL certificate validation
```

**Security Warning**: Ignoring certificate errors is a security risk and should only be used with trusted self-hosted instances. The action will display a warning when this option is enabled.

## Security Considerations

- Tokens are automatically masked in action logs
- All API calls use HTTPS
- Repository URLs are validated before use
- No credentials are stored or cached

## License

MIT

## Credits

This action is inspired by [ovsds/get-tag-info-action](https://github.com/marketplace/actions/get-tag-info) and extends it with support for multiple platforms and local repositories.

