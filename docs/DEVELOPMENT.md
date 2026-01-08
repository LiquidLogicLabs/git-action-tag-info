# Development Guide

This document provides information for developers who want to contribute to this project.

## Prerequisites

- Node.js 20 or higher
- npm
- Git

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/LiquidLogicLabs/git-tag-info-action.git
cd git-tag-info-action
```

### Install Dependencies

```bash
npm install
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes following coding standards
3. Test locally: `npm test && npm run lint && npm run build`
4. Commit with clear messages (consider Conventional Commits)
5. Push and create a Pull Request

### Available Scripts

```bash
npm run build          # Compile TypeScript and bundle
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run release:patch  # Create patch release
npm run release:minor  # Create minor release
npm run release:major  # Create major release
```

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

## Releasing

This project uses `standard-version` for automated release tag creation with commit summaries.

### Pre-Release Checklist

1. All local tests pass: `npm test`
2. Build succeeds: `npm run build`
3. Linter passes: `npm run lint`
4. CI workflow has passed

### Creating a Release

```bash
npm run release:patch  # Patch release (1.0.0 → 1.0.1)
npm run release:minor  # Minor release (1.0.0 → 1.1.0)
npm run release:major  # Major release (1.0.0 → 2.0.0)
```

The release command automatically bumps version, analyzes commits, creates git commit and tag with commit summary, and pushes to trigger the GitHub Actions release workflow.

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Getting Help

- Open an issue on GitHub
- Review [TESTING.md](./TESTING.md) for testing questions
