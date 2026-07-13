// Anti-corruption: AutorDTO → Autor (domínio). Só conversão/validação estrutural
// do campo `tipo`; nenhuma regra de negócio.

import type { Result } from "../../domain/shared/resultado.ts";
import { ok, falha } from "../../domain/shared/resultado.ts";
import { erroDominio } from "../../domain/shared/erros-dominio.ts";
import type { Autor } from "../../domain/produto-mestre/versao.ts";
import type { AutorDTO } from "../dto/autor-dto.ts";

export function paraAutor(dto: AutorDTO): Result<Autor> {
  if (dto.tipo !== "humano" && dto.tipo !== "agente") {
    return falha(erroDominio("campo_obrigatorio", "Autor.tipo deve ser 'humano' ou 'agente'."));
  }
  const autor: Autor = {
    tipo: dto.tipo,
    id: dto.id,
    agenteCodigo: dto.agenteCodigo,
    confianca: dto.confianca,
  };
  return ok(autor);
}
