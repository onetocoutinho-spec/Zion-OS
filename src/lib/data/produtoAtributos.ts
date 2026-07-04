import { ProdutoAtributo } from "../types";

// Atributos dinâmicos de exemplo (ficha técnica flexível por categoria).

export const produtoAtributos: ProdutoAtributo[] = [
  // prd-11 — Tênis (calçado)
  {
    id: "atr-01",
    produtoId: "prd-11",
    nomeAtributo: "Gênero",
    valorAtributo: "Unissex",
    tipoAtributo: "lista",
    obrigatorio: true,
    origem: "Template",
  },
  {
    id: "atr-02",
    produtoId: "prd-11",
    nomeAtributo: "Material do cabedal",
    valorAtributo: "Couro sintético",
    tipoAtributo: "texto",
    obrigatorio: true,
    origem: "Marketplace",
  },
  {
    id: "atr-03",
    produtoId: "prd-11",
    nomeAtributo: "Tipo de fechamento",
    valorAtributo: "Cadarço",
    tipoAtributo: "lista",
    obrigatorio: false,
    origem: "Template",
  },
  // prd-13 — Chaleira (eletrônico)
  {
    id: "atr-04",
    produtoId: "prd-13",
    nomeAtributo: "Potência",
    valorAtributo: "1500W",
    tipoAtributo: "texto",
    obrigatorio: true,
    origem: "Marketplace",
  },
  {
    id: "atr-05",
    produtoId: "prd-13",
    nomeAtributo: "Capacidade",
    valorAtributo: "1,8 litros",
    tipoAtributo: "texto",
    obrigatorio: true,
    origem: "Template",
  },
  {
    id: "atr-06",
    produtoId: "prd-13",
    nomeAtributo: "Desligamento automático",
    valorAtributo: "Sim",
    tipoAtributo: "booleano",
    obrigatorio: false,
    origem: "Manual",
  },
];
