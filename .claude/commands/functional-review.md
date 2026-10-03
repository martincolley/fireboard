---
name: functional-review
description: Run independent functional outcome review after successful technical CI Review and before readiness or human acceptance.
user_invocable: true
---

Use `.claude/skills/functional-review/SKILL.md` and follow it completely for the PR and delivery
contract identified by `$ARGUMENTS`. This is also a required delivery handoff, not a user-operated
Flow step. If the current agent implemented the change, route to an independent reviewer through
the delivery owner (or user without a manager); never self-attest independence. Do not merge or deploy.
