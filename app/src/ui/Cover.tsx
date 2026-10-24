import type { ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { CoverKey } from '@/domain/types';
import { BoltArt } from './art/Bolt';
import { CaiporaArt } from './art/Caipora';
import { FluenteArt } from './art/Fluente';
import { GenericArt } from './art/Generic';
import { GordinhoArt } from './art/Gordinho';
import { MareArt } from './art/Mare';
import { Pub426Art } from './art/Pub426';
import { SelvaArt } from './art/Selva';

const ART: Record<string, ComponentType> = {
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
  /** Organizer poster (https); rendered by Wave 7-B. Until then the illustrated cover is always drawn. */
  imageUrl?: string;
  style?: StyleProp<ViewStyle>;
}

/** Drawn cover art (400x500 source), cropped with "slice" so it always fills its box. */
export function Cover({ coverKey, style }: CoverProps) {
  const Art = ART[coverKey] ?? GenericArt;
  return (
    <View style={[styles.box, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" testID={`cover-${coverKey}`}>
        <Art />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ box: { overflow: 'hidden' } });
