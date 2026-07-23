// MissionProvider (ENG-004) — estado visual só; renderiza filhos, começa oculto.
// Rodar: npx tsx --test src/mission/tests/MissionProvider.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionProvider } from "../provider/MissionProvider.tsx";

test("MissionProvider renderiza os filhos", () => {
  const html = renderToStaticMarkup(<MissionProvider><i data-child="1" /></MissionProvider>);
  assert.match(html, /data-child="1"/);
});

test("MissionProvider aceita a porta onEvent injetada (DI) sem exigir Runtime", () => {
  const seen: string[] = [];
  const html = renderToStaticMarkup(
    <MissionProvider onEvent={(e) => seen.push(e.type)} now={() => 0}>
      <i data-child="2" />
    </MissionProvider>,
  );
  assert.match(html, /data-child="2"/);
  // sem interação no render estático, nenhum evento é emitido — a porta existe, não o EventBus.
  assert.equal(seen.length, 0);
});
