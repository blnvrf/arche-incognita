import { useEdges } from '@xyflow/react';
import { useStore } from '../store';

const R = 24; // corner radius

// General rounded path through an ordered list of points (orthogonal segments).
function buildPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const l1 = Math.hypot(dx1, dy1);
    const l2 = Math.hypot(dx2, dy2);
    if (l1 < 0.01 || l2 < 0.01) { d += ` L ${curr.x} ${curr.y}`; continue; }
    const r = Math.min(R, l1 / 2, l2 / 2);
    const bx = curr.x - (dx1 / l1) * r, by = curr.y - (dy1 / l1) * r;
    const ax = curr.x + (dx2 / l2) * r, ay = curr.y + (dy2 / l2) * r;
    d += ` L ${bx} ${by} Q ${curr.x} ${curr.y} ${ax} ${ay}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Fallback simple orthogonal path (used before autoLayout assigns elkBends).
const JUNCTION_OFFSET = 80;

function fallbackPath(sx, sy, jx, tx, ty) {
  const dy = ty - sy;
  if (Math.abs(dy) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const sign = dy > 0 ? 1 : -1;
  const r = Math.min(R, Math.abs(dy) / 2, (jx - sx) / 2, (tx - jx) / 2);
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
  data,
  style = {},
  markerEnd,
}) {
  const edges = useEdges();
  const targetNode = useStore((s) => s.nodes.find((n) => n.id === target));
  const dashed = targetNode?.data?.requiresAll === false;

  let d;
  const elkBends = data?.elkBends;

  if (elkBends !== null && elkBends !== undefined) {
    // ELK-computed obstacle-free route: source handle → bend points → target handle
    d = buildPath([{ x: sourceX, y: sourceY }, ...elkBends, { x: targetX, y: targetY }]);
  } else {
    // Fallback until autoLayout runs for this edge
    const multiOut = edges.filter((e) => e.source === source).length > 1;
    const multiIn  = edges.filter((e) => e.target === target).length > 1;
    let jx;
    if (multiOut)     jx = sourceX + JUNCTION_OFFSET;
    else if (multiIn) jx = targetX - JUNCTION_OFFSET;
    else              jx = (sourceX + targetX) / 2;
    d = fallbackPath(sourceX, sourceY, jx, targetX, targetY);
  }

  const gradId = `edge-shine-${source}-${target}`;
  const DASH_CYCLE = 20;
  const approxLen = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dashOffset = approxLen % DASH_CYCLE;

  return (
    <>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="-600" y1="0" x2="600" y2="0">
          <stop offset="0%"   stopColor="rgba(148,100,32,0)"    />
          <stop offset="25%"  stopColor="rgba(200,140,45,0.28)" />
          <stop offset="50%"  stopColor="rgba(255,220,100,0.62)" />
          <stop offset="75%"  stopColor="rgba(200,140,45,0.28)" />
          <stop offset="100%" stopColor="rgba(148,100,32,0)"    />
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
