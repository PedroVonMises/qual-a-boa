import { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/theme/tokens';
import { Grad, INK } from './parts';

export function Pub426Art({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, '#2A1418'], [1, '#14100F']]} />
        <Grad id={`${uid}-sun`} stops={[[0, '#F2A65A'], [1, '#FF4F81']]} />
        <ClipPath id={`${uid}-clip`}>
          <Circle cx={200} cy={230} r={128} />
        </ClipPath>
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <Circle cx={200} cy={230} r={128} fill={`url(#${uid}-sun)`} />
      <G clipPath={`url(#${uid}-clip)`} fill="#2A1418">
        <Rect x={60} y={240} width={280} height={8} />
        <Rect x={60} y={270} width={280} height={12} />
        <Rect x={60} y={304} width={280} height={16} />
        <Rect x={60} y={340} width={280} height={20} />
      </G>
      <SvgText
        x={200}
        y={160}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontWeight="900"
        fontSize={64}
        fill="none"
        stroke="#F4F1EC"
        strokeWidth={3}
        letterSpacing={4}>
        426
      </SvgText>
      <G stroke="#F4F1EC" strokeOpacity={0.35} strokeWidth={2}>
        <Line x1={0} y1={400} x2={400} y2={400} />
        <Line x1={200} y1={400} x2={-60} y2={500} />
        <Line x1={200} y1={400} x2={60} y2={500} />
        <Line x1={200} y1={400} x2={200} y2={500} />
        <Line x1={200} y1={400} x2={340} y2={500} />
        <Line x1={200} y1={400} x2={460} y2={500} />
        <Line x1={0} y1={440} x2={400} y2={440} />
        <Line x1={0} y1={475} x2={400} y2={475} />
      </G>
      <G fill={INK}>
        <Rect x={48} y={300} width={8} height={200} />
        <Ellipse cx={52} cy={292} rx={16} ry={20} />
        <Path d="M52 320Q70 360 96 360" stroke={INK} strokeWidth={6} fill="none" />
        <Path d="M300 500L330 330L348 336L330 500Z" />
        <Ellipse cx={352} cy={310} rx={34} ry={24} transform="rotate(-30 352 310)" />
        <Rect x={336} y={212} width={8} height={120} transform="rotate(25 340 270)" />
      </G>
    </>
  );
}
