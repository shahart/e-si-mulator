# Repository Guidelines

## Project Structure

The calculator app lives in `casio-fx-180p/`. Its TypeScript source is in `src/`: `calculator.ts` owns calculator behavior, `keys.ts` defines the keypad, `program-file.ts` validates uploaded programs, and `main.ts` connects the UI. Tests are in `test/`; static assets are `index.html`, `style.css`, and `demo-program.json`. `dist/` contains JavaScript emitted by the build. Edit TypeScript in `src/`, not generated files in `dist/`. The GitHub Pages workflow is in the root `.github/workflows/pages.yml`.

## Build, Test, and Run

Run app commands from `casio-fx-180p/`:

```sh
npm ci          # Install locked dependencies
npm run build   # Compile TypeScript into dist/
npm test        # Build, then run the Node.js test suite
npm start       # Serve on http://localhost:8000
```

Use an HTTP server for local development so browser ES modules load correctly. The Pages workflow runs the test/build command and publishes the static app from this directory.

## Code Style and Modules

Use TypeScript for application logic, ES module imports with `.js` specifiers, two-space indentation, `camelCase` for functions and variables, and `PascalCase` for classes and types. Keep calculator logic, DOM integration, and file parsing in their existing focused modules. Add runtime validation for uploaded data; treat `dist/` as generated output. No formatter or linter is configured.

## Testing

Tests use Node's built-in `node:test` runner and live in `test/*.test.js`. Import compiled modules from `dist/`; `npm test` compiles them first. Cover calculator behavior, the shared 38-step program limit, and file import validation when changing those areas. There is no coverage threshold.

## Commits and Pull Requests

The repository has no commit history yet, so no established commit convention is available. Use short imperative subjects, for example `Add program import validation`. Pull requests should describe user-visible changes, include test results, and attach a screenshot for UI changes. Link related issues when applicable.

## Deployment

The workflow deploys on pushes to the repository's default branch. Keep Pages configured to use **GitHub Actions** as its publishing source.

## Agent notes

See `AGENT_NOTES.md` for locally persisted session knowledge, including conventions for the `casio-fx-9700ge/` app.
