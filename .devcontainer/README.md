# Dev Container

This dev container provides a consistent development environment for the GitHub Action.

## What's Included

- **Node.js 20** - Matches the CI/CD environment
- **Git** - Required for integration tests and git operations
- **GitHub CLI** - Optional, useful for GitHub operations
- **VS Code Extensions**:
  - ESLint
  - Prettier
  - TypeScript
  - Jest Runner

## Usage

1. Open the project in VS Code
2. When prompted, click "Reopen in Container"
3. Or use Command Palette: `Dev Containers: Reopen in Container`

## Optional: Install `act` for Local GitHub Actions Testing

To test GitHub Actions workflows locally, you can install `act`:

```bash
# Install act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

Then use npm scripts to run workflows:
```bash
# Run test workflow
npm run test:act

# Run CI workflow
npm run test:act:ci
```

## Available Commands

Once in the container:

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage
npm run test:coverage

# Build the action
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Test workflows with act
npm run test:act        # Run test workflow
npm run test:act:verbose # Run test workflow with verbose output (debugging)
npm run test:act:ci     # Run CI workflow
npm run lint:act        # Run lint job via act
```

## Notes

- The container matches the GitHub Actions runner environment (Node.js 20, Ubuntu)
- Dependencies are automatically installed on container creation
- VS Code settings are configured for TypeScript, ESLint, and Prettier
