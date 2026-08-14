# Post-compact handoff

The app at `http://localhost:3000` now contains 4,485 actual named Long Beach places and
uses CARTO Voyager, a light-blue origin pin, an amber selected-result marker, a Home
control, a preloaded category list, imperial/metric display, and marker double-click
selection. The API enriches each result batch through OSRM's driving table; an end-to-end
37-result check returned 37 road-network distances. After `/compact`, first have the user
review those interactions in the browser. If accepted, the intentionally remaining
portfolio-evidence step is the indexed EXPLAIN/k6 procedure at representative 100K+
scale plus a real UI screenshot; record only measured results in
`docs/database-indexes.md` and do not redesign the architecture first.
