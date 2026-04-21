interface Props {
  sharedWith: string[]; // other kids' names
}

export function SharedBadge({ sharedWith }: Props) {
  if (sharedWith.length === 0) return null;
  return (
    <div className="font-sans text-[11px] font-semibold text-ink mt-1 flex items-center gap-1">
      <span>✦</span>
      <span>shared with {sharedWith.join(", ")}</span>
    </div>
  );
}
