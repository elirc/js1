# Warehouse Ledger (TypeScript · React · Node · Postgres)

An inventory app whose lesson is the **ledger / event-sourcing pattern** plus
**multi-row atomic transfers**. Stock is never a mutable number — it is the
running `SUM` of immutable movement rows.

## What it teaches

- Deriving state with `COALESCE(SUM(delta), 0)` instead of storing a balance
- A `CROSS JOIN` of products × warehouses so every cell shows, even at zero
- A transfer as **two movements in one transaction** (debit + credit) that both
  commit or both roll back
- Enforcing a business rule (no negative stock) by reading the balance and
  inserting inside the same transaction
- Derived "low stock" flags from `balance <= reorder_point`

## Schema

```
products ──< movements >── warehouses
            (delta: + received / − issued)
```

## Run it (you provide Postgres)

```bash
cp .env.example .env
createdb warehouse_ledger
npm install
npm run db:setup
npm run dev          # API on :4113, client on :5113
```

> Study scaffold — dependencies are not committed; `db:setup` uses `psql`.

## A note on concurrency

The "no negative stock" check reads the balance and then inserts. Under heavy
concurrency two transfers could both pass the check. Production-grade fixes:
run the transaction at `SERIALIZABLE` isolation, or take a `pg_advisory_xact_lock`
keyed on `(product_id, warehouse_id)` before reading. Good stretch exercise.

## Stretch ideas

- Add a stock-valuation report (`SUM(delta) * unit_cost`).
- Add a movements-by-day chart with `date_trunc('day', created_at)`.
- Add the advisory-lock fix described above.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): protecting a balance under concurrent writes, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
