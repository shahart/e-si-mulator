# Casio fx-9700GE simulator

A standalone TypeScript browser app for exploring the fx-9700GE program workflow. It supports editable named programs, a Casio BASIC subset with loops and plotting, 128×64 graphics output, and text/JSON import/export. The 24 KiB shared memory display is an approximation based on UTF-8 source size; the simulator is not a full hardware emulator.

## Run

```sh
npm install
npm test
npm start
```

Open <http://localhost:8001>.

## Upload a program

Use **Import program** to load a JSON program/collection containing one Casio BASIC program.

Mandelbrot is loaded from the bundled `mandelbrot.json` and run at startup, drawing it on the graph canvas. **Mandelbrot example** and **Sine wave** load `mandelbrot.json` and `sine.json` into the editor. URLs written in program comments (such as the Mandelbrot Wikipedia link) are underlined and clickable in the program source editor. **Clear graph** resets the canvas.

Supported syntax includes `→`/`->` assignment, `If`/`Then`/`Else`/`IfEnd`, `For`/`Next`, `While`/`LpWhile`, `Do`/`LpWhile`, `While`/`WhileEnd`, `Lbl`/`Goto`, `Prog`, `Disp`, `ClrText`, `ClrGraph`, `ViewWindow`, `PlotOn`, `PlotOff`, `Line`, `Stop`, `Return`, and `Error "message"` (stops with a custom error). Comparisons, `And`/`Or`/`Not`, and functions such as SIN, COS, TAN, SQRT, ABS, LOG, LN, EXP, INT, FRAC, and ROUND are available. Lines beginning with `'` are comments.

## Graph a function

Yes — `PlotOn` plus `ViewWindow` can graph a function. For example, `y = sin(x)` in radians:

```text
ClrGraph
-10 -> A
10 -> B
-1.5 -> C
1.5 -> D
ViewWindow A, B, 0, C, D, 0
For 0 -> I To 127
  A + (B - A) * I / 127 -> X
  SIN(X) -> Y
  PlotOn X, Y
Next I
```

Paste that into the editor and press **Run program**. Use `SIN(X * PI / 180)` instead if `X` is in degrees. Functions need parentheses, so write `SIN(X)`, not `SIN X`.

## JSON format

Import either one program:

```json
{ "version": 1, 
  "name": "SQUARE", 
  "source": [
    "?\"X=\"→A", 
    "A^2→B", 
    "Disp B"
  ]
}
```

or a collection:

```json
{ "version": 1, 
  "programs": [
    { 
      "name": "SQUARE", 
      "source": [
        "A^2→B", 
        "Disp B"
      ] 
    }
  ]
}
```

Export writes the collection form. Names are 1–8 letters/digits/underscores, starting with a letter. Imports are capped at 100 KB and 24 KiB of aggregate modeled memory.
