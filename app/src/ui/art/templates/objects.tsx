import { Circle, ClipPath, Ellipse, G, Line, Mask, Path, Rect } from 'react-native-svg';

import { Person } from '../parts';
import { Poster, Sparkle, type Template } from './kit';

/** Disco ball hanging from a string, facets as curved lines, a few sparkles. */
export const Disco: Template = (props) => {
  const { palette: p, uid } = props;
  const lat = [-62, -32, 0, 32, 62];
  const lon = [-70, -35, 0, 35, 70];
  return (
    <Poster {...props} defs={<ClipPath id={`${uid}-ball`}><Circle cx={200} cy={270} r={100} /></ClipPath>}>
      <Line x1={200} y1={-250} x2={200} y2={170} stroke={p.ink} strokeWidth={5} />
      <Rect x={186} y={158} width={28} height={20} rx={6} fill={p.ink} />
      <Circle cx={200} cy={270} r={100} fill={p.motif} />
      <G clipPath={`url(#${uid}-ball)`} fill="none" stroke={p.ink} strokeOpacity={0.4} strokeWidth={3}>
        {lat.map((dy) => (
          <Ellipse key={dy} cx={200} cy={270 + dy} rx={100} ry={Math.max(6, 22 - Math.abs(dy) / 4)} />
        ))}
        {lon.map((dx) => (
          <Ellipse key={dx} cx={200} cy={270} rx={Math.max(8, 100 - Math.abs(dx) * 1.2)} ry={100} />
        ))}
        <Rect x={218} y={215} width={26} height={26} fill={p.accent} fillOpacity={0.9} stroke="none" />
        <Rect x={160} y={300} width={22} height={22} fill={p.accent} fillOpacity={0.7} stroke="none" />
      </G>
      <Sparkle cx={78} cy={190} r={26} fill={p.accent} />
      <Sparkle cx={330} cy={150} r={18} fill={p.accent} />
      <Sparkle cx={318} cy={372} r={30} fill={p.accent} />
      <Sparkle cx={92} cy={352} r={14} fill={p.motif} />
    </Poster>
  );
};

/** Big lightning bolt with an offset ink shadow and a thin accent ring. */
export const Raio: Template = (props) => {
  const { palette: p } = props;
  const bolt = 'M236 78L128 276L192 276L160 430L274 216L206 216Z';
  return (
    <Poster {...props}>
      <Circle cx={200} cy={254} r={150} fill="none" stroke={p.accent} strokeWidth={6} opacity={0.7} />
      <Path d={bolt} fill={p.ink} opacity={0.5} transform="translate(16 14)" />
      <Path d={bolt} fill={p.motif} />
      <Sparkle cx={82} cy={150} r={20} fill={p.accent} />
      <Sparkle cx={326} cy={360} r={24} fill={p.accent} />
    </Poster>
  );
};

/** Crescent moon (masked circle) with stars. */
export const Lua: Template = (props) => {
  const { palette: p, uid } = props;
  return (
    <Poster
      {...props}
      defs={
        <Mask id={`${uid}-moon`} x={0} y={0} width={400} height={500}>
          <Rect width={400} height={500} fill="#fff" />
          <Circle cx={248} cy={218} r={88} fill="#000" />
        </Mask>
      }
    >
      <Circle cx={200} cy={254} r={140} fill={p.accent} opacity={0.18} />
      <Circle cx={196} cy={256} r={112} fill={p.motif} mask={`url(#${uid}-moon)`} />
      <Sparkle cx={292} cy={150} r={26} fill={p.motif} />
      <Sparkle cx={320} cy={300} r={16} fill={p.accent} />
      <Sparkle cx={96} cy={120} r={14} fill={p.accent} />
      <Sparkle cx={110} cy={388} r={22} fill={p.motif} />
      <Circle cx={60} cy={260} r={5} fill={p.motif} />
      <Circle cx={340} cy={96} r={5} fill={p.accent} />
      <Circle cx={256} cy={400} r={5} fill={p.accent} />
    </Poster>
  );
};

/** Vinyl record on the left with a tonearm. */
export const Vinil: Template = (props) => {
  const { palette: p } = props;
  return (
    <Poster {...props}>
      <Circle cx={190} cy={262} r={118} fill={p.ink} />
      {[100, 84, 68, 54].map((r) => (
        <Circle key={r} cx={190} cy={262} r={r} fill="none" stroke={p.bg1} strokeOpacity={0.35} strokeWidth={2} />
      ))}
      <Path d="M112 190A100 100 0 0 1 200 162" stroke={p.accent} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.8} />
      <Circle cx={190} cy={262} r={38} fill={p.motif} />
      <Circle cx={190} cy={262} r={7} fill={p.ink} />
      <Line x1={328} y1={92} x2={262} y2={226} stroke={p.accent} strokeWidth={10} strokeLinecap="round" />
      <Rect x={242} y={214} width={34} height={20} rx={5} fill={p.accent} transform="rotate(27 259 224)" />
      <Circle cx={330} cy={88} r={20} fill={p.ink} />
      <Circle cx={330} cy={88} r={8} fill={p.accent} />
    </Poster>
  );
};

/** Acoustic guitar leaning left, microphone lower right. */
export const Guitarra: Template = (props) => {
  const { palette: p } = props;
  return (
    <Poster {...props}>
      <G transform="rotate(-28 200 260)">
        <Rect x={190} y={56} width={20} height={190} rx={4} fill={p.ink} />
        <Rect x={182} y={34} width={36} height={40} rx={8} fill={p.accent} />
        <Path
          d="M200 218C150 218 140 262 158 290C128 312 126 380 168 396C190 404 210 404 232 396C274 380 272 312 242 290C260 262 250 218 200 218Z"
          fill={p.motif}
        />
        <Circle cx={200} cy={318} r={24} fill={p.ink} />
        <Rect x={176} y={372} width={48} height={9} rx={4} fill={p.ink} />
        <Line x1={196} y1={60} x2={196} y2={372} stroke={p.bg1} strokeOpacity={0.55} strokeWidth={1.5} />
        <Line x1={204} y1={60} x2={204} y2={372} stroke={p.bg1} strokeOpacity={0.55} strokeWidth={1.5} />
      </G>
      <G transform="rotate(24 306 370)">
        <Rect x={298} y={376} width={16} height={74} rx={8} fill={p.ink} />
        <Circle cx={306} cy={356} r={30} fill={p.accent} />
        <Path d="M280 352H332M282 366H330" stroke={p.ink} strokeOpacity={0.45} strokeWidth={3} />
      </G>
      <Sparkle cx={88} cy={120} r={22} fill={p.motif} />
    </Poster>
  );
};

/** Equalizer bars with a soft reflection. */
export const Equalizador: Template = (props) => {
  const { palette: p } = props;
  const heights = [90, 150, 210, 250, 290, 230, 180, 130, 100];
  const base = 360;
  return (
    <Poster {...props}>
      {heights.map((h, i) => {
        const x = 43 + i * 36;
        const fill = i % 2 ? p.accent : p.motif;
        return (
          <G key={i}>
            <Rect x={x} y={base - h} width={26} height={h} rx={13} fill={fill} />
            <Rect x={x} y={base + 12} width={26} height={h * 0.28} rx={13} fill={fill} opacity={0.3} />
            <Circle cx={x + 13} cy={base - h - 22} r={5} fill={p.ink} opacity={0.6} />
          </G>
        );
      })}
      <Rect x={-250} y={base + 4} width={900} height={4} fill={p.ink} opacity={0.5} />
    </Poster>
  );
};

/** Crowd with raised arms against a big sun. */
export const Galera: Template = (props) => {
  const { palette: p } = props;
  const row: [number, number, number][] = [
    [30, 340, 92], [92, 318, 112], [160, 300, 128], [228, 322, 108], [290, 336, 96],
  ];
  return (
    <Poster {...props}>
      <Circle cx={200} cy={206} r={98} fill={p.motif} />
      <Path d="M-250 214H650" stroke={p.bg2} strokeWidth={6} opacity={0.55} />
      <Path d="M-250 240H650" stroke={p.bg2} strokeWidth={10} opacity={0.4} />
      {row.map(([x, y, h], i) => (
        <Person key={i} x={x} y={y - h + 100} w={h * 0.8} h={h} arms={i % 2 === 0} fill={p.ink} />
      ))}
      <Person x={-6} y={380} w={96} h={128} arms fill={p.ink} />
      <Person x={308} y={378} w={96} h={130} arms fill={p.ink} />
      <Rect x={-250} y={440} width={900} height={300} fill={p.ink} />
    </Poster>
  );
};

/** Neon ring sign (flat, no glow) with a bar and dots. */
export const Neon: Template = (props) => {
  const { palette: p } = props;
  return (
    <Poster {...props}>
      <Circle cx={200} cy={250} r={112} fill="none" stroke={p.motif} strokeWidth={18} />
      <Circle cx={200} cy={250} r={76} fill="none" stroke={p.accent} strokeWidth={7} />
      <Path d="M130 330L270 170" stroke={p.ink} strokeWidth={22} strokeLinecap="round" opacity={0.35} />
      <Path d="M138 322L262 178" stroke={p.accent} strokeWidth={8} strokeLinecap="round" />
      <Circle cx={200} cy={250} r={14} fill={p.motif} />
      <Circle cx={74} cy={118} r={9} fill={p.accent} />
      <Circle cx={330} cy={402} r={9} fill={p.accent} />
      <Circle cx={330} cy={110} r={5} fill={p.motif} />
      <Circle cx={70} cy={400} r={5} fill={p.motif} />
    </Poster>
  );
};

/** Martini glass with an olive pick and bubbles. */
export const Drink: Template = (props) => {
  const { palette: p, uid } = props;
  return (
    <Poster {...props} defs={<ClipPath id={`${uid}-glass`}><Path d="M104 150H296L200 280Z" /></ClipPath>}>
      <Path d="M104 150H296L200 280Z" fill={p.motif} opacity={0.95} />
      <Rect x={60} y={218} width={280} height={80} fill={p.accent} clipPath={`url(#${uid}-glass)`} />
      <Rect x={195} y={278} width={10} height={100} fill={p.ink} />
      <Ellipse cx={200} cy={386} rx={58} ry={9} fill={p.ink} />
      <Line x1={262} y1={96} x2={222} y2={196} stroke={p.ink} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={268} cy={90} r={17} fill={p.accent} />
      <Circle cx={268} cy={90} r={6} fill={p.ink} opacity={0.6} />
      <Circle cx={166} cy={186} r={7} fill={p.bg1} opacity={0.6} />
      <Circle cx={196} cy={206} r={5} fill={p.bg1} opacity={0.6} />
      <Circle cx={230} cy={178} r={6} fill={p.bg1} opacity={0.6} />
      <Sparkle cx={72} cy={96} r={22} fill={p.accent} />
      <Sparkle cx={338} cy={300} r={16} fill={p.motif} />
    </Poster>
  );
};
