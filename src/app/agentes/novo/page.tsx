import { PageHeader } from "@/components/ui/PageHeader";
import { AgenteForm } from "@/components/forms/AgenteForm";

export default function NovoAgentePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo agente IA" description="Documente um novo agente do time Zion." />
      <AgenteForm />
    </div>
  );
}
