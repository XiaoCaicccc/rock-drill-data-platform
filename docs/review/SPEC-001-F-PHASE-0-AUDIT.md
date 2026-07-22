# SPEC-001-F Phase 0 Current-State Audit

## Baseline

- Main HEAD: `1ed92bbb8fcc8de2b12b6cc22d18752256028c07`
- Working tree: clean at audit start
- REPORT-001 status: OPEN / BLOCKING
- SPEC-001 overall: OPEN

## Current Lifecycle

| Operation | Route/Service | Roles | Precondition | Transaction | Conditional state write | Audit transaction |
|---|---|---|---|---|---|---|
| Create | `POST /api/reports` | admin, quality_manager | Valid report, source context, and released revisions | No | No | No |
| Edit | `PUT /api/reports` | admin, quality_manager | Read-time status is draft | No | No; `where` contains only `id` | No |
| Delete | `DELETE /api/reports` | admin, quality_manager | Read-time status is draft | No | No; `where` contains only `id` | No |
| Submit | `POST /api/reports/[id]/submit-review` | admin, quality_manager | Draft and valid source scope | Yes | Yes; `id + old status` | Yes |
| Return | `POST /api/reports/[id]/return-for-revision` | admin, quality_manager | Reviewing and non-empty reason | Yes | Yes; `id + old status` | Yes |
| Publish | `POST /api/reports/[id]/publish` | admin, quality_manager | Reviewing and valid source scope | Yes | Yes; `id + old status` | Yes |
| Read | `GET /api/reports` | Admin/quality manager: all; inspector/engineer: published; viewer: denied | Data Scope authorization | No | N/A | N/A |

The frozen lifecycle is `draft -> reviewing -> published` and `reviewing -> draft`; published has no outgoing transition. Legacy archived and unknown states are not re-entered into the managed lifecycle.

## Confirmed Defects

### Edit vs Submit

- Reproducible: YES.
- Exact path: `src/app/api/reports/route.ts` reads the report and checks draft, then later performs `analysis_report.update({ where: { id } })`. Submit uses a transactional conditional status update in `src/lib/report-workflow.ts`.
- Result: A submit can commit first while the stale PUT continues and overwrites report content, `source_context`, or part-revision links.
- Classification: BLOCKER.

### Edit vs Publish

- Reproducible: YES.
- Exact path: publish creates a snapshot and changes status transactionally, while ordinary PUT has no transactional draft condition at the final write.
- Result: A late PUT can alter the current row after publication, making it diverge from the publication snapshot.
- Classification: BLOCKER.

### Delete Race

- Reproducible: YES.
- Exact path: DELETE reads and checks draft, then performs an unconditional-by-status delete. DELETE audit is written separately.
- Result: Delete can race with submit or publish; the snapshot foreign-key restriction is not a substitute for conditional deletion. Mutation and audit can also become non-atomic.
- Classification: BLOCKER.

### Double Edit

- Current behavior: Two draft PUT requests can both succeed; the later write wins silently.
- Existing concurrency token: `analysis_report.updated_at` exists, but the current request contract does not send or validate it.
- Risk: Stale edits are not detected. This violates the required publication consistency boundary.

### Double Publish

- Current behavior: Both requests may load reviewing, but the status update uses `id + old status` conditional CAS.
- Snapshot count: The unique `analysis_report_snapshot.report_id` and transaction rollback should leave at most one snapshot.
- Error behavior: The losing transaction must be mapped to a stable 409 domain response; current implementation lacks PostgreSQL concurrency evidence for this behavior.

## Published Read Authority

- Current API source: `GET /api/reports` reads the current `analysis_report` row and current part-revision links.
- Current UI source: `src/components/reports/ReportView.tsx` consumes `/api/reports`.
- Snapshot use: A publication snapshot is created during publish, but the read path does not use it.
- Divergence risk: High. A post-publication overwrite of the current row can make API/UI content differ from the immutable snapshot.

The design freeze selects Current Row authoritative: published current-row content remains the GET/API/UI source, while the snapshot is immutable publication evidence. This requires the write boundary to prove that published content cannot change and automated checks to assert current-row/snapshot equality after publication.

## Permission and Scope

| Role | Create | Edit | Delete | Submit | Return | Publish | Draft read | Published read |
|---|---|---|---|---|---|---|---|---|
| admin | Allow | Allow | Allow | Allow | Allow | Allow | All | All |
| quality_manager | Allow | Allow | Allow | Allow | Allow | Allow | All | All |
| inspector | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Published only |
| engineer | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Published only |
| viewer | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| anonymous | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

No permission matrix or Data Scope change is authorized by this phase.

## Existing Test Coverage

- Contract: workflow transition and error behavior have basic coverage; report edit/delete concurrency contracts are missing.
- Service: transition and publish workflow tests exist; edit/delete atomicity, link replacement rollback, and audit rollback tests are missing.
- PostgreSQL: no report concurrency suite was found for the eight required scenarios.
- Permission: shared permission/Data Scope coverage exists; report-specific six-identity lifecycle regression is incomplete.
- Read model: no automated assertion proves current-row/snapshot/UI consistency.

## Missing Evidence

- edit vs submit;
- edit vs publish;
- delete vs submit;
- delete vs publish;
- double edit;
- double publish;
- link replacement rollback;
- audit rollback;
- published current-row/snapshot consistency;
- stable HTTP status and business code mapping for stale/state conflicts;
- PostgreSQL 16 concurrency execution evidence.

## Design Options

### Option A — Conditional update plus transaction

Move edit/delete into a report service, require draft status and `updated_at` in the write condition, and write content, links, and AuditLog in one transaction.

- Advantages: no Migration; reuses existing status and timestamp fields.
- Risk: requires the frozen `expected_updated_at` contract to resolve double-edit conflicts.
- Migration: NO.

### Option B — PostgreSQL row lock

Lock the report row inside the transaction, reload status and `updated_at`, then perform the mutation and audit.

- Advantages: deterministic database serialization.
- Risks: greater SQL/locking complexity and deadlock-order requirements.
- Migration: NO.

### Option C — Explicit optimistic version

Add a dedicated version field and require it on mutation requests.

- Advantages: explicit conflict semantics.
- Risks: requires Schema/Migration and a broader contract change.
- Migration: CONDITIONAL.

### Recommended Design

- Concurrency strategy: existing `updated_at` optimistic CAS.
- Edit transaction: validate source and released revisions inside the transaction; condition on `id`, draft status, and `expected_updated_at`; update scalar fields, source context, links, and UPDATE audit atomically.
- Delete transaction: condition on `id`, draft status, and `expected_updated_at`; delete links/report and write DELETE audit atomically.
- Transport: PUT carries `expected_updated_at` in the JSON body; DELETE carries it in the query string. Missing tokens are not legacy-compatible.
- Decision precedence: invalid request, not found, non-draft state, stale draft timestamp, then mutation.
- Version advancement: every successful edit, including link-only edit, advances and returns `updated_at`; failed link replacement rolls back the complete mutation.
- Lifecycle CAS: load status and `updated_at`; condition submit/return/publish on both values.
- Published authority: current row remains authoritative for GET/API/UI.
- Snapshot role: immutable publication evidence; assert equality with current row after publish.
- Double-edit policy: stale request returns `409 REPORT_EDIT_CONFLICT`.
- Double-publish policy: one success only; losing request returns `409 REPORT_STATE_CONFLICT`; snapshot/status/audit roll back together.
- Error contract: `400 INVALID_REQUEST`, `404 REPORT_NOT_FOUND`, `409 REPORT_EDIT_CONFLICT`, `409 REPORT_STATE_CONFLICT`, `422 REPORT_SOURCE_INVALID`, and `400 REPORT_PART_REVISION_INVALID`.
- Audit contract: successful mutation and AuditLog commit together; failed or stale mutations create no success audit.

## Migration Decision

- Required: NO.
- Reason: `analysis_report.updated_at`, unique snapshot `report_id`, existing transactions, and conditional updates are sufficient. A new integer version column is explicitly out of this design freeze.

## Proposed Implementation Phases

- Phase 1: freeze the design and mutation contracts.
- Phase 2: implement report edit/delete service transactions.
- Phase 3: integrate lifecycle CAS and stable error mapping.
- Phase 4: add PostgreSQL 16 concurrency and rollback evidence.
- Phase 5: integrate routes/UI and run permission regression.
- Phase 6: runtime acceptance and Formal Closure.

## Expected File Changes

### Required

- `src/app/api/reports/route.ts`
- `src/lib/report-workflow.ts` or a report mutation service
- report lifecycle route error mapping
- report GET/read mapping assertions
- report contract/service tests
- PostgreSQL concurrency helper/tests
- SPEC-001-F verification and Closure documents
- `docs/CURRENT_STATE.md`

### Possible

- `src/components/reports/ReportView.tsx`
- permission regression tests
- CI test registration

### Must Not Change

- `prisma/schema.prisma`
- existing migrations
- SPEC-001-E Closure
- frozen report role matrix
- lifecycle state set
- FLOW-001
- SPEC-001-G, SPEC-002
- UI-01 through UI-13
- production database or Railway settings

## Status

- SPEC-001-F: DESIGN FROZEN / IMPLEMENTATION NOT STARTED
- REPORT-001: OPEN / BLOCKING
- Phase 0 Audit: COMPLETE
- Phase 1 Design Freeze: COMPLETE
- Phase 2: NOT STARTED
- SPEC-001 overall: OPEN
- SPEC-001-G: NOT STARTED
- SPEC-002: NOT STARTED
