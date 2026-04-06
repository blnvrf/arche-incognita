import { useEdges } from '@xyflow/react';
import { useMemo } from 'react';
import { useStore } from '../store';

const JUNCTION_OFFSET = 80; // px from node where the vertical stem sits
const R = 24;               // corner radius

function orthoPath(sx, sy, jx, tx, ty) {
  const dy = ty - sy;
  if (Math.abs(dy) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;

  const sign = dy > 0 ? 1 : -1;
  const r = Math.min(R, Math.abs(dy) / 2, (jx - sx) / 2, (tx - jx) / 2);

  const t1x0 = jx - r, t1y0 = sy;
  const t1x1 = jx,     t1y1 = sy + sign * r;
  const t2x0 = jx,     t2y0 = ty - sign * r;
  const t2x1 = jx + r, t2y1 = ty;

  return [
    `M ${sx} ${sy}`,
    `L ${t1x0} ${t1y0}`,
    `Q ${jx} ${sy} ${t1x1} ${t1y1}`,
    `L ${t2x0} ${t2y0}`,
    `Q ${jx} ${ty} ${t2x1} ${t2y1}`,
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

  const d = useMemo(() => {
    const multiOut = edges.filter((e) => e.source === source).length > 1;
    const multiIn  = edges.filter((e) => e.target === target).length > 1;

    let jx;
    if (multiOut)     jx = sourceX + JUNCTION_OFFSET;
    else if (multiIn) jx = targetX - JUNCTION_OFFSET;
    else              jx = (sourceX + targetX) / 2;

    return orthoPath(sourceX, sourceY, jx, targetX, targetY);
  }, [edges, source, target, sourceX, sourceY, targetX, targetY]);

  const gradId = `edge-shine-${source}-${target}`;

  // Anchor dash phase from the target end so overlapping edges on shared
  // segments always have identical dash patterns on those segments.
  const DASH_CYCLE = 20; // 8 dash + 12 gap
  const approxLen = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dashOffset = approxLen % DASH_CYCLE;

  return (
    <>
      <defs>
        {/* Wide gradient zone sweeps left→right across the canvas */}
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
