import { Defs, Path, Polygon, Rect } from 'react-native-svg';

import { Grad, INK, Person } from './parts';

export function BoltArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, '#0E3636'], [0.6, '#1B2322'], [1, '#1D1513']]} />
        <Grad id={`${uid}-beam`} stops={[[0, '#F4F1EC', 0.22], [1, '#F4F1EC', 0]]} />
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <Polygon points="200,-20 40,420 120,420" fill={`url(#${uid}-beam)`} />
      <Polygon points="200,-20 280,420 360,420" fill={`url(#${uid}-beam)`} />
      <Polygon points="200,-20 150,420 250,420" fill="#FF4F81" opacity={0.14} />
      <Path d="M236 36L118 262H192L158 440L296 190H218L266 36Z" fill="#FF4F81" />
      <Path
        d="M236 36L118 262H192L158 440L296 190H218L266 36Z"
        fill="none"
        stroke="#F2A65A"
        strokeWidth={4}
        strokeLinejoin="round"
        transform="translate(10 8)"
        opacity={0.7}
      />
      <Rect x={0} y={372} width={400} height={128} fill={INK} />
      <Person x={-6} y={352} w={64} h={98} arms />
      <Person x={52} y={372} w={60} h={105} />
      <Person x={104} y={344} w={68} h={104} arms />
      <Person x={166} y={380} w={60} h={105} />
      <Person x={220} y={350} w={66} h={100} arms />
      <Person x={280} y={368} w={62} h={108} />
      <Person x={334} y={346} w={68} h={104} arms />
    </>
  );
}
