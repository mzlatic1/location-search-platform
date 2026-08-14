# Search ranking

`score = .55 text + .25 proximity + .15 popularity + .05 category`

- **text** is the greater of trigram similarity and an exact normalized prefix signal.
- **proximity** is `max(0, 1 - distance/radius)` and therefore remains in `[0,1]`.
- **popularity** is an importer-provided `[0,1]` feature, never raw review count.
- **category** is binary when a category filter is present.

Search order is score descending, distance ascending, UUID ascending. Distance sort
reverses the first two fields. All cursor fields participate in the seek predicate to
avoid duplicates under a stable dataset. This is hand-authored ranking, not ML.
