# Lightweight CQRS foundation

## Decision

Introduce CQRS incrementally inside the existing Express application. Keep the current Supabase/Postgres database and current HTTP routes. This is **CQRS without event sourcing**: current database rows remain the source of truth. Do not add an event store, read database, message broker, snapshots, or compaction in this phase.

CQRS separates the write/command path from the read/query path; it does not require separate databases or an event log. See [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/cqrs-pattern.html) and [Martin Fowler's CQRS overview](https://martinfowler.com/bliki/CQRS.html).

## Guardrails

- Keep changes on a feature branch; do not deploy or merge to production without explicit approval.
- Preserve existing API routes and response shapes as compatibility adapters.
- Preserve assessment timing, scoring, question grouping, page review, and navigation.
- Keep all assessment scoring and submission validation server-authoritative.
- Do not run database migrations or mutate live data as part of the initial refactor.
- Do not introduce new Supabase tables until a concrete requirement needs them.
- No paid AI services, external message broker, or separate read database.
- Keep student assessment writes on their current reliable path; begin with admin question-bank operations.

## Proposed structure

```text
server/
  application/
    commands/
      createQuestion.js
      updateQuestion.js
      updateStimulusGroup.js
    queries/
      getQuestionBank.js
      getQuestionAnalytics.js
  infrastructure/
    supabase/
      questionBankRepository.js
```

The existing `server.js` routes will continue to handle HTTP, authentication, input parsing, status codes, and response formatting. They will delegate the business/data operation to one command or query handler. The handlers will use the existing Supabase client through a small repository boundary.

## Rollout sequence

1. Add the CQRS structure and unit tests without changing API behaviour.
2. Extract the question-bank GET route into a query handler; compare response shape and ordering.
3. Extract question create/update/group writes into command handlers, preserving validation and existing response codes.
4. Extract analytics into a query handler only after the read behaviour is covered by tests.
5. Add a small domain-event/outbox mechanism only if there is a real consumer that needs reliable asynchronous processing. If required, first inspect Supabase/Postgres transaction capabilities and ensure the state change and event record are atomic.
6. Add read projections only when measured query latency or reporting load justifies them.

## Event history and storage

This phase does not need snapshots or event compaction. If an outbox is added later, it should contain small event metadata and identifiers rather than duplicate full question payloads. Define retention and audit requirements before deleting or compacting anything. Monitor the actual database size before expanding storage use.

## Acceptance checks

- Existing route URLs and response JSON remain compatible.
- Existing tests pass; add focused handler tests.
- No frontend flow, question grouping, timer, scoring, or assessment persistence behaviour changes.
- No production deployment, live schema migration, or destructive data operation occurs during this work.
