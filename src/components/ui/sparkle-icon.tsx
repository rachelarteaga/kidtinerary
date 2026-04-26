interface Props {
  size?: number;
  className?: string;
  fill?: string;
}

export function SparkleIcon({ size = 12, className, fill = "currentColor" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
    >
      <path d="M8 1 L9 6 L14 7 L9 8 L8 13 L7 8 L2 7 L7 6 Z" fill={fill} />
    </svg>
  );
}
