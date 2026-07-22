# SPEC-001-F Report Publication Consistency

- Status: DESIGN FROZEN / PHASE 2 IMPLEMENTED; ROUTE INTEGRATION NOT STARTED
- Blocking issue: REPORT-001
- Authoritative baseline: `1ed92bbb8fcc8de2b12b6cc22d18752256028c07`
- Current authoritative next stage: SPEC-001-F
- Supersedes: the historical `E -> G -> F` execution-order recommendation in `SPEC-001-REMAINING-BLOCKERS-REVIEW.md`
- Does not modify the historical review document
- SPEC-001 overall: OPEN
- SPEC-001-G: NOT STARTED
- SPEC-002: NOT STARTED

## Frozen Problem Boundary

REPORT-001 is limited to:

1. Draft edit versus submit-review TOCTOU.
2. Draft edit versus publish TOCTOU.
3. Draft delete versus lifecycle transition TOCTOU.
4. Silent last-write-wins for double edit.
5. Missing real PostgreSQL concurrency evidence for double publish.
6. Missing atomicity proof for report content, source context, links, status, snapshot, and AuditLog.
7. Possible divergence between the published current row and publication snapshot.

The SPEC does not redesign all report functionality, the lifecycle state machine, permissions, FLOW-001, UI-01 through UI-13, SPEC-001-G, or SPEC-002.

## Frozen Lifecycle and Permissions

States remain `draft`, `reviewing`, `published`, legacy archived, and unknown. Allowed transitions remain:

```text
draft -> reviewing -> published
             |
             v
           draft
```

Only `admin` and `quality_manager` may create, edit, delete, submit, return, or publish. `inspector` and `engineer` may read published reports only. `viewer` is denied and anonymous access returns 401.

## Frozen Concurrency Strategy

SPEC-001-F uses existing `analysis_report.updated_at` as the optimistic concurrency value. No version column is added and no Migration is created.

Edit requests use `PUT /api/reports` and require `expected_updated_at` as a JSON body field. Delete requests use `DELETE /api/reports?id=<report_id>&expected_updated_at=<rfc3339>` and require `expected_updated_at` as a query parameter. Neither endpoint may obtain a missing token from a query, header, or server-side current value, and legacy requests without the token must not continue. The value is an RFC3339 timestamp with timezone offset. A missing or invalid value returns `400 INVALID_REQUEST`; a stale value returns `409 REPORT_EDIT_CONFLICT`; a non-draft state returns `409 REPORT_STATE_CONFLICT`.

For edit and delete, the transaction applies this fixed decision order: invalid or missing request fields, then report existence, then current state, then stale timestamp, then mutation. Thus a non-draft report returns `REPORT_STATE_CONFLICT` even when the supplied timestamp is stale.

Submit, return, and publish load both status and `updated_at`, then condition the final state write on the loaded status and timestamp. A failed condition returns `409 REPORT_STATE_CONFLICT`.

## Frozen Transaction Boundaries

Edit must validate source context and released part revisions inside one transaction, then conditionally update scalar content, source context, and part-revision links and write UPDATE AuditLog using the same transaction client. Every successful edit, including a link-only edit, advances `analysis_report.updated_at` and returns the committed timestamp. A failed link replacement rolls back links, timestamp, content, source context, and audit together.

Delete must conditionally delete only a draft with the expected timestamp, delete its links, and write DELETE AuditLog in the same transaction.

Publish must conditionally move reviewing to published before creating the snapshot, then create the immutable snapshot and PUBLISH AuditLog in the same transaction. Snapshot uniqueness remains a secondary database safeguard, not the primary concurrency mechanism.

## Frozen Published Read Authority

The current `analysis_report` row remains authoritative for GET/API/UI reads. The publication snapshot is immutable publication evidence. After publish, automated verification must prove equality of:

- published scalar content and `content_snapshot`;
- `source_context` and `source_snapshot`;
- current part-revision links and snapshot part-revision IDs.

Published edit and delete must fail, and no lifecycle transition may return a published report to draft or reviewing.

## Frozen Error Contract

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Missing or invalid request field, including `expected_updated_at` |
| 404 | `REPORT_NOT_FOUND` | Report does not exist |
| 409 | `REPORT_EDIT_CONFLICT` | Stale edit/delete timestamp or double-edit conflict |
| 409 | `REPORT_STATE_CONFLICT` | Lifecycle state changed during the transaction or duplicate publish |
| 422 | `REPORT_SOURCE_INVALID` | Invalid source context or source scope |
| 400 | `REPORT_PART_REVISION_INVALID` | Missing, duplicate, nonexistent, or unreleased revision |

Chinese error messages may remain, but API responses must include stable `code` values and must not expose Prisma P2002/P2025 details.

## Frozen Audit Contract

Successful Edit, Delete, Submit, Return, and Publish operations write AuditLog in the same transaction as the business mutation. Business failure or audit failure rolls back the complete operation. Stale and state-conflict attempts do not create successful mutation audit records. Create audit atomicity is not expanded by this SPEC without a separate approved decision.

## Frozen Verification Matrix

Required contract/service coverage:

- missing or invalid `expected_updated_at`;
- stale PUT and DELETE;
- non-draft PUT and DELETE;
- invalid source context and part revision;
- workflow error mapping;
- scalar/source/link/audit transaction rollback.

Required PostgreSQL 16 concurrency coverage:

1. edit vs submit;
2. edit vs publish;
3. delete vs submit;
4. delete vs publish;
5. edit vs edit;
6. publish vs publish;
7. link replacement rollback;
8. AuditLog rollback.

Each scenario must record control/barrier point, success and failure transaction counts, HTTP/domain code, final status and timestamp, content, source context, links, snapshot count, and audit count.

Published invariant checks must cover current row/snapshot equality, rejection of published edit/delete, current-row GET/UI behavior, and immutable legacy archived behavior.

## Migration Decision

- Migration required: NO.
- Prisma Schema change: NO.
- Existing Migration modification: FORBIDDEN.

The existing `updated_at`, unique snapshot `report_id`, transactions, and conditional writes are sufficient for this design. A future request for a dedicated integer version column is a separate decision and is not part of SPEC-001-F.

## Implementation Phases

Phase 2 implementation status at the Phase 2 handoff: **COMPLETE** for the report mutation service and service-level tests. Route integration, lifecycle CAS integration, and PostgreSQL concurrency evidence remain pending in later phases.

- Phase 1: Design Freeze and contracts — becomes COMPLETE and repository-authoritative only after this document and the Phase 0 audit are merged into `main`.
- Phase 2: Report edit/delete service and transaction implementation — NOT STARTED.
- Phase 3: Lifecycle CAS integration and error mapping — NOT STARTED.
- Phase 4: PostgreSQL concurrency and rollback evidence — NOT STARTED.
- Phase 5: Route/UI integration and permission regression — NOT STARTED.
- Phase 6: Runtime acceptance and Formal Closure — NOT STARTED.

## Closure Boundary

SPEC-001-F may not close until REPORT-001 concurrency, transaction atomicity, current-row/snapshot invariants, stable error mapping, PostgreSQL 16 evidence, and frozen permission regression all pass. No claim of implementation, runtime PASS, or SPEC closure is made by this design document.
