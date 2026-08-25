import type { SuiteResult } from '../report';
import { suiteOf } from '../report';

// Performance Certification — CATEGORIA NAO CERTIFICAVEL. Limitacao documentada, nunca inferida.
//
// Dois fundamentos independentes, cada um suficiente:
//
//   1. AUSENCIA DE ESPECIFICACAO (CERT-C2 — Specification Driven).
//      A Testing & Certification congelada (Compiler 017) exige testes de comportamento, de
//      determinismo, de invariantes, de erro/limite e de regressao (golden). Ela NAO exige testes de
//      performance, e nenhum pilar congelado declara requisito, orcamento ou limiar de desempenho.
//      Criar um teste de performance seria fabricar um criterio que nenhuma especificacao exige —
//      exatamente o que a CERT-C2 proibe.
//
//   2. IMPOSSIBILIDADE SOB CERT-C4 (Deterministic Certification).
//      Medir desempenho exige dependencia de relogio e de ambiente. A CERT-C4 proibe ambos
//      ("Nao utilizar: dependencia de relogio; dependencia de ambiente") porque a mesma suite sobre a
//      mesma implementacao deve produzir EXATAMENTE o mesmo relatorio — o que uma medicao temporal,
//      por natureza, nao pode garantir.
//
// A categoria permanece ISOLADA e presente no relatorio, sem verificacoes e com a limitacao
// explicita. Nenhum proxy (contagem de operacoes, orcamento arbitrario) e inventado: seria um
// criterio sem fundamento normativo.
export function performanceSuite(): SuiteResult {
  return suiteOf(
    'performance',
    [],
    'Nao certificavel: (1) a Compiler 017 nao exige testes de performance e nenhum pilar congelado ' +
      'declara requisito ou limiar de desempenho (CERT-C2); (2) medir desempenho exige relogio e ' +
      'ambiente, proibidos pela CERT-C4. Nenhum criterio foi inventado.',
  );
}
