import { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme/tokens';
import { Grad } from './parts';

/** Fictional venue "Casa Mare": a gradient poster (wine to burgundy) with a low amber sun and tide lines. */
export function MareArt({ uid }: { uid: string }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, palette.wine], [0.6, palette.burgundy], [1, '#241114']]} />
        <ClipPath id={`${uid}-clip`}>
          <Circle cx={200} cy={250} r={96} />
        </ClipPath>
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <Circle cx={200} cy={250} r={96} fill={palette.amber} fillOpacity={0.9} />
      <G clipPath={`url(#${uid}-clip)`} fill={palette.burgundy}>
        <Rect x={90} y={262} width={220} height={6} />
        <Rect x={90} y={286} width={220} height={9} />
        <Rect x={90} y={314} width={220} height={13} />
      </G>
      <G fill="none" stroke={palette.blush} strokeOpacity={0.45} strokeWidth={3}>
        <Path d="M0 380Q50 350 100 380T200 380T300 380T400 380" />
        <Path d="M0 420Q50 390 100 420T200 420T300 420T400 420" strokeOpacity={0.3} />
        <Path d="M0 460Q50 430 100 460T200 460T300 460T400 460" strokeOpacity={0.2} />
      </G>
    </>
  );
}
