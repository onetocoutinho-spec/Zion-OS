import { Reuniao } from "../types";

export const reunioes: Reuniao[] = [
  {
    id: "reu-01",
    clienteId: "cli-05",
    cliente: "AutoPeças Silva",
    titulo: "Reunião de realinhamento",
    dataHora: "2026-07-02T10:00:00",
    pauta: "Plano de recuperação e metas de 60 dias",
    status: "Agendada",
  },
  {
    id: "reu-02",
    clienteId: "cli-08",
    cliente: "Casa do Chef",
    titulo: "Apresentação do relatório de junho",
    dataHora: "2026-07-10T14:00:00",
    pauta: "Resultados de junho + início de ads Amazon",
    status: "Agendada",
  },
  {
    id: "reu-03",
    clienteId: "cli-03",
    cliente: "FitPro Suplementos",
    titulo: "Reunião inicial de onboarding",
    dataHora: "2026-06-18T15:00:00",
    pauta: "Kick-off: apresentação da equipe, acessos e plano de 30 dias",
    status: "Realizada",
  },
];
