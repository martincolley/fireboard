---
name: functional-review
description: Independently verify intended user outcomes after successful exact-head CI Review, return pinpoint gaps, and recheck only impacted clauses before readiness.
---

# Functional Outcome Review

The delivery order is: lightweight expectation framing → implementation and focused self-checks →
technical `/ci-review` → independent functional outcome review → authorized delivery → observed
feedback. This skill is the functional gate, not another technical review or permission to merge,
deploy, publish, or accept risk.

## Canonical inputs, prepared during normal implementation

Use the existing Task/Delivery Unit or delivery system's contract and evidence records, not a new
state store. Without a delivery platform, use the existing issue/task and PR description/comments:
source reference, expectation version and clause IDs, decisions, proof links and review receipts.
Before a PR exists, keep the expectation in that task or the working task note, then link it from the
PR; do not create a parallel tracker.
Preserve the raw request, reports, reporter comments and supplied evidence verbatim in
one source record with its original audience. Link rather than copy private sources into PRs or
public artifacts. Keep a separate compact versioned expectation, with stable clause IDs, describing
intended actors, entry points and observable outcomes. Distinguish observed facts, supported
inferences (with references), assumptions and unresolved product choices. A vague report is not a
complete specification. Research only enough to establish the next action; do not invent intent.

Record discoveries and expectation deltas with their evidence and decision references. Clarifying
an evidenced path is not authority to remove a requested outcome or add an unapproved feature.
Route genuine scope/product choices to the authorized decision maker before implementing them.
Before CI, do only this framing, implementation and the normal focused acceptance checks, not an
independent review. Existing approved contracts and evidence are reused, not reconstructed.

## Start only after technical success

The implementation owner supplies references to the source, current expectation/version, explicit
scope decisions, PR/base/full head SHA, successful exact-head CI Review and its independent review chain,
changed paths and existing behavioral proof. Resolve the actual PR head and clean checkout; stop
on a repository, branch, SHA or evidence mismatch. A technical failure returns to implementation
before this review starts.

Use one reviewer independent of implementation (a separate review session or an existing independent
delivery reviewer). Use a fresh read-only Codex session (`codex exec --sandbox read-only`) or
Claude Code review-only session/subagent, supplied this skill and the handoff references. Restrict
the reviewer to reading the candidate/evidence; never resume the implementation conversation.
The implementation owner cannot self-attest independence. The delivery owner arranges that session
or requests an independent reviewer from the manager/user when the runtime cannot. If none is
available, record the exact missing capability and owner as a blocker; do not mark the gate passed
or PR ready. Do not launch a second broad technical review to stand in for functional review.

## Review the outcome, not the author's summary

Read the source and expectation against the actual candidate and observed evidence. Identify each
change claim, including mixed requests and grouped sources in one PR; do not accept a single author
classification as coverage. Trace the relevant actors, entry points, successful and failed paths,
state transitions, dependencies, side effects and boundaries. Follow newly discovered impacts far
enough to decide whether intended users can achieve the complete outcome, not merely click the
changed control. Check for missed expectations, silent narrowing and unapproved expansion.

Compare requested versus implemented outcomes and trace paths/unknowns internally. When a flow
map is already required or available, link its revision and verify its claims; a map URL or lack of
warnings is not proof.

Reuse current CI and behavioral evidence after checking its revision, provenance, observed result
and coverage against the relevant clause. Read the candidate's relevant paths to challenge claims;
do not rubber-stamp an implementer checklist. Perform new verification only for a material gap or
invalidated proof. Use applicable actor/access, lifecycle, shared-consumer, legacy or platform
boundaries, not blanket matrices or exhaustive hypothetical investigation. Workflow-only changes
can be proved with concise scenario traces through their actual entrypoints; UI changes retain
repository-required isolated-browser evidence. Do not repeat the broad correctness/security pass.

Passing test counts alone are not outcome proof. Preserve CI Review's test-evidence limitations
when judging clause coverage; route missing technical test-evidence validation back to CI Review
instead of repeating its audit here.

## Decision and correction loop

Record one compact receipt in the existing delivery evidence: reviewer/session, repository, PR and
full candidate SHA, expectation version, technical evidence references, clause outcomes and proof
references, plus explicit unknowns. Return `pass`, `changes required` or `blocked`. A material
unknown about acceptance, authorization/privacy, data integrity or release safety blocks readiness;
non-blocking residual uncertainty needs its impact and owner, not an assertion of completeness.

For each rejected clause use only:

- **Expected:** clause/source reference and intended outcome.
- **Observed:** actual candidate behavior and evidence reference.
- **Gap:** precise mismatch or missing proof.
- **Impact:** affected actor/path or consequence.
- **Required proof:** smallest observation that can close it.

Routine reversible corrections go to the implementation owner without a permission round trip.
Only genuine product ambiguity, scope choice or risk acceptance goes to the user as one pinpoint
question. Do not edit the expectation to make a failed implementation pass. Scope changes require
the explicit authorized decision, retained with the previous version.

After fixes, rerun affected checks. A new head invalidates the old candidate approval: extend the
existing independent technical review chain when required by `/ci-review`, rather than
rerunning the whole CI workflow for ordinary fixes. After technical success, the independent
reviewer rechecks rejected and newly invalidated clauses only. Carry unaffected proof forward with
an explicit relevance justification in a new receipt bound to the new head and expectation version.
Newly discovered material impacts join that delta. No blanket restart or stale approval survives.

Immediately before readiness or human acceptance, re-resolve the PR head and current expectation
and require matching successful technical and functional receipts with no open blocking clauses.
A changed PR head/expectation returns to affected validation. Existing human approval and release
authority remain separate gates. This is a PR delivery gate before readiness/merge, not a
requirement to audit historical PR receipts or map reviewed heads/squash commits during deployment.

Stop when the acceptance evidence is sufficient. If repeated attempts add no new evidence or
progress, record the concrete blocker, attempted correction and next owner/action rather than
spinning. Use references and delta-only updates, not repeated source dumps, parallel reviewers by
default, arbitrary time boxes or filler reports.

## Authorized delivery and feedback

This section adds no release authority or PR-review prerequisite to deployment. Deployment consumes
main independently of the PR review workflow; preserve its existing candidate-change safeguards,
checks and authorization. Within an already authorized live-verification operation, record the
actual release revision/receipt and exercise affected outcomes and changed dependencies
proportionally, reusing valid proof. A deployment command's success or a login page alone does not
prove a changed end-to-end outcome. Do not audit historical PR approvals, reconstruct per-PR/squash
mappings, repeat outcome approval during release, or create indefinite monitoring.

Record any observed escape in the same source/evidence record: expected versus observed behavior,
affected release/PR, missed assumption or path, impact, and one targeted future detection rule.
Preserve the new raw report separately and link it to the expectation delta. Route the confirmed
failure back to its implementation owner and the bounded correction loop outside the deploy
command. Deploy itself stops with concise evidence when a source fix is needed; it does not
implement, re-review or restart delivery. The delivery owner records the learning feedback here
and obtains fresh authority for any new merge/deploy. Keep failed or unverified delivery gates open. Report what was actually
observed and residual uncertainty, never guaranteed completeness or an unsupported absence of
issues. Later reporter feedback uses the same loop, not an automatic unbounded investigation.
