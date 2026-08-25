// P1 — Símbolo: o que distingue unicamente uma entidade de toda outra.
export type Symbol = string & { readonly __zion: 'Symbol' };
