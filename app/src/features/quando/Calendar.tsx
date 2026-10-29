import { StyleSheet, View } from 'react-native';

import {
  WEEKDAY_INITIALS,
  addMonths,
  compareMonths,
  longDayLabel,
  monthGrid,
  monthTitle,
  type MonthRef,
} from '@/domain/calendar';
import { dayNumberOf, normalizeDays, type DayRange } from '@/domain/filters';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import { IconButton, PressableScale, Text } from '@/ui';

export interface CalendarProps {
  month: MonthRef;
  onMonthChange: (m: MonthRef) => void;
  /** First and last month the user can reach. */
  minMonth: MonthRef;
  maxMonth: MonthRef;
  /** SP day number of tonight; earlier days are disabled. */
  today: number;
  selected: DayRange | null;
  onPick: (dayNumber: number) => void;
}

/** Month grid (weeks start on Sunday) with a single-night or range selection. Every day is a 44px button. */
export function Calendar({ month, onMonthChange, minMonth, maxMonth, today, selected, onPick }: CalendarProps) {
  const { colors } = useTheme();
  const sel = normalizeDays(selected);
  const a = sel ? dayNumberOf(sel.from)! : null;
  const b = sel ? dayNumberOf(sel.to)! : null;
  const cells = monthGrid(month);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View style={styles.wrap} testID="quando-calendar">
      <View style={styles.header}>
        <IconButton
          icon="chevronLeft"
          label="Mês anterior"
          disabled={compareMonths(month, minMonth) <= 0}
          onPress={() => onMonthChange(addMonths(month, -1))}
        />
        <Text variant="body" accessibilityRole="header" style={styles.bold} testID="quando-month">
          {monthTitle(month)}
        </Text>
        <IconButton
          icon="chevronRight"
          label="Próximo mês"
          disabled={compareMonths(month, maxMonth) >= 0}
          onPress={() => onMonthChange(addMonths(month, 1))}
        />
      </View>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text key={i} variant="caption" tone="textMuted" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell, ci) => {
            if (!cell) return <View key={ci} style={styles.cell} />;
            const dn = cell.dayNumber;
            const past = dn < today;
            const isEdge = dn === a || dn === b;
            const inside = a != null && b != null && dn > a && dn < b;
            const isToday = dn === today;
            const label = `${longDayLabel(dn)}${isToday ? ', hoje' : ''}`;
            return (
              <PressableScale
                key={ci}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isEdge || inside, disabled: past }}
                disabled={past}
                onPress={() => onPick(dn)}
                testID={`quando-day-${cell.day}`}
                style={[
                  styles.cell,
                  styles.day,
                  inside && { backgroundColor: colors.surfaceAlt },
                  isEdge && { backgroundColor: colors.accent, borderRadius: radius.sm },
                  isToday && !isEdge && { borderWidth: 1.5, borderColor: colors.textMuted, borderRadius: radius.sm },
                ]}>
                <Text
                  variant="mono"
                  tone={isEdge ? colors.onAccent : past ? colors.textMuted : colors.text}
                  style={[past && styles.past, isEdge && styles.bold]}>
                  {cell.day}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space.xs },
  cell: { flex: 1, minHeight: hit.min },
  day: { alignItems: 'center', justifyContent: 'center' },
  past: { opacity: 0.55 },
  bold: { fontWeight: '600' },
});
