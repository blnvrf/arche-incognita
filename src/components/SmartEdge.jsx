import { useEdges } from '@xyflow/react';
import { useStore } from '../store';

// Strict orthogonal path — only horizontal/vertical segments, sharp 90° corners.
function buildPath(pts) {
  if (pts.length < 2) return '';
  return 'M ' + pts[0].x + ' ' + pts[0].y +
    pts.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('');
}

// Fallback simple orthogonal path (used before autoLayout assigns elkBends).
const JUNCTION_OFFSET = 80;

function fallbackPath(sx, sy, jx, tx, ty) {
  const dy = ty - sy;
  if (Math.abs(dy) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  return `M ${sx} ${sy} L ${jx} ${sy} L ${jx} ${ty} L ${tx} ${ty}`;
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
