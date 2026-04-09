import { useEdges } from '@xyflow/react';
import { useStore } from '../store';

const R = 10;               // corner radius
const JUNCTION_OFFSET = 80; // distance from node where the vertical stem sits

// Three-segment orthogonal path: H → V → H, with rounded 90° corners.
// Always computed from the actual React Flow handle positions.
function stairPath(sx, sy, jx, tx, ty) {
  if (Math.abs(sy - ty) < 1) {
    // Same row — straight horizontal line
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }
  const sign = ty > sy ? 1 : -1;
  const r = Math.min(R, Math.abs(ty - sy) / 2, Math.abs(jx - sx), Math.abs(tx - jx));
  return [
    `M ${sx} ${sy}`,
    `L ${jx - r} ${sy}`,
    `Q ${jx} ${sy} ${jx} ${sy + sign * r}`,
    `L ${jx} ${ty - sign * r}`,
    `Q ${jx} ${ty} ${jx + r} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

export default function SmartEdge({
  source, target,
  sourceX, sourceY,
  targetX, targetY,
  style = {},
  markerEnd,
}) {
  const edges = useEdges();
  const targetNode = useStore((s) => s.nodes.find((n) => n.id === target));
  const dashed = targetNode?.data?.requiresAll === false;

  // Place the vertical stem: bundle outgoing edges near the source,
  // bundle incoming edges near the target, otherwise use the midpoint.
  const multiOut = edges.filter((e) => e.source === source).length > 1;
  const multiIn  = edges.filter((e) => e.target === target).length > 1;
  let jx;
  if (multiOut)     jx = sourceX + JUNCTION_OFFSET;
  else if (multiIn) jx = targetX - JUNCTION_OFFSET;
  else              jx = (sourceX + targetX) / 2;

  const d = stairPath(sourceX, sourceY, jx, targetX, targetY);

  const gradId = `edge-shine-${source}-${target}`;
  const DASH_CYCLE = 20;
  const approxLen = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dashOffset = approxLen % DASH_CYCLE;

  return (
    <>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="-600" y1="0" x2="600" y2="0">
          <stop offset="0%"   stopColor="rgba(148,100,32,0)"     />
          <stop offset="25%"  stopColor="rgba(200,140,45,0.28)"  />
          <stop offset="50%"  stopColor="rgba(255,220,100,0.62)" />
          <stop offset="75%"  stopColor="rgba(200,140,45,0.28)"  />
          <stop offset="100%" stopColor="rgba(148,100,32,0)"     />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from="-2200 0"
            to="3000 0"
            dur="9s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>

      {/* hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={20} />
      {/* base edge */}
      <path
        d={d}
        fill="none"
        stroke={style.stroke ?? 'rgba(148,100,32,0.72)'}
        strokeWidth={style.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '8 12' : undefined}
        strokeDashoffset={dashed ? dashOffset : undefined}
        markerEnd={markerEnd}
      />
      {/* gradient shine overlay */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={style.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '8 12' : undefined}
        strokeDashoffset={dashed ? dashOffset : undefined}
      />
    </>
  );
}
