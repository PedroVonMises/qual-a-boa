import { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Grad } from './parts';

export function SelvaArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, '#FF4F81'], [0.55, '#8E2547'], [1, '#241114']]} />
        <RadialGradient id={`${uid}-ball`} cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FFE2A8" />
          <Stop offset="0.6" stopColor="#F2A65A" />
          <Stop offset="1" stopColor="#9B5A2A" />
        </RadialGradient>
        <ClipPath id={`${uid}-clip`}>
          <Circle cx={200} cy={190} r={74} />
        </ClipPath>
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <G fill="#F4F1EC" opacity={0.12}>
        <Polygon points="200,190 -20,60 20,0 120,0" />
        <Polygon points="200,190 420,60 380,0 280,0" />
        <Polygon points="200,190 -20,300 -20,240" />
        <Polygon points="200,190 420,300 420,240" />
        <Polygon points="200,190 150,520 250,520" />
      </G>
      <Line x1={200} y1={0} x2={200} y2={116} stroke="#1A0A06" strokeWidth={3} />
      <Circle cx={200} cy={190} r={74} fill={`url(#${uid}-ball)`} />
      <G clipPath={`url(#${uid}-clip)`} stroke="#5A2A1E" strokeOpacity={0.45} strokeWidth={2} fill="none">
        <Path d="M126 190H274M134 160H266M134 220H266M150 135H250M150 245H250" />
        <Path d="M200 116V264M165 122Q150 190 165 258M235 122Q250 190 235 258M130 160Q118 190 130 220M270 160Q282 190 270 220" />
      </G>
      <G fill="#1A0A06">
        <Ellipse cx={40} cy={430} rx={30} ry={120} transform="rotate(-28 40 430)" />
        <Ellipse cx={86} cy={450} rx={26} ry={100} transform="rotate(12 86 450)" />
        <Ellipse cx={14} cy={360} rx={22} ry={80} transform="rotate(-60 14 360)" />
        <Ellipse cx={360} cy={430} rx={30} ry={120} transform="rotate(28 360 430)" />
        <Ellipse cx={314} cy={450} rx={26} ry={100} transform="rotate(-12 314 450)" />
        <Ellipse cx={386} cy={360} rx={22} ry={80} transform="rotate(60 386 360)" />
        <Ellipse cx={200} cy={520} rx={150} ry={60} />
      </G>
    </>
  );
}
