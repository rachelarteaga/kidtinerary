export type KidShapeType = "circle" | "square" | "triangle" | "diamond";

const SHAPE_BY_INDEX: KidShapeType[] = ["circle", "square", "triangle", "diamond"];

export function shapeForKidIndex(index: number): KidShapeType {
  return SHAPE_BY_INDEX[index % SHAPE_BY_INDEX.length];
}

interface Props {
  /** Sort order within the planner — 0-indexed. */
  index: number;
  /** Pixel size (bounding box). */
  size: number;
  /** Single-letter initial rendered inside the shape. */
  initial?: string;
  /** When true, renders a solid filled shape with no initial (small marker use). */
  dotOnly?: boolean;
  /** Override fill. Defaults to ink (#151515). */
  fill?: string;
  /** Override text color for initial. Defaults to white. */
  textColor?: string;
  /** Whether to render a 1px stroke around the shape. Defaults to true when size >= 20. */
  stroke?: boolean;
}

export function KidShape({
  index,
  size,
  initial,
  dotOnly = false,
  fill = "#151515",
  textColor = "#ffffff",
  stroke,
}: Props) {
  const shape = shapeForKidIndex(index);
  const s = size;
  const showStroke = stroke ?? s >= 20;
  const strokeAttrs = showStroke ? { stroke: "#151515", strokeWidth: 1 } : {};

  // Triangle viewBox is slightly wider to keep it visually balanced
  if (shape === "triangle") {
    const w = Math.round(s * (34 / 32));
    return (
      <svg width={w} height={s} viewBox={`0 0 ${w} ${s}`} style={{ flexShrink: 0 }}>
        <polygon
          points={`${w / 2},1 ${w - 1},${s - 1} 1,${s - 1}`}
          fill={fill}
          {...strokeAttrs}
        />
        {!dotOnly && initial ? (
          <text
            x={w / 2}
            y={s * 0.78}
            textAnchor="middle"
            fontFamily="Figtree, sans-serif"
            fontWeight="800"
            fontSize={Math.round(s * 0.38)}
            fill={textColor}
          >
            {initial}
          </text>
        ) : null}
      </svg>
    );
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      {shape === "circle" && (
        <circle cx={s / 2} cy={s / 2} r={s / 2 - (showStroke ? 0.5 : 0)} fill={fill} {...strokeAttrs} />
      )}
      {shape === "square" && (
        <rect x={showStroke ? 0.5 : 0} y={showStroke ? 0.5 : 0} width={s - (showStroke ? 1 : 0)} height={s - (showStroke ? 1 : 0)} fill={fill} {...strokeAttrs} />
      )}
      {shape === "diamond" && (
        <polygon
          points={`${s / 2},1 ${s - 1},${s / 2} ${s / 2},${s - 1} 1,${s / 2}`}
          fill={fill}
          {...strokeAttrs}
        />
      )}
      {!dotOnly && initial ? (
        <text
          x={s / 2}
          y={s * (shape === "diamond" ? 0.63 : 0.66)}
          textAnchor="middle"
          fontFamily="Figtree, sans-serif"
          fontWeight="800"
          fontSize={Math.round(s * (shape === "diamond" ? 0.38 : 0.42))}
          fill={textColor}
        >
          {initial}
        </text>
      ) : null}
    </svg>
  );
}
