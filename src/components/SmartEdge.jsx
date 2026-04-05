import { useEdges } from '@xyflow/react';
import { useMemo } from 'react';

const JUNCTION_OFFSET = 80; // px from node where the vertical stem sits
const R = 24;               // corner radius

// Build an orthogonal 3-segment path (H → V → H) with rounded 90° corners.
// Each turn is approximated by a quadratic bezier whose control point is the
// sharp corner and whose endpoints are R px away along each leg.
function orthoPath(sx, sy, jx, tx, ty) {
  const dy = ty - sy;

  // Degenerate: source and target at same Y → pure horizontal
  if (Math.abs(dy) < 1) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  const sign = dy > 0 ? 1 : -1;

  // Clamp radius so it fits in both the horizontal legs and the vertical leg
  const r = Math.min(R, Math.abs(dy) / 2, (jx - sx) / 2, (tx - jx) / 2);

  // Turn 1: horizontal meets vertical at (jx, sy)
  const t1x0 = jx - r,      t1y0 = sy;           // approach along H
  const t1x1 = jx,          t1y1 = sy + sign * r; // depart along V

  // Turn 2: vertical meets horizontal at (jx, ty)
  const t2x0 = jx,          t2y0 = ty - sign * r; // approach along V
  const t2x1 = jx + r,      t2y1 = ty;            // depart along H

  return [
    `M ${sx} ${sy}`,
    `L ${t1x0} ${t1y0}`,
    `Q ${jx} ${sy} ${t1x1} ${t1y1}`,   // round corner 1 (control = sharp corner)
    `L ${t2x0} ${t2y0}`,
    `Q ${jx} ${ty} ${t2x1} ${t2y1}`,   // round corner 2
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

  const d = useMemo(() => {
    const multiOut = edges.filter((e) => e.source === source).length > 1;
    const multiIn  = edges.filter((e) => e.target === target).length > 1;

    // Junction X — where the shared vertical stem lives.
    // Fan-out  (1→N): just right of source. All siblings share sourceX → identical
    //   first H segment and overlapping V portions → one visible stem.
    // Fan-in   (N→1): just left of target. All siblings share targetX → same effect.
    // 1-to-1  : midpoint between the two nodes.
    let jx;
    if (multiOut)     jx = sourceX + JUNCTION_OFFSET;
    else if (multiIn) jx = targetX - JUNCTION_OFFSET;
    else              jx = (sourceX + targetX) / 2;

    return orthoPath(sourceX, sourceY, jx, targetX, targetY);
  }, [edges, source, target, sourceX, sourceY, targetX, targetY]);

  return (
    <>
      <path d={d} fill="none" stroke="transparent" strokeWidth={20} />
      <path
        d={d}
        fill="none"
        stroke={style.stroke ?? 'rgba(148,100,32,0.72)'}
        strokeWidth={style.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={markerEnd}
      />
    </>
  );
}
