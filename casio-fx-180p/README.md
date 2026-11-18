# Casio fx-180P emulator

The browser app is written in TypeScript and split into small modules under `src/`:

- `calculator.ts` contains calculator state and key behavior.
- `keys.ts` defines the physical keypad.
- `program-file.ts` validates uploaded program files.
- `main.ts` connects the calculator to the page.
- `types.ts` contains shared TypeScript types.

## Run locally

Install the development dependency and compile the TypeScript modules:

```sh
npm install
npm run build
```

Serve the project over HTTP so the browser can load the modules:

```sh
npm start
```

Then open <http://localhost:8000>. Rebuild after changing a file in `src/`.

The compiler writes browser-ready JavaScript modules to `dist/`.

## Deploy with GitHub Pages

The parent repository's `.github/workflows/pages.yml` workflow builds and tests this folder on pushes and pull requests. Pushes to the repository's default branch deploy the static site. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
