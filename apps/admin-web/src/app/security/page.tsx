import { ComingSoon } from "@/components/coming-soon";

export default function SecurityPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Security</h1>
      <ComingSoon
        title="Security checklist & configuration"
        description="This page will surface rate-limit status, login throttle activity, and the section 16 security checklist once the hardening phase lands."
      />
    </div>
  );
}
