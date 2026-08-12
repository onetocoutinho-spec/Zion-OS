import { ImagemProduto } from "../types";

// Imagens/vídeos de exemplo por produto e variação.
// (URLs de exemplo — o upload real fica para uma versão futura.)

export const imagensProduto: ImagemProduto[] = [
  {
    id: "img-01",
    clienteId: "cli-06",
    produtoId: "prd-11",
    varianteId: null,
    anuncioId: null,
    tipoImagem: "Principal",
    url: "https://exemplo.com/tenis-principal.jpg",
    status: "Aprovada",
    observacoes: "Fundo branco, sapato de 3/4.",
    largura: null,
    altura: null,
  },
  {
    id: "img-02",
    clienteId: "cli-06",
    produtoId: "prd-11",
    varianteId: "var-01",
    anuncioId: null,
    tipoImagem: "Lifestyle",
    url: "https://exemplo.com/tenis-preto-lifestyle.jpg",
    status: "Em produção",
    observacoes: "Modelo usando o tênis preto.",
    largura: null,
    altura: null,
  },
];
