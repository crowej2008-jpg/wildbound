import { buildCreature, type SpeciesLike } from './creature';

export interface WildPortraitProps {
  species: SpeciesLike;
  stage: number;
  size?: number;
  /** Accessible label; if omitted the SVG is decorative (aria-hidden). */
  label?: string;
}

const CX = 60;
const CY = 70;

/**
 * Deterministic procedural portrait (M2, PROMPT §9.4). Renders the shape from
 * `buildCreature` as inline SVG — no binary media, no randomness at render time.
 */
export default function WildPortrait({ species, stage, size = 96, label }: WildPortraitProps) {
  const c = buildCreature(species, stage);
  const { palette, body, head, eye, legs, tail, horns, fins, spots } = c;
  const headY = CY + head.offsetY;

  const legXs = spread(legs.count, CX, body.rx * 1.5);
  const finXs = [-1, 1];
  const hornXs = spread(horns.count, 0, head.r * 1.2);

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="wild-portrait"
    >
      <ellipse cx={CX} cy={CY + body.ry * 1.1} rx={body.rx * 1.05} ry={body.ry * 0.24} fill="rgb(0 0 0 / 0.12)" />
      <path
        d={`M ${CX - body.rx * 0.4} ${CY + body.ry * 0.6} q ${tail.curve} ${tail.length * 0.9} ${tail.curve * 1.6} ${tail.length}`}
        fill="none"
        stroke={palette.outline}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {fins.count > 0 &&
        finXs.flatMap((side, i) =>
          Array.from({ length: fins.count }, (_, f) => (
            <path
              key={`fin-${i}-${f}`}
              d={`M ${CX + side * body.rx * 0.7} ${CY + f * 4 - 4} l ${side * fins.size} ${-fins.size * 0.4} l ${-side * fins.size * 0.2} ${fins.size * 0.9} z`}
              fill={palette.accent}
            />
          )),
        )}
      {legXs.map((x, i) => (
        <line
          key={`leg-${i}`}
          x1={x}
          y1={CY + body.ry * 0.7}
          x2={x}
          y2={CY + body.ry * 0.7 + legs.length}
          stroke={palette.outline}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <ellipse cx={CX} cy={CY} rx={body.rx} ry={body.ry} fill={palette.body} stroke={palette.outline} strokeWidth={2} />
      <ellipse cx={CX} cy={CY + body.ry * 0.35} rx={body.rx * 0.6} ry={body.ry * 0.5} fill={palette.belly} />
      {Array.from({ length: spots.count }, (_, i) => {
        const a = (i / spots.count) * Math.PI * 2;
        return (
          <circle
            key={`spot-${i}`}
            cx={CX + Math.cos(a) * body.rx * 0.5}
            cy={CY + Math.sin(a) * body.ry * 0.5}
            r={spots.radius}
            fill={palette.accent}
            opacity={0.85}
          />
        );
      })}
      {hornXs.map((dx, i) => (
        <line
          key={`horn-${i}`}
          x1={CX + dx}
          y1={headY - head.r * 0.5}
          x2={CX + dx * 1.3}
          y2={headY - head.r * 0.5 - horns.length}
          stroke={palette.outline}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <circle cx={CX} cy={headY} r={head.r} fill={palette.body} stroke={palette.outline} strokeWidth={2} />
      <Eye cx={CX - eye.dx} cy={headY + eye.dy} r={eye.r} style={eye.style} color={palette.eye} />
      <Eye cx={CX + eye.dx} cy={headY + eye.dy} r={eye.r} style={eye.style} color={palette.eye} />
    </svg>
  );
}

function Eye({ cx, cy, r, style, color }: { cx: number; cy: number; r: number; style: string; color: string }) {
  if (style === 'sleepy') {
    return <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={color} strokeWidth={1.6} strokeLinecap="round" />;
  }
  if (style === 'slit') {
    return <ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r * 1.4} fill={color} />;
  }
  if (style === 'wide') {
    return (
      <>
        <circle cx={cx} cy={cy} r={r * 1.3} fill="#ffffff" stroke={color} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={r * 0.7} fill={color} />
      </>
    );
  }
  return <circle cx={cx} cy={cy} r={r} fill={color} />;
}

/** Evenly spread `count` points across a span centred on `center`. */
function spread(count: number, center: number, span: number): number[] {
  if (count <= 1) return [center];
  return Array.from({ length: count }, (_, i) => center - span / 2 + (span * i) / (count - 1));
}
