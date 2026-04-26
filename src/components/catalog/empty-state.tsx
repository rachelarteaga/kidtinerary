import { SparkleIcon } from "@/components/ui/sparkle-icon";

interface Props {
  onAdd: () => void;
  onHelpMeFind: () => void;
}

export function CatalogEmptyState({ onAdd, onHelpMeFind }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-ink-3 bg-surface p-8 text-center">
      <p className="font-display font-extrabold text-xl text-ink mb-2">
        Your catalog is empty.
      </p>
      <p className="font-sans text-sm text-ink-2 mb-5">
        Add an activity, or let us help you find some.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onAdd}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-surface text-ink border border-ink hover:bg-base"
        >
          + Add activity
        </button>
        <button
          type="button"
          onClick={onHelpMeFind}
          className="inline-flex items-center gap-1.5 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-hero text-ink border border-ink hover:brightness-95"
        >
          <SparkleIcon size={11} fill="#151515" />
          Help me find
        </button>
      </div>
    </div>
  );
}
