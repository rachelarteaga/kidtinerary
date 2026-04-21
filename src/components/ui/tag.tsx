type TagType = "age" | "category" | "schedule";

interface TagProps {
  type: TagType;
  label: string;
}

const tagStyles: Record<TagType, string> = {
  age: "bg-[#d8f0e6] text-[#3d7a54]",
  category: "bg-[#fdebec] text-[#b85c3c]",
  schedule: "bg-[#e6ebf5] text-[#4a6d8c]",
};

export function Tag({ type, label }: TagProps) {
  return (
    <span
      className={`font-sans text-xs font-semibold uppercase tracking-wide border border-ink px-3 py-1 rounded-full ${tagStyles[type]}`}
    >
      {label}
    </span>
  );
}
