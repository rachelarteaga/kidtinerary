export function CatalogEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-ink-3 bg-surface p-8 text-center">
      <p className="font-display font-extrabold text-xl text-ink mb-2">
        Your catalog is empty.
      </p>
      <p className="font-sans text-sm text-ink-2">
        Add an activity, or let us help you find some.
      </p>
    </div>
  );
}
