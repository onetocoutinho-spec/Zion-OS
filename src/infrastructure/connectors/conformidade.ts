// Suíte de conformidade do SDK (003 §Riscos: "contract tests que todo conector passa").
//
// Verifica que os METADADOS declarados por um conector são coerentes com seu
// tipo: limites válidos + capacidades mínimas presentes. É lógica pura (sem I/O),
// usada tanto por testes quanto pelo registro de conectores (PR futuro), para
// impedir que um conector divergente entre no runtime.

import type { Resultado } from "./shared/resultado.ts";
import { ok, falha } from "./shared/resultado.ts";
import { erroConfig } from "./shared/erros.ts";
import { suporta, type Capacidade } from "./shared/capacidades.ts";
import { limitesValidos } from "./shared/limites.ts";
import type { MetadadosConector, TipoConector } from "./shared/tipos-conector.ts";

/** Capacidades mínimas que cada tipo de conector precisa declarar para ser útil. */
export const CAPACIDADES_MINIMAS: Record<TipoConector, readonly Capacidade[]> = {
  origem: ["ingerir"],
  erp: ["ler_estoque", "propagar"],
  marketplace: ["publicar"],
};

export function verificarConformidade(metadados: MetadadosConector): Resultado<MetadadosConector> {
  if (!limitesValidos(metadados.limites)) {
    return falha(erroConfig("limites_invalidos", "Limites do conector inválidos (devem ser > 0)."));
  }
  for (const capacidade of CAPACIDADES_MINIMAS[metadados.tipo]) {
    if (!suporta(metadados.capacidades, capacidade)) {
      return falha(
        erroConfig(
          "capacidade_ausente",
          `Conector do tipo '${metadados.tipo}' deve declarar a capacidade '${capacidade}'.`,
        ),
      );
    }
  }
  return ok(metadados);
}
