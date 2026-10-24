import { Platform } from 'react-native';

/** Index a radio group should move to for a key press, or null when the key is not a navigation key. */
export function nextRadioIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

interface KeyEventLike {
  key: string;
  preventDefault?: () => void;
  currentTarget?: unknown;
}

export interface RadioGroupBinding {
  /** Spread on the radiogroup container. Empty on native. */
  group: object;
  /** Spread on the radio at `index`. Always carries aria-checked; adds roving tabIndex on web. */
  item: (index: number) => object;
}

/**
 * Web radio-group keyboard model: one tab stop (the checked radio, else the first), and
 * Left/Right/Up/Down/Home/End move focus and select. Native behaviour is unchanged.
 *
 * @param selected index of the checked radio, -1 when none
 * @param count number of radios
 * @param onSelect called with the new index when a key moves the selection
 */
export function radioGroup(selected: number, count: number, onSelect: (index: number) => void): RadioGroupBinding {
  const web = Platform.OS === 'web';
  const stop = selected >= 0 ? selected : 0;
  return {
    group: web
      ? {
          onKeyDown: (e: KeyEventLike) => {
            const el = e.currentTarget as HTMLElement | undefined;
            const radios = el?.querySelectorAll?.('[role="radio"]');
            if (!radios || !radios.length) return;
            const active = typeof document !== 'undefined' ? document.activeElement : null;
            const at = Array.prototype.indexOf.call(radios, active);
            const next = nextRadioIndex(e.key, at >= 0 ? at : stop, radios.length);
            if (next === null) return;
            e.preventDefault?.();
            (radios[next] as HTMLElement).focus();
            onSelect(next);
          },
        }
      : {},
    item: (index) => ({
      'aria-checked': index === selected,
      ...(web ? { tabIndex: index === stop ? 0 : -1 } : {}),
    }),
  };
}
