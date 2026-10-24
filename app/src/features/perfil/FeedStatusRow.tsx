import { useEffect, useState } from 'react';

import { relativeTimePt, useFeedStatus } from '@/data/feedStatus';
import { ListRow } from '@/ui';

/** Perfil > Sobre: when the event feed was last checked; tap to refresh. Rendered only for the feed data source. */
export function FeedStatusRow({ divider = true }: { divider?: boolean }) {
  const feed = useFeedStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!feed.enabled) return null;
  const subtitle = feed.refreshing
    ? 'Atualizando…'
    : feed.source === 'seed'
      ? 'Usando dados de exemplo. Toque para atualizar'
      : 'Toque para atualizar';
  return (
    <ListRow
      title="Dados atualizados"
      subtitle={subtitle}
      value={feed.updatedAt ? relativeTimePt(feed.updatedAt, now) : undefined}
      divider={divider}
      disabled={feed.refreshing}
      testID="feed-status-row"
      onPress={() => {
        setNow(Date.now());
        void feed.refresh().then(() => setNow(Date.now()));
      }}
    />
  );
}
