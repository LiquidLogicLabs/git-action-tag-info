# Get Tag Info Action

[![CI](https://github.com/LiquidLogicLabs/git-tag-info-action/actions/workflows/ci.yml/badge.svg)](https://github.com/LiquidLogicLabs/git-tag-info-action/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

Get tag information from local and remote repositories (GitHub, Gitea, Bitbucket). Supports both URL and separate input formats, with "latest" tag resolution using semver-first logic.

## Features

- **Multi-platform support**: Works with GitHub, Gitea, and Bitbucket
- **Local repositories**: Query tags from local git repositories
- **Remote repositories**: Query tags via API from remote repositories
- **Flexible input**: Support both URL format and separate inputs
- **Latest tag resolution**: Automatically resolve "latest" tag using semver-first, date fallback strategy
- **Comprehensive tag info**: Get tag SHA, commit SHA, tag type, message, and verification status

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
  run: echo "Latest tag is ${{ steps.tag-info.outputs.tag_name }}"
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
  run: echo "Latest version tag is ${{ steps.tag-info.outputs.tag_name }}"
```

**Format Pattern Types:**

1. **Simple Patterns**: Use `X` as a placeholder for numbers
   - `"X.X"` matches tags like `3.23`, `1.2`, `10.5`
   - `"X.X.X"` matches tags like `1.2.3`, `10.5.0`
   - `"vX.X.X"` matches tags like `v1.2.3`, `v10.5.0`

2. **Regex Patterns**: For advanced matching, use regex patterns
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

# Use regex for advanced patterns
- uses: your-org/git-tag-info-action@v1
  with:
    tag_name: latest
    repository: https://github.com/owner/repo
    tag_format: '^v\\d+\\.\\d+\\.\\d+$'  # Matches v1.2.3, v10.5.0, etc.
```

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

### Using Outputs

```yaml
- name: Get tag info
  id: tag-info
  uses: your-org/git-tag-info-action@v1
  with:
    tag_name: v1.0.0
    repository: https://github.com/owner/repo

- name: Check if tag exists
  if: steps.tag-info.outputs.exists == 'true'
  run: echo "Tag exists!"

- name: Display tag info
  run: |
    echo "Tag: ${{ steps.tag-info.outputs.tag_name }}"
    echo "SHA: ${{ steps.tag-info.outputs.tag_sha }}"
    echo "Commit: ${{ steps.tag-info.outputs.commit_sha }}"
    echo "Type: ${{ steps.tag-info.outputs.tag_type }}"
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
| `tag_format` | Format pattern to filter tags when resolving "latest" (e.g., `"X.X"` or `"X.X.X"` for numeric patterns, or regex for advanced patterns). Only tags matching this format will be considered when resolving "latest" | No | - |

## Outputs

| Name | Description |
|------|-------------|
| `exists` | Boolean indicating if tag exists |
| `tag_name` | Tag name |
| `tag_sha` | Tag SHA |
| `tag_type` | Tag type (commit/annotated) |
| `commit_sha` | Commit SHA |
| `tag_message` | Tag message |
| `verified` | Whether tag is verified (if applicable) |

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
        run: echo "Latest tag: ${{ steps.tag-info.outputs.tag_name }}"
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
        run: echo "Latest tag: ${{ steps.tag-info.outputs.tag_name }}"
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
          echo "Tag: ${{ steps.tag-info.outputs.tag_name }}"
          echo "SHA: ${{ steps.tag-info.outputs.tag_sha }}"
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
          echo "Current repo latest: ${{ steps.current-repo.outputs.tag_name }}"
          echo "External public latest: ${{ steps.external-public.outputs.tag_name }}"
          echo "External private latest: ${{ steps.external-private.outputs.tag_name }}"
```

## Latest Tag Resolution

When `tag_name` is set to `"latest"`, the action uses the following strategy:

1. **Format Filtering** (if `tag_format` is provided): Filter tags to only those matching the specified format pattern
2. **Semver First**: If semantic version tags exist (e.g., v1.2.3, 1.0.0), it selects the highest version
3. **Date Fallback**: If no semver tags exist, it selects the most recent tag by creation date
4. **Alphabetical Fallback**: If no date information is available, it uses alphabetical order

**Note**: Format filtering happens before sorting, so only tags matching the format are considered. If no tags match the format, the action will fail with a clear error message.

## Repository Detection

The action automatically detects repository type based on the `repository` input:

- **URLs** (starting with `http://`, `https://`, or `git@`) → Treated as remote repository
- **Paths** (anything else) → Treated as local repository path

Examples:
- `https://github.com/owner/repo` → Remote (GitHub)
- `./my-repo` → Local
- `/absolute/path/to/repo` → Local
- `git@github.com:owner/repo.git` → Remote (GitHub)

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

