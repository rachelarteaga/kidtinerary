type TagType = "age" | "category" | "schedule";

interface TagProps {
  type: TagType;
  label: string;
}

const tagStyles: Record<TagType, string> = {
  age: "bg-[#5A8F6E]/12 text-[#3d7a54]",
  category: "bg-[#E07845]/10 text-[#b85c3c]",
  schedule: "bg-[#6B8CBB]/12 text-[#4a6d8c]",
};

export function Tag({ type, label }: TagProps) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-md ${tagStyles[type]}`}
    >
      {label}
    </span>
  );
}
