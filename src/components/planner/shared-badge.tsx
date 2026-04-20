interface Props {
  sharedWith: string[]; // other kids' names
}

export function SharedBadge({ sharedWith }: Props) {
  if (sharedWith.length === 0) return null;
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest text-meadow mt-1">
      ✦ shared w/ {sharedWith.join(", ")}
    </div>
  );
}
