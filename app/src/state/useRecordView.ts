import { useEffect } from 'react';

import { useTaste, type ViewKind } from './taste';

/** Records one implicit "viewed" taste signal per screen visit. Pass undefined until the entity has loaded. */
export function useRecordView(kind: ViewKind, id: string | undefined): void {
  const record = useTaste((s) => s.recordView);
  useEffect(() => {
    if (id) record(kind, id);
  }, [kind, id, record]);
}
