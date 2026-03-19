# openai-realtime-tau-voice (OpenAI Realtime Tau Voice Eval)

You can run this example with:

```bash
npx promptfoo@latest init --example openai-realtime-tau-voice
cd openai-realtime-tau-voice
```

This example demonstrates a local, Tau-style voice eval loop built entirely inside promptfoo:

- `promptfoo:tau-voice` generates the next simulated user turn locally
- `initialMessages` seeds an opening assistant greeting so the simulator starts from the user side
- `openai:speech:gpt-4o-mini-tts` synthesizes user audio
- `openai:realtime:gpt-realtime` answers as the voice agent
- `turn_detection: null` keeps the target in half-duplex mode for synthesized eval turns
- `llm-rubric` grades the final transcript
- trajectory assertions verify the tool path from the trace using stable, ASR-tolerant fields

## Setup

1. Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your_api_key_here
```

2. Run the eval:

```bash
promptfoo eval --no-cache
```

3. Inspect the result in the UI:

```bash
promptfoo view
```

The example enables Promptfoo tracing, so you can inspect the voice run, tool spans, transcripts, and latencies directly in the trace timeline. It uses promptfoo's local tracing path, so you do not need to start a separate OTLP receiver for the built-in providers in this example.

## What this example covers

- Local simulated-user generation with `openai:chat:gpt-4.1-mini`
- User text-to-speech with `openai:speech:gpt-4o-mini-tts`
- Realtime audio turns with `openai:realtime:gpt-realtime`
- Per-turn transcript and audio metadata in `metadata.voiceTurns`
- `llm-rubric`, `trajectory:tool-used`, `trajectory:tool-args-match`, and `trajectory:tool-sequence`

## Files

- `promptfooconfig.yaml`: Tau-style voice eval config
- `functions/`: Mock airline tool schemas used by the realtime target
- `callbacks/airline-functions.js`: Mock tool implementations

## Learn More

- [Tau Voice provider docs](https://promptfoo.dev/docs/providers/tau-voice/)
- [OpenAI provider docs](https://promptfoo.dev/docs/providers/openai/)
- [Tracing docs](https://promptfoo.dev/docs/tracing/)
