import { Circle, Defs, G, Path, Rect } from 'react-native-svg';

import { Grad } from './parts';

export function FluenteArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} x2={1} y2={1} stops={[[0, '#F2A65A'], [0.5, '#FF4F81'], [1, '#3A1420']]} />
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <G fill="none" stroke="#F4F1EC" strokeOpacity={0.5} strokeWidth={3}>
        <Path d="M20 250Q60 170 100 250T180 250T260 250T340 250T420 250" />
        <Path d="M20 290Q60 210 100 290T180 290T260 290T340 290T420 290" strokeOpacity={0.3} />
        <Path d="M20 210Q60 130 100 210T180 210T260 210T340 210T420 210" strokeOpacity={0.3} />
      </G>
      <G fill="#14100F">
        <Rect x={60} y={150} width={130} height={300} rx={18} />
        <Rect x={210} y={210} width={130} height={240} rx={18} />
      </G>
      <G fill="none" stroke="#F2A65A" strokeWidth={5}>
        <Circle cx={125} cy={240} r={44} />
        <Circle cx={125} cy={240} r={22} />
        <Circle cx={125} cy={368} r={30} />
        <Circle cx={275} cy={300} r={44} />
        <Circle cx={275} cy={300} r={22} />
        <Circle cx={275} cy={400} r={22} />
      </G>
      <G fill="#FF4F81">
        <Circle cx={125} cy={240} r={9} />
        <Circle cx={275} cy={300} r={9} />
      </G>
    </>
  );
}
