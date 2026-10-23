import { Circle, Defs, G, Polygon, Rect } from 'react-native-svg';

import { Grad } from './parts';

export function CaiporaArt() {
  return (
    <>
      <Defs>
        <Grad id="cai-bg" stops={[[0, '#3A3835'], [1, '#181716']]} />
        <Grad id="cai-fog" stops={[[0, '#A8A29A', 0], [1, '#A8A29A', 0.25]]} />
      </Defs>
      <Rect width={400} height={500} fill="url(#cai-bg)" />
      <Circle cx={270} cy={130} r={64} fill="none" stroke="#F4F1EC" strokeOpacity={0.35} strokeWidth={2} />
      <Circle cx={270} cy={130} r={50} fill="#F4F1EC" fillOpacity={0.1} />
      <G fill="#262421">
        <Polygon points="0,500 0,260 40,330 70,250 110,340 140,270 190,500" />
        <Polygon points="200,500 250,280 290,350 320,260 360,340 400,270 400,500" />
      </G>
      <Rect x={0} y={300} width={400} height={140} fill="url(#cai-fog)" />
      <G fill="#14130F">
        <Polygon points="-20,500 20,300 40,360 70,280 100,370 130,320 160,500" />
        <Polygon points="170,500 210,360 240,420 270,330 300,430 340,350 380,500" />
        <Polygon points="90,500 120,400 150,470 180,410 210,500" />
        <Rect x={46} y={320} width={10} height={180} />
        <Rect x={300} y={340} width={10} height={160} />
      </G>
      <Circle cx={200} cy={420} r={26} fill="#F2A65A" fillOpacity={0.25} />
      <Circle cx={200} cy={420} r={11} fill="#F2A65A" />
      <Rect x={196} y={405} width={8} height={4} fill="#14130F" />
    </>
  );
}
