import { Circle, Defs, G, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme/tokens';
import { Grad } from './parts';

/** Neutral cover: wine gradient with the bulb mark (unlit) as a watermark. */
export function GenericArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, palette.wine], [1, '#14100F']]} />
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <G transform="translate(200 250) scale(1.4) rotate(-45)" opacity={0.28}>
        <G fill="none" stroke={palette.blush} strokeWidth={16} strokeLinecap="round">
          <Path d="M29.1 54.7A62 62 0 1 0 -29.1 54.7" />
          <Path d="M29.1 54.7L21 72M-29.1 54.7L-21 72" />
        </G>
        <Rect x={-21} y={78} width={42} height={13} rx={6.5} fill={palette.blush} />
        <Rect x={-15} y={95} width={30} height={11} rx={5.5} fill={palette.blush} />
        <Circle cx={0} cy={-2} r={13} fill={palette.blush} />
      </G>
    </>
  );
}
