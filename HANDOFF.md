# Post-compact handoff

The app at `http://localhost:3000` contains 4,485 actual named Long Beach places and is
running from rebuilt production containers. The current review build uses CARTO Voyager,
a light-blue origin pin, amber selected-result marker, Home control, preloaded categories,
imperial/metric display, and OSRM road-network distances.

The latest critique added:

- the heading **Find what is nearby in LB.**;
- single-click marker selection while preserving panel and double-click selection;
- `POST /api/v1/routes/path`, which requests full GeoJSON driving geometry from OSRM;
- a selected road-path line framed on the map plus a route widget with origin,
  destination, distance, and estimated drive time; and
- hover/focus explanations for every list rank score and the detail score, showing the
  55% text + 25% road proximity + 15% popularity + 5% category formula and actual
  normalized components.

Verification completed: Prettier, ESLint, all workspace TypeScript checks, 14 unit tests,
and production Docker API/web builds passed. The live path check from the Long Beach mean
center returned a 6,322.7 m driving route with 262 coordinates, and all compose services
are running.

The user accepted this build on 2026-08-13; do not rework the route widget or rank
explanations after the next `/compact`. The intentionally remaining portfolio-evidence
step is the indexed EXPLAIN/k6 procedure at representative 100K+ scale plus a real UI
screenshot. Start that only when the user asks to proceed, record only measured results
in `docs/database-indexes.md`, and do not redesign the architecture first.
