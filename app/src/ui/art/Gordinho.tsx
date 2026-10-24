import { Circle, Defs, G, Path, Rect } from 'react-native-svg';

import { Grad, INK, Person } from './parts';

const LAMPS: [number, number][] = [[30, 76], [90, 93], [150, 82], [210, 60], [270, 68], [330, 62], [385, 48]];
const RING: [number, number][] = [
  [200, 136], [252, 150], [290, 188], [304, 240], [290, 292], [252, 330],
  [200, 344], [148, 330], [110, 292], [96, 240], [110, 188], [148, 150],
];

export function GordinhoArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, '#F2A65A'], [0.55, '#8A4228'], [1, '#1D1513']]} />
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <Circle cx={200} cy={230} r={150} fill="#FF4F81" opacity={0.7} />
      <Path d="M-10 40Q100 110 200 60T410 40" fill="none" stroke="#1A0A06" strokeWidth={3} />
      <G fill="#FFE2A8">
        {LAMPS.map(([x, y]) => (
          <Circle key={x} cx={x} cy={y} r={9} />
        ))}
      </G>
      <Circle cx={200} cy={240} r={96} fill="#5A2A1E" />
      <Circle cx={200} cy={240} r={96} fill="none" stroke="#F2A65A" strokeWidth={10} />
      <Circle cx={200} cy={240} r={70} fill="#7A3B2A" />
      <G fill="#FFE2A8">
        {RING.map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={7} />
        ))}
      </G>
      <Rect x={0} y={392} width={400} height={108} fill={INK} />
      <Person x={-10} y={366} w={62} h={108} />
      <Person x={46} y={344} w={68} h={104} arms />
      <Person x={112} y={372} w={60} h={105} />
      <Person x={168} y={348} w={66} h={100} arms />
      <Person x={232} y={370} w={62} h={108} />
      <Person x={290} y={342} w={68} h={104} arms />
      <Person x={350} y={368} w={60} h={105} />
    </>
  );
}
