# OpenAI Realtime Tau-Style Voice Eval Plan

## Goal

Build a local, eval-focused voice simulation harness in promptfoo that is inspired by Tau-Bench, targets OpenAI realtime audio models, stores useful artifacts for debugging and grading, and works entirely inside this repository.

## Success Criteria

- Local simulated-user turns run in-process without Promptfoo's remote generation service.
- OpenAI realtime provider accepts audio input envelopes and returns normalized audio, transcript, tool-call, and timing artifacts.
- A Tau-style voice eval provider can run multi-turn voice interactions against a target provider.
- Eval outputs can be graded with existing assertions, especially `llm-rubric`, trajectory assertions, and trace assertions.
- Examples, tests, and docs cover the main workflow.
- End-to-end QA runs against real OpenAI APIs using a local `.env` file outside this repository.

## Scope

### Phase 1: Foundation

- [x] Refactor simulated-user provider plumbing so local providers can generate user turns.
- [ ] Define a reusable voice trajectory metadata shape for multi-turn evals.
- [ ] Align the OpenAI realtime provider with current audio input/output handling.

### Phase 2: Harness

- [ ] Add a Tau-style voice eval provider that orchestrates simulated user text, TTS, realtime target calls, transcripts, and stop conditions.
- [ ] Persist normalized artifacts in `metadata.messages` and `metadata.voiceTurns`.
- [ ] Emit trace spans and useful metadata for assertions and debugging.

### Phase 3: Grading

- [ ] Ensure the final provider response works with `llm-rubric`.
- [ ] Ensure trajectory and trace assertions can evaluate the voice run.
- [ ] Add helper metadata that makes transcript- and trace-aware grading straightforward.

### Phase 4: Validation

- [ ] Add unit tests for local simulation and realtime artifact normalization.
- [ ] Add example configs for OpenAI realtime voice evals.
- [ ] Run lint, format, targeted tests, and at least one end-to-end eval using a local API key source.

## Implementation Notes

- Start with half-duplex turn-taking rather than full-duplex orchestration.
- Reuse promptfoo tracing, eval UI, and assertion infrastructure instead of building parallel systems.
- Preserve backward compatibility where practical, especially around existing simulated-user configs.
- Keep raw audio/transcript payloads out of git history and plan updates.

## Progress Log

### 2026-03-19

- Created feature branch `feature/openai-realtime-tau-voice`.
- Completed repo, Promptfoo, pc, Tau-Bench, and OpenAI docs scan.
- Identified main gaps: simulated-user is remote-bound, realtime provider needs protocol alignment, and the voice eval harness needs a local Tau-style orchestrator.
- Added shared Tau simulator prompt helpers in `src/providers/tauShared.ts`.
- Updated `promptfoo:simulated-user` to support a nested local `userProvider` while preserving the remote hosted default.
- Added registry support for resolving nested providers in simulated-user configs.
- Added and passed targeted tests for local simulated-user execution.
