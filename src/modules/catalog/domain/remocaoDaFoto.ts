// A LISTA DE FOTOS SEM UMA DELAS — e as duas recusas que a acompanham.
//
// `definirFotosDoItem` SUBSTITUI o conjunto de fotos do anúncio. Quem monta a
// lista nova decide, sozinho, o que sobrevive. Por isso a montagem mora aqui,
// num módulo puro com teste, e não dentro da rota que escreve: numa rota, a
// única forma de descobrir que a lista saiu errada é a lojista contar.
//
// Nasceu do incidente de 14/08/2026 — uma foto de Havaianas amarelo virou
// capa de 10 anúncios azul-marinho, e o repositório tinha ida sem volta.

export type PlanoDeRemocao =
  | { motivo: "ok"; novaOrdem: string[] }
  /** A foto não está neste anúncio. Não é erro — é um anúncio a pular. */
  | { motivo: "nao-esta-la" }
  /** Era a única. Anúncio sem foto o ML recusa, e vende zero. */
  | { motivo: "ficaria-sem-foto" };

/**
 * A lista atual, menos a foto nomeada, na MESMA ordem.
 *
 * A ordem importa: a primeira foto é a capa. Preservá-la é o que faz a
 * remoção devolver o anúncio ao estado anterior quando a foto tirada é a que
 * tinha sido posta na frente.
 */
export function semAFoto(
  idsAtuais: readonly string[],
  fotoNoML: string
): PlanoDeRemocao {
  const alvo = (fotoNoML ?? "").trim();
  const atuais = idsAtuais.map((s) => (s ?? "").trim()).filter(Boolean);
  if (!alvo) return { motivo: "nao-esta-la" };
  if (!atuais.includes(alvo)) return { motivo: "nao-esta-la" };

  const novaOrdem = atuais.filter((id) => id !== alvo);
  if (novaOrdem.length === 0) return { motivo: "ficaria-sem-foto" };
  return { motivo: "ok", novaOrdem };
}
