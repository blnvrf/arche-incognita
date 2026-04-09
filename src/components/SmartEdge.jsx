import { useEdges } from '@xyflow/react';
import { useStore } from '../store';

const R = 10;
const JUNCTION_OFFSET = 80;

// Rounded orthogonal polyline: connects pts with straight H/V segments and
// smooth Q-bezier corners of radius R.
function buildPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const dx1 = c.x - p.x, dy1 = c.y - p.y;
    const dx2 = n.x - c.x, dy2 = n.y - c.y;
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2);
    if (l1 < 0.01 || l2 < 0.01) { d += ` L ${c.x} ${c.y}`; continue; }
    const r = Math.min(R, l1 / 2, l2 / 2);
    d += ` L ${c.x - (dx1 / l1) * r} ${c.y - (dy1 / l1) * r}`;
    d += ` Q ${c.x} ${c.y} ${c.x + (dx2 / l2) * r} ${c.y + (dy2 / l2) * r}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Simple 3-segment stair: H → V → H.
function stairPath(sx, sy, jx, tx, ty) {
  if (Math.abs(sy - ty) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  return buildPath([{ x: sx, y: sy }, { x: jx, y: sy }, { x: jx, y: ty }, { x: tx, y: ty }]);
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

  if (elkBends !== null && elkBends !== undefined && elkBends.length >= 2) {
    // ELK chose a multi-bend route to avoid obstacles.
    //
    // ELK computes handle positions from (nodeX + nodeWidth, nodeY + nodeHeight/2), but
    // React Flow measures the actual rendered handle — they can differ by a few px if the
    // node's real height doesn't match NODE_H.  Fix: clamp the first bend's Y to sourceY
    // and the last bend's Y to targetY.  The intermediate segments ELK produced are between
    // points that share an X or a Y, so they stay orthogonal after the clamp.
    const adjusted = elkBends.map((b, i) => {
      if (i === 0)                  return { x: b.x, y: sourceY };
      if (i === elkBends.length - 1) return { x: b.x, y: targetY };
      return b;
    });
    d = buildPath([{ x: sourceX, y: sourceY }, ...adjusted, { x: targetX, y: targetY }]);
  } else {
    // Fallback stair path (used before autoLayout assigns elkBends, or for straight-line edges).
    const multiOut = edges.filter((e) => e.source === source).length > 1;
    const multiIn  = edges.filter((e) => e.target === target).length > 1;
    let jx;
    if (multiOut)     jx = sourceX + JUNCTION_OFFSET;
    else if (multiIn) jx = targetX - JUNCTION_OFFSET;
    else              jx = (sourceX + targetX) / 2;
    d = stairPath(sourceX, sourceY, jx, targetX, targetY);
  }

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
