import { Chip } from './Chip';

export interface HelpfulButtonProps {
  count: number;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** Single-tap "Útil" toggle (no downvote). Selected state shows a check, not color alone. */
export function HelpfulButton({ count, selected, onPress, testID }: HelpfulButtonProps) {
  return <Chip testID={testID} label="Útil" count={count} selected={selected} onPress={onPress} />;
}
