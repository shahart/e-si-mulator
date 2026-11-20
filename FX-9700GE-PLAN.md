# Casio fx-9700GE simulator plan

## Goal

Build a browser-based TypeScript simulator for the Casio fx-9700GE, alongside the existing fx-180P app. Users can write, run, edit, import, and export named programs as JSON. This is a practical simulator for the model's core workflows, not a cycle-accurate hardware emulator.

## Scope and implementation order

1. Create a standalone `casio-fx-9700ge/` TypeScript app with its own UI and tests.
2. Model mode navigation, calculator state, named program memory, an fx-style text display, and a 128×64 graph display.
3. Implement an initial formula-language subset: arithmetic, variables A–Z, input/output, labels/jumps, conditionals, subroutine calls, and common math functions. Display unsupported commands clearly.
4. Add safe JSON import/export for one program or a program collection. Validate names, source, command syntax, file size, and total memory before modifying stored programs. Keep a sample program in JSON.
5. Add graphing and matrix support after the program lifecycle and core language are usable.
6. Add tests for parsing/execution, control flow, memory accounting, and import validation.
7. Update GitHub Pages to build/test both apps and publish them at separate paths, with a small repository landing page linking to each.

## JSON format

The initial interchange format is editable JSON, not a native calculator link/binary file. A file can contain `{ "version": 1, "programs": [{ "name": "Example", "source": ["?→A", "A²→B", "Disp B"] }] }`. A one-program `{ "name": ..., "source": [...] }` form may also be accepted. Export uses the collection format.

## First release boundary

The first release includes calculator-like navigation, program list/editor/run controls, core arithmetic and control flow, JSON import/export, an example, responsive layout, keyboard-accessible controls, and a 24 KiB shared program-memory budget (documented as an approximation pending validation against model-specific encoding details). Full graphing, matrices, hardware file transfer, and exact ROM behavior are follow-ups.

## Verification

Run `npm test` in the new app and the existing fx-180P app. Check the new build output and Pages artifact paths. Keep all handwritten application code in TypeScript and generated JavaScript in `dist/`.
