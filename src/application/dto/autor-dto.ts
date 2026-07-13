// Autor de uma alteração, no formato de transporte (DTO).
// Mapeado para o Value Object `Autor` do domínio pelo mapper (validação de `tipo`).

export interface AutorDTO {
  readonly tipo: string; // validado para "humano" | "agente" no mapper
  readonly id: string;
  readonly agenteCodigo?: string;
  readonly confianca?: number;
}
