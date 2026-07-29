# Roadmap

Application-specific plan. Model/dataset/training roadmap lives in
[intent-recovery-model](https://github.com/ThisIsJohnnyt/intent-recovery-model)'s
`training/ROADMAP.md` — not duplicated here.

## Current state

Split out from the original combined repository as its own project (see
[intent-recovery-model](https://github.com/ThisIsJohnnyt/intent-recovery-model)'s
`docs/decisions/PDR-003.md`). Consumes a versioned model release via
`scripts/fetch-model.mjs` rather than a committed model artifact.

## Near-term

- **Model version management**: currently fetches whichever release
  `scripts/fetch-model.mjs`'s default points at. Worth adding a way to
  request a specific release (already supported as a CLI arg) more visibly
  in the dev workflow, and to warn if the installed model's declared
  contract version doesn't match what this app supports.
- **Error messaging**: the app already surfaces an error rather than
  showing broken output when a model response doesn't conform to the
  inference contract (missing sections, empty narrative) — worth revisiting
  the actual user-facing copy for that state now that it's a documented
  contract requirement, not just an edge case.

## Later

- Packaging/deployment story beyond local dev (`npm run build`/`preview`) —
  not yet decided.
- Revisit whether a `confidence`/uncertainty field (proposed in the model
  repo's `v1.5` plan) changes anything on the display side, once that
  becomes part of the inference contract.

## Explicitly out of scope here

- Anything about dataset content, training, evaluation methodology, or
  model architecture — that's `intent-recovery-model`'s roadmap, not this
  one. If a roadmap item here starts describing training/dataset work,
  it belongs in the other repo instead.
