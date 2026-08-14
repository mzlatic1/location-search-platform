# Database indexes and performance investigation

| Index                            | Access pattern                               | Cost                                  |
| -------------------------------- | -------------------------------------------- | ------------------------------------- |
| `places_geom_gist`               | radius and map-window candidate pruning      | larger writes; GiST maintenance       |
| `places_name_trgm`               | fuzzy/prefix name candidates                 | sizable GIN index; slower imports     |
| `places_category_idx`            | selective category filter                    | limited value for dominant categories |
| `(category,popularity_score,id)` | category browse with stable popularity order | extra write amplification             |

## Reproducible before/after exercise

Run only after importing the target real dataset; paste actual results into a dated
section below. Do not report the four-row fixture as evidence.

```sql
DROP INDEX places_geom_gist;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id FROM places WHERE ST_DWithin(
  geom, ST_SetSRID(ST_MakePoint(-118.1937,33.7701),4326)::geography, 5000);
CREATE INDEX places_geom_gist ON places USING gist (geom);
ANALYZE places;
-- repeat the identical EXPLAIN command
```

Record database version, row count, cache state, plan, planning/execution time, buffers,
and hardware. Expected plan shape is an indexed bounding check plus exact geography
filter; an expectation is not a measured result.

## Recorded results

No representative benchmark has been run yet.
