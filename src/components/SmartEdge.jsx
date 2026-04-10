import { useStore } from '../store';

const NODE_W  = 240;
const NODE_H  = 160;
const R       = 40;   // corner radius
const RAIL_PAD = 60;  // clearance above/below the node bounding box

// Rounded orthogonal polyline through an ordered set of points
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

export default function SmartEdge({
  source, target,
  sourceX, sourceY,
  targetX, targetY,
  style = {},
  markerEnd,
}) {
  const sourceNode = useStore((s) => s.nodes.find((n) => n.id === source));
  const targetNode = useStore((s) => s.nodes.find((n) => n.id === target));
  const nodes      = useStore((s) => s.nodes);
  const dashed = targetNode?.data?.requiresAll === false;

  // Mid-gap X: halfway between the right edge of the source node and the left edge of the target node
  const srcRight = sourceNode ? sourceNode.position.x + (sourceNode.measured?.width ?? NODE_W) : sourceX;
  const tgtLeft  = targetNode ? targetNode.position.x : targetX;
  const jx = (srcRight + tgtLeft) / 2;

  // Gap is wide enough for a clean stair if there's at least NODE_W of horizontal space
  const gapWidth = tgtLeft - srcRight;
  const isAdjacent = gapWidth >= 40; // any positive gap → stair route

  let d;

  if (isAdjacent) {
    // ── Normal stair: H→V→H through the midpoint gap ────────────────────────
    if (Math.abs(sourceY - targetY) < 1) {
      d = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const sign = targetY > sourceY ? 1 : -1;
      const r = Math.min(R, Math.abs(targetY - sourceY) / 2,
                         Math.abs(jx - sourceX), Math.abs(targetX - jx));
      d = [
        `M ${sourceX} ${sourceY}`,
        `L ${jx - r} ${sourceY}`,
        `Q ${jx} ${sourceY} ${jx} ${sourceY + sign * r}`,
        `L ${jx} ${targetY - sign * r}`,
        `Q ${jx} ${targetY} ${jx + r} ${targetY}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');
    }
  } else {
    // ── Skipping / back-edge: fly via a rail above or below all nodes ────────
    const tops    = nodes.map((n) => n.position?.y ?? 0);
    const bottoms = nodes.map((n) => (n.position?.y ?? 0) + (n.measured?.height ?? NODE_H));
    const railAbove = Math.min(...tops)    - RAIL_PAD;
    const railBelow = Math.max(...bottoms) + RAIL_PAD;
    const railY = targetY <= sourceY ? railAbove : railBelow;

    // Stems drop into the actual gap between source and target node columns
    const exitX  = srcRight + (jx - srcRight) / 2;
    const enterX = tgtLeft  - (tgtLeft - jx)  / 2;

    d = buildPath([
      { x: sourceX, y: sourceY },
      { x: exitX,   y: sourceY },
      { x: exitX,   y: railY   },
      { x: enterX,  y: railY   },
      { x: enterX,  y: targetY },
      { x: targetX, y: targetY },
    ]);
  }

  const gradId     = `edge-shine-${source}-${target}`;
  const DASH_CYCLE = 20;
  const approxLen  = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
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
