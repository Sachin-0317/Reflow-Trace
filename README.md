# RE:FLOW — TRACE (Phase 1 dashboard prototype)

Night Ops control-room UI for the menstrual-waste chain-of-custody system. React + TypeScript + Vite, hand-rolled SVG charts, Zustand store. All data is simulated in memory.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

Sign in with "Enter demo as" on the login screen. Use the avatar menu (top right) to switch roles, open the Scenario Director or the Judge Q&A. `Ctrl+K` opens the command palette. The public disposer page is `/p/DP-B-01`.

## What is real and what is not

- Rules engine (`src/engine/reconcile.ts`) is real: step-to-step and end-to-end variance against a configurable tolerance, timing windows, and the verified / attested / discrepancy / pending verdict.
- Fixtures (`src/data/fixtures.ts`) are simulated. The mode chip reads SIM, and DEMO once the Scenario Director injects batches.
- No backend, no auth, no ESP32 ingest, no camera scan. Handoff has manual entry and a simulated scan list. Evidence photos are placeholders.
- The audit log is append-only in the UI but is not hash-chained, and says so.
- Tamil covers navigation, status labels and the public page. Other screens are English.
