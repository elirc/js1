# JavaScript CRUD Practice Projects

Standalone vanilla JavaScript CRUD apps live in this workspace. Each is
intentionally dependency-free — open the folder's `index.html` in a browser and
start practicing Create, Read, Update, and Delete workflows.

**Core five (form-driven CRUD):**

1. `task-board` - task cards with priority, status, search, and edit mode
2. `contact-book` - contact directory with validation and search
3. `pantry-inventory` - inventory table with low-stock tracking
4. `reading-list` - book tracker with sorting and ratings
5. `budget-tracker` - transaction tracker with derived totals

**Fundamentals fillers (each targets a technique the core five skip):**

6. `habit-tracker` - date math, consecutive-day streaks, and a toggle grid
7. `snippet-vault` - app split across **ES modules** + the Clipboard API
8. `poll-studio` - **dynamic field arrays** (add/remove rows) + percentage bars
9. `focus-timer` - a **setInterval state machine** with a session log
10. `kanban-flow` - native **drag-and-drop** reordering across columns
11. `flashcards` - **view modes** (manage/study) with a flip-and-grade flow

> Note: `snippet-vault` uses ES modules, so serve it over HTTP
> (`npx serve snippet-vault`) rather than opening it from `file://`.

## More Complex React + Node CRUD Projects

These folders are full-stack learning scaffolds with a React client and Express
server. Each includes a `package.json`, `server/server.js`,
`client/src/App.jsx`, `client/src/api.js`, styles, and a README with learning
goals. They are written for study rather than immediate execution, and each
server runs on its own port.

**Core five (REST + in-memory data):**

1. `issue-desk` - issue tracker with REST filters, validation, and a repository layer (port 4101)
2. `course-roster` - course catalog with enrollment and capacity rules (port 4102)
3. `recipe-studio` - recipe manager with nested ingredients (port 4103)
4. `job-pipeline` - job application tracker with workflow stages (port 4104)
5. `event-admin` - event manager with capacity and status rules (port 4105)

**Fundamentals fillers (each targets a backend technique the core five skip):**

6. `note-vault` - **disk persistence** with `fs/promises` to a JSON file (port 4106)
7. `mini-blog` - **one-to-many** posts → comments with nested routes and cascade delete (port 4107)
8. `secure-notes` - **authentication**: register/login, bearer tokens, per-user data (port 4108)
9. `stock-catalog` - **server-side pagination, sorting, and filtering** (port 4109)

## TypeScript + React + Node + Postgres Projects

The most complex tier: end-to-end typed apps with a real relational database.
Each shares one `shared/types.ts` between server and client, uses `pg` with a
connection pool and parameterised queries, and ships a `server/db/schema.sql`
you load with `psql`. The API runs on the `4110+` port, the Vite client on the
matching `5110+` port. Each `README.md` lists the specific Postgres technique it
drills.

1. `invoice-studio` - **transactions** (atomic invoice + line items) and totals computed in SQL (API 4110)
2. `support-tickets` - **many-to-many** labels via a join table + an append-only **audit log** (API 4111)
3. `room-booking` - **range exclusion constraints** (`tstzrange` + `btree_gist`) to prevent double-booking (API 4112)
4. `warehouse-ledger` - **derived balances** (`SUM` of immutable movements) + atomic multi-row **transfers** (API 4113)
5. `forum-search` - **full-text search** (generated `tsvector` + GIN, `websearch_to_tsquery`, `ts_rank`) + pagination (API 4114)
6. `live-chat` - real-time **WebSockets** fanned out via Postgres **LISTEN/NOTIFY**, rooms + presence (API/WS 4115)
7. `org-explorer` - hierarchical data with **recursive CTEs** (subtree, ancestors, cycle-safe moves) (API 4116)
8. `pulse-analytics` - **window functions** + a **materialized view** with `REFRESH … CONCURRENTLY` (API 4117)

These are **study scaffolds**: no dependencies or `node_modules` are committed,
and you bring your own Postgres. To run one:

```bash
cd <project>
cp .env.example .env          # point DATABASE_URL at your database
createdb <db_name>            # name is in .env.example
npm install
npm run db:setup              # loads server/db/schema.sql (+ seed data) via psql
npm run dev                   # API + Vite client together
```

## Additional Complex JavaScript Stack CRUD Projects

These ten projects are React + Express study scaffolds with richer CRUD behavior:
server-side search/filter/sort/pagination, stats endpoints, focused status
mutation routes, and nested activity logs. They are source-only; no dependencies
are installed.

1. `library-lending` - library loans, borrowers, overdue workflow, and activity notes (API 4221)
2. `gym-membership` - membership lifecycle, coach ownership, plan categories, and status changes (API 4222)
3. `project-risks` - risk register with mitigation workflow, exposure values, and activity notes (API 4223)
4. `equipment-maintenance` - maintenance work orders, technicians, categories, and completion tracking (API 4224)
5. `volunteer-coordinator` - volunteer shifts, staffing needs, coordinators, and activity notes (API 4225)
6. `property-rentals` - rental units, leasing status, rent values, and maintenance state (API 4226)
7. `legal-case-tracker` - legal case files, attorneys, matter categories, and case workflow (API 4227)
8. `procurement-portal` - purchase requests, approval workflow, requesters, and spend tracking (API 4228)
9. `patient-intake` - intake cases, clinicians, care categories, and scheduling readiness (API 4229)
10. `campaign-planner` - campaigns, marketing owners, budgets, channels, and launch workflow (API 4230)

## Additional TypeScript + React + Node + Postgres CRUD Projects

These ten projects add stronger corporate-codebase practice: shared TypeScript
contracts, Express APIs, Postgres schemas, SQL filtering, transactional writes,
activity logs, and client/server boundaries.

1. `grant-manager` - grant applications, review stages, award amounts, and activity notes (API 4231, Vite 5231)
2. `asset-checkout` - equipment checkouts, custodians, return dates, and audit notes (API 4232, Vite 5232)
3. `learning-paths` - employee learning plans, mentors, budgets, and completion workflow (API 4233, Vite 5233)
4. `vendor-contracts` - vendor agreements, renewal workflow, owners, values, and notes (API 4234, Vite 5234)
5. `incident-response` - operational incidents, severity, response owners, and timelines (API 4235, Vite 5235)
6. `subscription-billing` - customer subscriptions, plan changes, renewal dates, and billing amounts (API 4236, Vite 5236)
7. `field-service` - field visits, technicians, job status, service cost, and notes (API 4237, Vite 5237)
8. `quality-audits` - quality audits, owners, severity, remediation dates, and findings (API 4238, Vite 5238)
9. `travel-requests` - business travel approvals, destinations, costs, and approval workflow (API 4239, Vite 5239)
10. `research-studies` - research studies, principal investigators, enrollment counts, and study status (API 4240, Vite 5240)

## C# / .NET / Postgres CRUD Projects

These twenty medium-complexity projects use ASP.NET Core Minimal APIs, Dapper,
Npgsql, and Postgres. Each one includes route groups, DTO validation, repository
classes, SQL filtering/sorting/pagination, stats endpoints, activity logs,
database constraints, seed data, a codebase guide, and five detailed user
stories.

1. `permit-tracker-dotnet` - municipal permits, reviewers, departments, fees, and approval workflow (API 4301)
2. `fleet-maintenance-dotnet` - vehicle maintenance work orders, mechanics, service categories, costs, and repair status (API 4302)
3. `clinic-referrals-dotnet` - specialist referrals, clinicians, urgency, authorization state, and follow-up notes (API 4303)
4. `grant-disbursements-dotnet` - grant payment releases, program owners, funding categories, amounts, and approval checkpoints (API 4304)
5. `training-compliance-dotnet` - employee training assignments, compliance categories, owners, deadlines, and completion state (API 4305)
6. `facility-inspections-dotnet` - facility inspection records, inspectors, building areas, remediation costs, and issue status (API 4306)
7. `donation-management-dotnet` - donor gifts, campaign categories, stewardship owners, donation amounts, and receipt workflow (API 4307)
8. `insurance-claims-dotnet` - insurance claims, adjusters, claim types, reserve amounts, and decision workflow (API 4308)
9. `recruiting-pipeline-dotnet` - candidate records, recruiters, job families, compensation targets, and interview workflow (API 4309)
10. `inventory-replenishment-dotnet` - stock replenishment requests, buyers, product categories, order values, and fulfillment status (API 4310)
11. `meal-program-dotnet` - community meal plans, coordinators, dietary categories, budget amounts, and preparation status (API 4311)
12. `asset-depreciation-dotnet` - fixed assets, finance owners, asset categories, book values, and lifecycle status (API 4312)
13. `board-resolutions-dotnet` - board resolutions, sponsors, governance categories, fiscal impact, and approval state (API 4313)
14. `customer-success-plans-dotnet` - customer success plans, CSM owners, account segments, renewal value, and health workflow (API 4314)
15. `safety-observations-dotnet` - workplace safety observations, supervisors, hazard categories, estimated risk cost, and correction workflow (API 4315)
16. `lab-samples-dotnet` - lab samples, technicians, sample classes, processing costs, and chain-of-custody status (API 4316)
17. `transport-dispatch-dotnet` - transport dispatches, coordinators, route types, trip costs, and delivery status (API 4317)
18. `subscription-entitlements-dotnet` - subscription entitlements, account owners, product modules, contract value, and provisioning state (API 4318)
19. `vendor-onboarding-dotnet` - vendor onboarding records, procurement owners, vendor categories, expected spend, and review workflow (API 4319)
20. `content-calendar-dotnet` - marketing content items, owners, channels, campaign budgets, and publishing workflow (API 4320)

## Codebase Study Guides

Every project folder includes `CODEBASE_GUIDE.md`. These guides are written for
upskilling toward larger corporate SWE codebases: they explain the architecture,
data flow, important code snippets, validation, API boundaries, derived state,
database guarantees where relevant, and extension exercises.

Suggested reading path:

1. Start with a vanilla app guide such as `task-board/CODEBASE_GUIDE.md`.
2. Move to a React + Express guide such as `issue-desk/CODEBASE_GUIDE.md`.
3. Finish with a TypeScript + Postgres guide such as `forum-search/CODEBASE_GUIDE.md` or `warehouse-ledger/CODEBASE_GUIDE.md`.
