# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Phase 1 serves one technical owner. The owner creates bots and skills and
works with them on documents and designs.

## Product Purpose

The app gives the owner a place to work with AI role bots. The owner can
see their activity, control handoffs, and inspect the skills and costs
behind their work.

## Operating Context

Phase 1 runs on the owner's machine. The app stores conversations and
Libraries locally and calls configured model providers.

The owner works in conversations, groups them into projects, and
manages bots and versioned skills.

## Capabilities and Constraints

Bots have personas, models, and skills. The owner directs work through
mentions and approves handoffs. The app shows run activity and skill
provenance.

Phase 1 is for one human and has no login. Bots do not write application
code or run commands on the owner's machine.

See [the product brief](docs/requirements/product-brief.md) for the
complete scope, success measures, non-goals, and glossary.

## Evidence on Hand

- [Product requirements](docs/requirements/README.md)
- [Agreed component designs](docs/design/components/README.md)
- [Project status](docs/status.md)

## Product Principles

- Keep the owner in control of bot handoffs.
- Make bot activity and skill provenance visible.
- Let the owner configure bots and skills without changing code.
- Keep phase 1 local to the owner's machine.
