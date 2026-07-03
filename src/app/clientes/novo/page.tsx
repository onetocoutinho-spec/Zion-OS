import { PageHeader } from "@/components/ui/PageHeader";
import { ClienteForm } from "@/components/forms/ClienteForm";

export default function NovoClientePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo cliente" description="Cadastre um lead ou cliente na carteira da agência." />
      <ClienteForm />
    </div>
  );
}
