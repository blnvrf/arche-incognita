import { useStore } from '../store';

const R = 60; // corner radius

function buildPath(sourceX, sourceY, targetX, targetY) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const deltaY = Math.abs(dy);
  const midX = sourceX + dx / 2;

  // ── Threshold 1: same Y — pure horizontal, no turns at all ──────────────
  if (deltaY < 10) {
    return `M ${sourceX} ${sourceY} H ${targetX}`;
  }

  const vy = dy > 0 ? 1 : -1; // vertical direction sign

  // ── Threshold 2: tiny vertical delta — sharp H V H, no curves ───────────
  if (deltaY < 30) {
    return [
      `M ${sourceX} ${sourceY}`,
      `H ${midX}`,
      `V ${targetY}`,
      `H ${targetX}`,
    ].join(' ');
  }

  // ── Threshold 3 + forward edge: full rounded corners ────────────────────
  if (dx > R * 2) {
    return [
      `M ${sourceX} ${sourceY}`,
      `H ${midX - R}`,
      `Q ${midX} ${sourceY} ${midX} ${sourceY + vy * R}`,
      `V ${targetY - vy * R}`,
      `Q ${midX} ${targetY} ${midX + R} ${targetY}`,
      `H ${targetX}`,
    ].join(' ');
  }

  // ── Backwards / same-column edge: U-turn detour going down then right ───
  // Route: exit right → drop below both nodes → travel to targetX → rise to targetY
  const detourY = Math.max(sourceY, targetY) + 80;
  const vd = 1; // detour always goes downward first

  // Clamp R so corners don't exceed available segments
  const r1 = Math.min(R, Math.abs(detourY - sourceY) / 2); // source → detour vertical
  const r2 = Math.min(R, Math.abs(detourY - targetY) / 2); // detour → target vertical
  const exitX = sourceX + 40; // small rightward exit from source

  return [
    `M ${sourceX} ${sourceY}`,
    `H ${exitX - r1}`,
    `Q ${exitX} ${sourceY} ${exitX} ${sourceY + vd * r1}`,
    `V ${detourY - vd * r1}`,
    `Q ${exitX} ${detourY} ${exitX - r1} ${detourY}`,   // turn left at bottom
    `H ${targetX + r2}`,
    `Q ${targetX} ${detourY} ${targetX} ${detourY - vd * r2}`,
    `V ${targetY + vd * r2}`,
    `Q ${targetX} ${targetY} ${targetX - r2} ${targetY}`, // won't be used — enter from right
    `H ${targetX}`,
  ].join(' ');
}

export default function TechTreeEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
}) {
  const targetNode = useStore((s) => s.nodes.find((n) => n.id === target));
  const dashed = targetNode?.data?.requiresAll === false;

  const d = buildPath(sourceX, sourceY, targetX, targetY);

  const gradId = `tte-shine-${source}-${target}`;
  const DASH_CYCLE = 20;
  const approxLen = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dashOffset = approxLen % DASH_CYCLE;

  const strokeProps = {
    strokeWidth: style.strokeWidth ?? 4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeDasharray: dashed ? '8 12' : undefined,
    strokeDashoffset: dashed ? dashOffset : undefined,
  };

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
        markerEnd={markerEnd}
        {...strokeProps}
      />
      {/* gradient shine overlay */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        {...strokeProps}
      />
    </>
  );
}
