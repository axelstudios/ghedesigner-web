# GHEDesigner UI

## Prerequisites

- Install Node v22
- Install Angular and pnpm globally (`npm i -g @angular/cli pnpm`)
- Install the dependencies (`pnpm i`)

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Updating pyodide dependencies

1. Go to the [Pyodide console](https://pyodide.org/en/stable/console.html)
2. Open the browser's dev tools and go to the Network tab
3. Run `import click, jsonschema, scipy, typing_extensions`
4. Download the ~12 wheels and zip files that were fetched, and replace all the existing contents of /public/pyodide/* with the new files
