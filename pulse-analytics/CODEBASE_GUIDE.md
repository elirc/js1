# Pulse Analytics Codebase Guide

Pulse Analytics is about read-heavy analytical data. It teaches a different side of engineering: not just CRUD, but reporting, aggregation, and query performance.

## Code Map

- `shared/types.ts`: metric and dashboard response types.
- `server/src/db.ts`: Postgres helper.
- `server/src/index.ts`: metrics and refresh endpoints.
- `server/db/schema.sql`: events table, materialized view, indexes.
- `client/src/api.ts`: dashboard API calls.
- `client/src/App.tsx`: metric cards and charts.

## Materialized View

```sql
CREATE MATERIALIZED VIEW daily_metrics AS
SELECT date_trunc('day', occurred_at) AS day,
       COUNT(*) AS total_events
FROM events
GROUP BY 1;
```

A materialized view stores query results. It makes reads faster, but it can become stale.

## Refreshing Analytics

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics;
```

`CONCURRENTLY` keeps reads available during refresh, but it requires a unique index. Production analytics work is full of tradeoffs like this.

## Window Functions

```sql
SUM(total_events) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
```

Window functions compute values across neighboring rows without collapsing the result set. They are essential for trends, rankings, and moving averages.

## Frontend Read Model

The React app mostly displays data returned by the server. That is realistic: dashboards often avoid complex client-side business logic and trust the backend's aggregated response.

## Extension Practice

- Add date-range filters.
- Add conversion rate metrics.
- Add cache timestamps.
- Add a loading state during refresh.
- Add SQL comments explaining each aggregate.

Analytics code should be explainable. Future teammates need to trust the numbers.
