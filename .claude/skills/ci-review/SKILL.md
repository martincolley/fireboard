---
name: ci-review
description: Run focused validation and one exact-head independent technical review on a draft pull request before functional review, using the available review adapter.
---

# CI Review

Open the work-in-progress draft pull request first. Run this once after substantial work is complete
and before marking that draft ready. Rerun it only if the pull-request scope later grows
substantially. Ordinary fixes for findings do not require a workflow rerun; when they change the PR
head, extend the existing technical review evidence chain as described below.

## Pin the review target

Before validation or review:

1. Resolve the draft PR's current `headRefOid` and base branch from GitHub.
2. Confirm the current isolated worktree is clean and its `HEAD` equals that `headRefOid`.
3. Stop on a branch, SHA, worktree, or PR mismatch. Do not review the current checkout merely because
   the prompt names a different PR, and do not silently detach or switch a shared checkout.
4. Compute changed files from the PR base/merge base to the exact PR head. Never use a direct diff
   from a stale feature branch to a newer base when that makes unrelated upstream work appear as
   additions or deletions.

Record the PR URL, base, and full head SHA with the validation and review evidence. Re-resolve the PR
head immediately before marking the result complete; a changed head invalidates stale exact-head
evidence.

## Validate

Identify changed paths and intended behavior, then run the checks in `CLAUDE.md` (Tooling):
`npx oxlint`, `npx oxfmt --check` on changed files, `npm run typecheck`, and the directly relevant
`npm test` specs. Reuse checks already recorded for this exact candidate and scope; rerun only
missing or invalidated proof. Changes to `server/middleware/localOnly.ts`, write routes, `/mcp`,
credential handling or the anonymizer are security-sensitive and need explicit review coverage.

## Test-evidence audit

Before independent technical review, audit every new or materially changed test against the
testing rules in `CLAUDE.md`, reusing the implementation's plan and proof. Record a compact result
in the existing task/PR evidence (group tests only when the same rationale applies):

- inputs/setup reach the relevant behaviour (the changed branch for regressions) in the real
  implementation, not an earlier guard or mock;
- for regression tests, the counterfactual fails for the reported defect and the candidate passes;
  distinguish observed execution from a justified branch/assertion trace and preserve any limitation.
  For non-regression coverage, record the protected risk/contract; a pre-fix failure is not required;
- assertions prove meaningful domain outcomes, not incidental calls or implementation structure;
- fakes/mocks preserve the dependency semantics on which those assertions rely;
- existing coverage is reused, extra layers protect distinct material failures, and scope is
  proportional to risk rather than test counts or line ratios.

Mark invalid or missing evidence `changes required` and return the smallest correction to the
implementation owner before independent review. Passing test counts cannot override this result.
A justified counterfactual trace is not an observed pre-fix run; if it cannot establish the claimed
regression protection, require stronger proof. Record `not applicable` with a reason when no tests
are new or materially changed; missing coverage for material risk remains part of technical review.

## Review

Use one independent technical review evidence chain for the PR head. Record the reviewer/session,
base, full head, covered range, result and findings in the existing task/PR evidence. Never substitute
implementer self-review. Choose the available adapter, not a new service:

**Codex:** use the built-in dedicated review (`codex review --base <PR-base>` or
`/review` against that base) from the pinned clean checkout; record the resolved base/merge-base
and head before and after the run. `--commit` alone covers only that commit, not a multi-commit PR.
For ordinary follow-up fixes, review against the previously reviewed ancestor and retain its receipt
so the chain covers the whole PR.

**Claude Code:** use a fresh review-only session or independent subagent with this skill, the pinned
range, source/expectation and evidence references. Restrict it to reading the candidate and evidence;
do not reuse the implementation conversation. A fresh read-only Codex session is likewise valid.
For either session adapter, require a whole-PR initial receipt; follow-up reviews cover the delta
from its reviewed ancestor and retain that baseline receipt. Reject unrelated/mismatched baselines.
If no independent review capability is available, keep the gate blocked and request a reviewer from
the delivery owner (or the user when no manager exists).

The operating agent then verifies the independent findings against the exact checkout;
that verification is local CI Review inspection, not a second broad technical review. Inspect
the completed diff and relevant surrounding code for:

- security and authorization defects;
- correctness, regressions, and error-handling gaps;
- missing focused verification for material risk.

Independently verify each finding against the current code. Fix confirmed defects and rerun only the
affected checks. If fixes create a new PR head and exact-head review evidence is required, extend the
same review chain using the runtime's follow-up route above; do not rerun the whole `/ci-review`
or start a second full review for ordinary fixes.

## Report

Report to the operating agent:

- each validation check as pass or fail;
- test-evidence audit disposition, proof references and counterfactual limitations;
- confirmed findings and fixes;
- dismissed findings with a short reason;
- the PR head SHA and whether independent review evidence was reused, extended, or freshly run;
- whether the candidate is technically viable, with any remaining blocker.

After a successful technical receipt, hand the exact candidate and existing evidence to an
independent reviewer following `../functional-review/SKILL.md`. The delivery owner must arrange
this handoff before readiness or human acceptance; if independent review is unavailable, report the
exact need to the delivery owner (or user without a manager) and keep readiness blocked. Technical success alone is not
functional approval. Do not run another broad technical review for this handoff.

This command does not open or update a pull request, change readiness, merge, deploy, or mutate
repository rules.
