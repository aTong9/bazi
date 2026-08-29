# ADR-PERF-001: Performance and stability budgets

- Status: Accepted
- Date: 2026-08-29

## Context

The authoritative matrix defines PF-004, PF-005, and PF-010 as timed gates but does not provide numeric thresholds. A release gate cannot rely on an unspecified “target time”. The runtime snapshot contains 10,918 records and is local-first.

## Decision

On the supported Node.js range and a local SSD, using the locked 10,918-record snapshot:

- opening and validating an already-built cold snapshot: at most 1,000 ms;
- 1,000 paginated module/output-slot queries against an open snapshot: at most 1,000 ms;
- validating 1,000 complete relationship responses: at most 3,000 ms;
- executing 100 isolated analysis requests against one immutable snapshot: at most 10,000 ms.

Benchmarks use monotonic time, report observed duration, and fail on correctness before considering latency. Snapshot compilation/import is tested separately because it verifies source hashes and rebuilds SQLite; it is not part of request latency.

## Consequences

The thresholds are deliberately broad enough for developer laptops and strict enough to catch accidental per-request catalog rebuilds, unbounded scans, or repeated Schema compilation. A future production target may tighten them with host-specific CI baselines, but must not silently relax them.
