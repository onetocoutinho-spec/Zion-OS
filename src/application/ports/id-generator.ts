// Port: IdGenerator.
//
// O domínio não gera ids (nada de crypto/uuid no núcleo). A Application obtém a
// string por este Port e a "marca" como Id tipado (comoId) ao montar os dados do
// domínio. Alinha-se ao GeradorId do domínio; um IdGenerator fake torna os testes
// determinísticos.

export interface IdGenerator {
  novo(): string;
}
