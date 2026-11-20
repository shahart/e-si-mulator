# Casio fx-9700GE simulator

A standalone TypeScript browser app for exploring the fx-9700GE program workflow. It supports editable named programs, a small command interpreter, and JSON import/export. The 24 KiB shared memory display is an approximation based on UTF-8 source size; the simulator is not a full hardware emulator.

## Run

```sh
npm install
npm test
npm start
```

Open <http://localhost:8001>.

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
