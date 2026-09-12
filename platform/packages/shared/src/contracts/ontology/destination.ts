// D3 — Destinação: o Consumidor (P5) a que um Conteúdo se vincula.
// O Consumidor é um identificador opaco (P5 — externo), não exportado como contrato à parte.
export interface Destination {
  readonly consumer: string & { readonly __zion: 'Consumer' };
}
