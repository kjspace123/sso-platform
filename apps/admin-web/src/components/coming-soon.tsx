export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{description}</p>
    </div>
  );
}
