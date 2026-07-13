// Testes de FRONTEIRA ARQUITETURAL — leem o código-fonte e verificam as regras
// de dependência das camadas (estáticos, sem executar a app):
//   1. Domain NÃO depende da Application.
//   2. Application depende do Domain.
//   3. Application depende apenas de abstrações (sem Supabase/Next/HTTP/infra).
//   4. Nenhum Use Case tem lógica de infraestrutura.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dirApp = dirname(fileURLToPath(import.meta.url)); // src/application
const dirDominio = join(dirApp, "..", "domain");

function listarFontes(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...listarFontes(caminho));
    } else if (nome.endsWith(".ts") && !nome.endsWith(".test.ts")) {
      saida.push(caminho);
    }
  }
  return saida;
}

/** Especificadores de módulo de todos os import/export ... from "...". */
function especificadores(conteudo: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)[^"']*?from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo)) !== null) specs.push(m[1]);
  return specs;
}

const fontesApp = listarFontes(dirApp);
const fontesDominio = listarFontes(dirDominio);

test("1. Domain NÃO depende da Application", () => {
  for (const arquivo of fontesDominio) {
    for (const spec of especificadores(readFileSync(arquivo, "utf8"))) {
      assert.ok(
        !spec.includes("application"),
        `${arquivo} importa a Application (proibido): ${spec}`,
      );
    }
  }
});

test("2. Application depende do Domain (usa o núcleo)", () => {
  const algumImportaDominio = fontesApp.some((arquivo) =>
    especificadores(readFileSync(arquivo, "utf8")).some((s) => s.includes("/domain/")),
  );
  assert.ok(algumImportaDominio, "Nenhum arquivo da Application importa o Domain.");
});

test("3. Application depende apenas de abstrações (sem infra concreta)", () => {
  const proibidos = ["supabase", "infrastructure", "next", "react", "/app/", "/lib/", "node:http", "axios"];
  for (const arquivo of fontesApp) {
    for (const spec of especificadores(readFileSync(arquivo, "utf8"))) {
      for (const proibido of proibidos) {
        assert.ok(
          !spec.includes(proibido),
          `${arquivo} importa dependência proibida (${proibido}): ${spec}`,
        );
      }
    }
  }
});

test("4. Nenhum Use Case/Service tem lógica de infraestrutura", () => {
  const arquivos = [
    ...listarFontes(join(dirApp, "use-cases")),
    ...listarFontes(join(dirApp, "services")),
  ];
  const tokensInfra = ["process.env", "fetch(", "createClient", "XMLHttpRequest", "supabase", "require("];
  for (const arquivo of arquivos) {
    const conteudo = readFileSync(arquivo, "utf8");
    for (const token of tokensInfra) {
      assert.ok(!conteudo.includes(token), `${arquivo} contém token de infraestrutura: ${token}`);
    }
  }
});
