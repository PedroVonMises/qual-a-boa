import { Chip } from './Chip';

export interface HelpfulButtonProps {
  count: number;
  selected: boolean;
  onPress: () => void;
  /** Your own comment: the count shows but cannot be voted. */
  disabled?: boolean;
  testID?: string;
}

/** Single-tap "Útil" toggle (no downvote). Selected state shows a check, not color alone. */
export function HelpfulButton({ count, selected, onPress, disabled, testID }: HelpfulButtonProps) {
  return <Chip testID={testID} label="Útil" count={count} selected={selected} disabled={disabled} onPress={onPress} />;
}
