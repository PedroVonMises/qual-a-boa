import { Platform } from 'react-native';

import { SheetNative } from './SheetNative';
import { SheetWeb } from './SheetWeb';
import type { SheetProps } from './sheetTypes';

export type { SheetProps } from './sheetTypes';

/**
 * Bottom sheet on native (@gorhom/bottom-sheet inside a Modal); on web, a modal bottom panel,
 * or a right-hand drawer at >= 1024px (filters).
 */
export function Sheet(props: SheetProps) {
  if (!props.visible) return null;
  return Platform.OS === 'web' ? <SheetWeb {...props} /> : <SheetNative {...props} />;
}
