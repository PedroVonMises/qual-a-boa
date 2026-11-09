import { formatBRL } from '@/domain/format';
import { StepSlider } from '@/ui';

export const PRICE_STEPS: (number | null)[] = [0, 20, 40, 60, null];

export function priceStepLabel(v: number | null): string {
  if (v === null) return 'Sem limite';
  if (v === 0) return 'Grátis';
  return `Até ${formatBRL(v).replace(',00', '')}`;
}

function shortLabel(v: number | null): string {
  if (v === null) return 'Sem limite';
  return v === 0 ? 'Grátis' : formatBRL(v).replace(',00', '');
}

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
}

/** Price ceiling: five discrete stops on the shared StepSlider. */
export function PriceStepper({ value, onChange }: Props) {
  return (
    <StepSlider
      steps={PRICE_STEPS}
      value={value}
      onChange={onChange}
      label="Preço máximo"
      formatValue={priceStepLabel}
      formatShort={shortLabel}
      testID="price-stepper"
      valueTestID="price-value"
    />
  );
}
