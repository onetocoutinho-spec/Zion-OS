// Teste do useShell (ENG-003) — porta de leitura, isolada.
// Rodar: npx tsx --test src/shell/hooks/useShell.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellProvider } from "../providers/ShellProvider.tsx";
import { useShell } from "./useShell.ts";

function Probe() {
  const s = useShell();
  return <span data-active={s.context.activeId} data-nav={s.navigation.length} data-mission={String(s.mission.active)} data-feedback={s.feedback.kind} />;
}

test("useShell: lança fora do ShellProvider (comunicação só por contrato)", () => {
  assert.throws(() => renderToStaticMarkup(<Probe />), /ShellProvider/);
});

test("useShell: dentro do provider expõe context/navigation/mission/feedback", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "hoje", label: "Hoje" }], initialContext: "hoje" }}>
      <Probe />
    </ShellProvider>,
  );
  assert.match(html, /data-active="hoje"/);
  assert.match(html, /data-nav="1"/);
  assert.match(html, /data-mission="false"/);
  assert.match(html, /data-feedback="idle"/);
});
