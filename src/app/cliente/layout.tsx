import { ClientPortalShell } from "@/components/client-portal/ClientPortalShell";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <ClientPortalShell>{children}</ClientPortalShell>;
}
