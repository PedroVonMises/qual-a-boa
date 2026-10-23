import type { ReactNode } from 'react';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Sticky footer (e.g. "Limpar" + "Ver N eventos"). */
  footer?: ReactNode;
  testID?: string;
}
