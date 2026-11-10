# LONG final archive

The retired LONG service is displayed from the verified public snapshot at `v3/data/long/`. The snapshot has `state: "final"`, cutoff `2026-11-10T11:00:00.000Z`, 261 provider records, 132 historical lottery reports, one compensation receipt and two final-payment receipts.

The archive contains public wallet addresses and service bookkeeping fields. Bookkeeping counters are not cash-payment totals. Confirmed payment amounts are shown separately from the receipts. Pool capture height/time and backend cursor are distinct from the accrual cutoff.

The canonical `index.html` loads `v3/js/long-archive.js` before `v3/js/app.js`. Existing LONG main, lottery, bids and deferred-payment routes use the same reader. Archive views make no Smartfarm or public-node API requests, accept no monetary submissions and show no future-yield forecast. Reports and source cells are HTML-escaped.

The reader verifies schema, counts, safe paths, exact byte sizes and SHA256 of every indexed file. Decimal amounts remain strings. Malformed or incomplete activated archives fail closed. Before archive activation, an HTTP404 for the manifest permits the historical live fallback. The deployed final manifest must therefore remain present. Archive requests bypass the service-worker cache; HTTPS WebCrypto is required.

Keep the final snapshot immutable. If transferring it, copy only the public `long/` directory, verify all indexed files and publish `manifest.json` last. Never publish a preview as final, or copy the service's private archive parent, configuration, recovery material, logs or database journals.

Focused checks:

```
node tests/v3-long-archive.js
node tests/v3-long-archive-shell.js
node tests/v3-minter-long-smoke.js
```

Browser acceptance additionally checks all four LONG views with live APIs blocked, provider decimal values and report links. Node tests do not establish physical screen-reader acceptance.
