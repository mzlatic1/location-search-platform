# Scaling

| Stage          | Deliberate next move                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 100K places    | one PostGIS primary, measured indexes, small Redis, pooled connections                                                        |
| 10M places     | read replicas, regional tables/partitions, cache hot normalized queries, precompute stable features                           |
| 100M places    | regional ingestion and routing, bounded geo shards, archived cold data; evaluate a search engine only after Postgres evidence |
| 100 requests/s | stateless API replicas, connection budget, rate limits, cache stampede protection                                             |
| 10K requests/s | regional API/cache tiers, replica routing, asynchronous ingestion, failover drills, stronger abuse controls                   |

Partitioning is not automatically useful: a query spanning partitions can regress. Start
with geography-based regionalization only when traffic and data locality justify it.
OpenSearch becomes reasonable when linguistic recall, independent text scaling, or
ranking features exceed Postgres—not simply at an arbitrary row count. Candidate IDs
from that engine would still be hydrated from the authoritative place store. Consistency
is eventual across replicas/caches; invalidation uses versioned keys plus short TTLs.
