import { Image } from 'expo-image';
import { memo, useId, useState, type ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { parseCoverKey } from '@/domain/cover';
import type { CoverKey } from '@/domain/types';
import { BoltArt } from './art/Bolt';
import { CaiporaArt } from './art/Caipora';
import { FluenteArt } from './art/Fluente';
import { GenericArt } from './art/Generic';
import { GordinhoArt } from './art/Gordinho';
import { MareArt } from './art/Mare';
import { paletteById } from './art/palettes';
import { Pub426Art } from './art/Pub426';
import { SelvaArt } from './art/Selva';
import { TEMPLATES } from './art/templates';

const LEGACY_ART: Record<string, ComponentType<{ uid: string }>> = {
  bolt: BoltArt,
  selva: SelvaArt,
  gordinho: GordinhoArt,
  pub426: Pub426Art,
  caipora: CaiporaArt,
  fluente: FluenteArt,
  mare: MareArt,
  generic: GenericArt,
};

export interface CoverProps {
  coverKey: CoverKey;
  /** Organizer poster (https). Falls back to the illustrated cover when missing or when it fails to load. */
  imageUrl?: string;
  style?: StyleProp<ViewStyle>;
}

function Art({ coverKey, uid }: { coverKey: string; uid: string }) {
  const parsed = parseCoverKey(coverKey);
  if (parsed) {
    const Template = (TEMPLATES as Record<string, (typeof TEMPLATES)[keyof typeof TEMPLATES] | undefined>)[parsed.template];
    const palette = paletteById(parsed.palette);
    if (Template && palette) return <>{Template({ palette, variant: parsed.variant, uid })}</>;
  }
  const Legacy = LEGACY_ART[coverKey] ?? GenericArt;
  return <Legacy uid={uid} />;
}

/** Drawn cover art (400x500 source), cropped with "slice" so it always fills its box. */
export const Cover = memo(function Cover({ coverKey, imageUrl, style }: CoverProps) {
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '_')}`;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!imageUrl && failedUrl !== imageUrl;
  return (
    <View style={[styles.box, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {showImage ? (
        <Image
          testID="cover-image"
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible={false}
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" testID={`cover-${coverKey}`}>
          <Art coverKey={coverKey} uid={uid} />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({ box: { overflow: 'hidden' } });
