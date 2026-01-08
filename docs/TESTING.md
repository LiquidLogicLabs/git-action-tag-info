# Testing Guide

This document outlines testing approaches for this project.

## Test Structure

This project uses **Jest** for testing. Tests are located in the source directory.

## Running Tests

```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
```

## Test Environment

- Local: Node.js 20+, Jest
- CI/CD: GitHub Actions via `.github/workflows/test.yml`

## Manual Testing

1. Build: `npm run build`
2. Set environment variables: `export INPUT_<NAME>=value`
3. Run: `node dist/index.js`

## Writing New Tests

Follow existing test patterns, mock external dependencies, use descriptive test names.

## Troubleshooting

- Clear Jest cache: `npm test -- --clearCache`
- Reinstall: `rm -rf node_modules && npm install`
