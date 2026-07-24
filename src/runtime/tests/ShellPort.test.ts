// ShellPort (ENG-005) — publica RuntimeEvents; nunca importa React (Lei 14).
// Rodar: npx tsx --test src/runtime/tests/ShellPort.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { ShellPort } from "../ports/ShellPort.ts";
import type { RuntimeEvent } from "../contracts/runtime.ts";

test("um adaptador de captura satisfaz ShellPort e coleta os eventos", () => {
  const seen: string[] = [];
  const port: ShellPort = { publish: (e: RuntimeEvent) => seen.push(e.type) };
  port.publish({ type: "DecisionCreated", timestamp: 0 });
  port.publish({ type: "CapabilityRequested", timestamp: 1 });
  assert.deepEqual(seen, ["DecisionCreated", "CapabilityRequested"]);
});
