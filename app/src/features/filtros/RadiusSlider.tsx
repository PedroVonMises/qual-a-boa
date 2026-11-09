import { RADIUS_OPTIONS, type RadiusKm } from '@/domain/filters';
import { StepSlider } from '@/ui';

export const radiusLabel = (v: RadiusKm) => `Até ${v} km`;
const radiusShort = (v: RadiusKm) => `${v} km`;

interface Props {
  value: RadiusKm;
  onChange: (v: RadiusKm) => void;
}

/** Party radius on the shared StepSlider (1/3/5/10/25 km). Used by Filtros, Perfil and the Mapa. */
export function RadiusSlider({ value, onChange }: Props) {
  return (
    <StepSlider
      steps={RADIUS_OPTIONS}
      value={value}
      onChange={onChange}
      label="Raio das festas"
      formatValue={radiusLabel}
      formatShort={radiusShort}
      testID="radius-stepper"
      valueTestID="radius-value"
    />
  );
}
