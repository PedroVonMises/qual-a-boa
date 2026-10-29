import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addMonths, monthOf, pickDay, QUICK_RANGES, rangeLabel, type MonthRef } from '@/domain/calendar';
import { dayNumberOf, nightDayNumber, normalizeDays, type DateRange, type DayRange } from '@/domain/filters';
import { useSearchEvents } from '@/data/queries';
import { minuteNow } from '@/features/explorar/clock';
import { useSearchParams } from '@/features/explorar/useSearch';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { Button, Chip, Sheet, Text } from '@/ui';
import { Calendar } from './Calendar';

const viewLabel = (total: number | undefined) =>
  total === undefined ? 'Ver eventos' : total === 1 ? 'Ver 1 evento' : `Ver ${total} eventos`;

/** How far ahead the calendar goes (current month + this many). */
export const QUANDO_MONTHS_AHEAD = 2;

export interface QuandoSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** "Quando?": quick ranges, a calendar for specific nights, and a live count. Applies to the global filters. */
export function QuandoSheet({ visible, onClose }: QuandoSheetProps) {
  // Mounted only while open, so the draft starts from the current filters every time.
  if (!visible) return null;
  return <QuandoBody onClose={onClose} />;
}

function QuandoBody({ onClose }: { onClose: () => void }) {
  const filters = useFilters((s) => s.filters);
  const set = useFilters((s) => s.set);
  const [range, setRange] = useState<DateRange>(filters.dateRange);
  const [days, setDays] = useState<DayRange | null>(filters.dateRange === 'datas' ? normalizeDays(filters.days) : null);

  const today = nightDayNumber(minuteNow());
  const minMonth = monthOf(today);
  const maxMonth = addMonths(minMonth, QUANDO_MONTHS_AHEAD);
  const startDay = range === 'datas' && days ? dayNumberOf(days.from) : null;
  const [month, setMonth] = useState<MonthRef>(startDay != null ? monthOf(startDay) : minMonth);

  const draft = useMemo(() => ({ ...filters, dateRange: range, days: range === 'datas' ? days : null }), [filters, range, days]);
  const total = useSearchEvents(useSearchParams(draft, 1)).data?.pages[0]?.total;

  const apply = () => {
    if (range === 'datas' && !days) set({ dateRange: 'qualquer', days: null });
    else set({ dateRange: range, days: range === 'datas' ? days : null });
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Quando?"
      testID="quando-sheet"
      footer={
        <>
          <Button
            label="Limpar"
            variant="secondary"
            onPress={() => {
              setRange('qualquer');
              setDays(null);
            }}
            testID="quando-clear"
          />
          <Button label={viewLabel(total)} onPress={apply} style={styles.grow} testID="quando-apply" />
        </>
      }>
      <View style={styles.wrap}>
        <View style={styles.chips}>
          {QUICK_RANGES.map((q) => (
            <Chip
              key={q.value}
              label={q.label}
              selected={range === q.value}
              onPress={() => {
                setRange(q.value);
                setDays(null);
              }}
            />
          ))}
        </View>
        <Calendar
          month={month}
          onMonthChange={setMonth}
          minMonth={minMonth}
          maxMonth={maxMonth}
          today={today}
          selected={range === 'datas' ? days : null}
          onPick={(dn) => {
            setDays((cur) => pickDay(range === 'datas' ? cur : null, dn));
            setRange('datas');
          }}
        />
        <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite" testID="quando-summary">
          {range === 'datas' && days
            ? `Noites escolhidas: ${rangeLabel(days)}. Toque em outro dia para estender.`
            : 'Toque em um dia para escolher a noite. Um segundo toque escolhe até quando.'}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grow: { flex: 1 },
});
