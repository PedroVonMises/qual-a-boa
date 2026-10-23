import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

type Instance = ReactTestInstance | { props: { style?: unknown } };

/** Effective height (minHeight wins over height when larger) of a rendered host element. */
export function heightOf(el: Instance): number {
  const s = StyleSheet.flatten(el.props.style as never) as { height?: number; minHeight?: number } | undefined;
  return Math.max(Number(s?.height ?? 0), Number(s?.minHeight ?? 0));
}

export function widthOf(el: Instance): number {
  const s = StyleSheet.flatten(el.props.style as never) as { width?: number; minWidth?: number } | undefined;
  return Math.max(Number(s?.width ?? 0), Number(s?.minWidth ?? 0));
}

export const HIDDEN = { includeHiddenElements: true } as const;
