/** Window rectangles in a grid, given the column and row positions. */
const grid = (xs: number[], ys: number[], width: number, height: number) =>
  ys.flatMap((y) => xs.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx="1.5" />));

/** Decorative flat city with a hotel, drawn with the palette colors. */
export function CitySkyline({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="-8 0 368 160" className={className}>
      <circle cx="318" cy="30" r="18" className="fill-brand-tan" />

      <g className="fill-brand-steel">
        <rect x="44" y="64" width="50" height="96" rx="3" />
        <rect x="244" y="48" width="46" height="112" rx="3" />
      </g>
      <g className="fill-card/70">
        {grid([54, 74], [76, 94], 10, 10)}
        {grid([254, 270], [60, 78, 96], 9, 10)}
      </g>

      <g className="fill-brand-coffee">
        <rect x="76" y="100" width="48" height="60" rx="3" />
        <rect x="274" y="92" width="58" height="68" rx="3" />
      </g>
      <g className="fill-brand-tan">
        {grid([86, 104], [112, 132], 9, 9)}
        {grid([284, 300, 316], [104, 124], 8, 10)}
      </g>

      {/* the hotel */}
      <g className="fill-brand-maroon">
        <rect x="140" y="20" width="76" height="20" rx="3" />
        <rect x="122" y="36" width="112" height="124" rx="4" />
      </g>
      <text x="178" y="34" textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="3" className="fill-brand-tan">
        HOTEL
      </text>
      <g className="fill-brand-tan">{grid([136, 170, 204], [50, 74, 98], 16, 14)}</g>
      <path d="M164 160v-24a14 14 0 0 1 28 0v24Z" className="fill-card" />

      {/* palm tree */}
      <path d="M22 160Q28 122 22 96" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-brand-coffee" />
      <path
        d="M22 96Q4 82 0 100M22 96Q10 72 -2 76M22 96Q28 70 46 76M22 96Q42 84 46 104"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-brand-tan"
      />

      <rect y="157" width="360" height="3" rx="1.5" className="fill-brand-tan" />
    </svg>
  );
}
