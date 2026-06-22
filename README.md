# NMEA 2000 PGN Reference

Interactive technical reference for all NMEA 2000 Parameter Group Numbers (PGNs), sourced from the [canboat](https://github.com/canboat/canboat) open-source database.

**Live site:** <!-- PAGES_URL -->

## Features

- 339 PGN groups · 543 total definitions
- Full field-level specs: type, bit length, resolution, range, units, lookup enumerations
- Bit layout diagram for each PGN — visualizes the on-wire frame
- Sample decoded output for every definition
- Fast/Single-frame filter, full-text search, hash-based deep-links (`#pgn-127250`)
- Dark / Light / System theme with no flash of unstyled content
- Single static file — no server needed

## Usage

```bash
npm install
npm run build   # generates docs/index.html
npm start       # build + serve at http://localhost:3000
```

## Data source

All PGN data comes from [`canboat.json`](https://github.com/canboat/canboat) (schema v2.3.0, version 6.2.0).

## License

Apache-2.0
