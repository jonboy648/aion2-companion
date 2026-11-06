# Allocation Resource Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** expose honest resource accounting before same-gear redistribution.
**Architecture:** a pure model inspector returns a JSON ledger through the
existing level_progression API; existing optimizer behavior remains unchanged.
**Tech Stack:** existing Python dataclasses, pytest and browser bundler.
**Spec:** ../specs/2026-10-29-allocation-resource-preflight.md

## Global constraints

No new dependencies, raw exports, secret values, made-up wallets/refunds/fees,
or changes to the pending c62d41d release branch. API changes are additive.

## Review focus

1. Reported/bonus ranks must not become confirmed refundable points.
2. Missing paid acquisition rows must not become zero-cost purchases.
3. Chain children must not duplicate the parent's rank cost.
4. Node currencies, connectivity and free starts must remain distinct.
5. Unknown/illegal/regional inputs must remain explicit, never clamped silently.

### Task 1: Cost ledger at the existing API seam

Files: create app/aion2c/allocation_resources.py and app/tests/test_allocation_resources.py;
modify app/aion2c/webapi.py and web/scripts/bundle_engine.py.

- [x] Baseline: existing tests/test_webapi.py, 19 passed (78.40s).
- [x] One RED/GREEN slice: ranks 8+5 cost 18 skill; stigmas 3+6 cost 10;
  bonus ranks add nothing; absent spare points remain unknown; refunds stay unknown.
- [x] One RED/GREEN slice each: chain ownership; unknown/over-cap ranks;
  acquisition and level gates; separate node currencies/free starts;
  unknown/disconnected/locked nodes; invalid and unknown unspent values.
- [x] Verify input immutability and unchanged existing API fields.
- [x] Add module to explicit Qt-free allowlist, regenerate bundle, run import/parity checks.
- [x] Independent review, reproduce/fix valid findings and rerun affected checks.
- [x] Record exact completed scope and remaining redistribution provenance work.

Verification: 117 passed / 1 skipped on the affected API, progression, budget,
bonus-rank, stat-sheet and browser-import suites. Strict 9,318-page build passed in
an isolated output directory. Independent Dodge acquisition-row issue reproduced
RED and fixed GREEN; final bounded review clean. This prerequisite is complete;
the actual full redistribution optimizer/workspace is not.
