import { Circle, ClipPath, G, Line, Path, Rect } from 'react-native-svg';

import { Poster, wavePath, type Template } from './kit';

/** Rising sun with tide stripes over a dark sea. */
export const SolMare: Template = (props) => {
  const { palette: p, uid } = props;
  return (
    <Poster {...props} defs={<ClipPath id={`${uid}-sun`}><Circle cx={200} cy={236} r={104} /></ClipPath>}>
      <Circle cx={200} cy={236} r={104} fill={p.motif} />
      <G clipPath={`url(#${uid}-sun)`} fill={p.bg2}>
        <Rect x={80} y={248} width={240} height={7} />
        <Rect x={80} y={272} width={240} height={11} />
        <Rect x={80} y={300} width={240} height={16} />
        <Rect x={80} y={330} width={240} height={20} />
      </G>
      <Rect x={-250} y={352} width={900} height={400} fill={p.ink} opacity={0.4} />
      <Path d="M130 372H270M160 394H240M110 416H290" stroke={p.accent} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
    </Poster>
  );
};

/** Concentric rainbow arches. */
export const Arcos: Template = (props) => {
  const { palette: p } = props;
  const arch = (r: number) => `M${200 - r} 360A${r} ${r} 0 0 1 ${200 + r} 360Z`;
  return (
    <Poster {...props}>
      <Path d={arch(160)} fill={p.motif} />
      <Path d={arch(122)} fill={p.accent} />
      <Path d={arch(84)} fill={p.ink} opacity={0.6} />
      <Path d={arch(46)} fill={p.bg1} />
      <Rect x={-250} y={360} width={900} height={400} fill={p.ink} opacity={0.35} />
      <Rect x={-250} y={360} width={900} height={8} fill={p.motif} />
      <Circle cx={72} cy={126} r={20} fill={p.accent} />
      <Circle cx={336} cy={170} r={11} fill={p.motif} />
    </Poster>
  );
};

/** Layered waves under a small sun. */
export const Ondas: Template = (props) => {
  const { palette: p } = props;
  return (
    <Poster {...props}>
      <Circle cx={200} cy={190} r={68} fill={p.motif} />
      <Path d={wavePath(250, 14)} fill={p.accent} />
      <Path d={wavePath(296, 14)} fill={p.motif} />
      <Path d={wavePath(342, 14)} fill={p.ink} opacity={0.5} />
      <Path d={wavePath(388, 14)} fill={p.bg2} />
      <Path d={wavePath(434, 14)} fill={p.ink} opacity={0.65} />
    </Poster>
  );
};

/** Palm fronds fanning out from the bottom, with a low sun. */
export const Palmas: Template = (props) => {
  const { palette: p } = props;
  const leaf = 'M0 0C-34 -70 -26 -150 0 -214C26 -150 34 -70 0 0Z';
  const fronds: [number, string, number][] = [
    [-78, p.ink, 0.5], [78, p.ink, 0.5], [-52, p.accent, 1], [52, p.accent, 1], [-26, p.motif, 1], [26, p.motif, 1], [0, p.motif, 1],
  ];
  return (
    <Poster {...props}>
      <Circle cx={278} cy={150} r={64} fill={p.accent} opacity={0.85} />
      {fronds.map(([a, fill, op]) => (
        <Path key={a} d={leaf} fill={fill} opacity={op} transform={`translate(200 408) rotate(${a})`} />
      ))}
      <Path d="M196 408L190 470H210L204 408Z" fill={p.ink} />
      <Circle cx={200} cy={408} r={12} fill={p.ink} />
    </Poster>
  );
};

/** Terceira Ponte: steel arch over the bay. */
export const Ponte: Template = (props) => {
  const { palette: p } = props;
  const hangers = [86, 118, 150, 182, 218, 250, 282, 314];
  const archY = (x: number) => 340 - (1 - Math.pow((x - 200) / 190, 2)) * 170;
  return (
    <Poster {...props}>
      <Circle cx={290} cy={150} r={56} fill={p.accent} />
      <Path d="M-30 340Q200 20 430 340" stroke={p.ink} strokeOpacity={0.35} strokeWidth={8} fill="none" transform="translate(0 30)" />
      {hangers.map((x) => (
        <Line key={x} x1={x} y1={archY(x) + 6} x2={x} y2={338} stroke={p.motif} strokeWidth={3} />
      ))}
      <Path d="M10 340Q200 -0 390 340" stroke={p.motif} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Rect x={-250} y={338} width={900} height={14} fill={p.ink} />
      <Rect x={-250} y={352} width={900} height={400} fill={p.motif} opacity={0.3} />
      <Path d="M70 392H170M230 414H340M110 438H200" stroke={p.motif} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
    </Poster>
  );
};

/** Convento da Penha: chapel on a hilltop. */
export const Penha: Template = (props) => {
  const { palette: p } = props;
  return (
    <Poster {...props}>
      <Circle cx={290} cy={150} r={64} fill={p.accent} opacity={0.9} />
      <Path d="M-250 430C-110 410 -40 330 80 300L140 296H260L320 300C440 330 510 410 650 430V700H-250Z" fill={p.ink} opacity={0.55} />
      <Path d="M-250 470C-60 450 40 380 120 350L280 350C360 380 460 450 650 470V700H-250Z" fill={p.ink} />
      <G transform="translate(200 296) scale(1.7) translate(-200 -296)">
      <Rect x={140} y={252} width={120} height={46} fill={p.motif} />
      <Rect x={186} y={206} width={28} height={50} fill={p.motif} />
      <Path d="M180 208L200 178L220 208Z" fill={p.accent} />
      <Line x1={200} y1={178} x2={200} y2={160} stroke={p.motif} strokeWidth={4} />
      <Line x1={192} y1={168} x2={208} y2={168} stroke={p.motif} strokeWidth={4} />
      <G fill={p.ink}>
        <Rect x={156} y={268} width={10} height={16} rx={5} />
        <Rect x={178} y={268} width={10} height={16} rx={5} />
        <Rect x={212} y={268} width={10} height={16} rx={5} />
        <Rect x={234} y={268} width={10} height={16} rx={5} />
        <Rect x={195} y={222} width={10} height={14} rx={5} />
      </G>
      </G>
    </Poster>
  );
};

/** Praia do Canto: tower skyline with lit windows, moon and sea. */
export const Skyline: Template = (props) => {
  const { palette: p } = props;
  const towers: [number, number, number][] = [
    [34, 56, 130], [94, 44, 190], [142, 62, 150], [208, 46, 240], [258, 58, 170], [320, 48, 120],
  ];
  return (
    <Poster {...props}>
      <Circle cx={282} cy={132} r={48} fill={p.motif} />
      {towers.map(([x, w, h], i) => (
        <G key={x}>
          <Rect x={x} y={376 - h} width={w} height={h} fill={p.ink} opacity={i % 2 ? 0.9 : 0.72} />
          {Array.from({ length: Math.floor(h / 26) }).map((_, r) =>
            [0, 1].map((c) => ((r * 3 + c * 2 + i) % 4 === 0 ? null : (
              <Rect key={`${r}-${c}`} x={x + 10 + c * (w / 2 - 4)} y={376 - h + 12 + r * 24} width={9} height={11} rx={2} fill={p.motif} opacity={0.9} />
            ))),
          )}
        </G>
      ))}
      <Rect x={-250} y={376} width={900} height={400} fill={p.accent} opacity={0.45} />
      <Path d="M20 404H150M210 424H330M80 448H190" stroke={p.motif} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
    </Poster>
  );
};
