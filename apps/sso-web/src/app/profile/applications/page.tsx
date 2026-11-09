import { ComingSoon } from "@/components/coming-soon";

export default function ConnectedApplicationsPage() {
  return (
    <ComingSoon
      title="Connected applications"
      description="Once the OIDC provider is wired up (Phase 4), this page will list every application you've granted access to, with the ability to revoke individual grants."
    />
  );
}
