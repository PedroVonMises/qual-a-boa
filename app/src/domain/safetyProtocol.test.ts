import { cleanSafetyProtocol, isValidResponsible, safetyProtocolPanelLabel, SAFETY_PROTOCOL_COPY } from './safetyProtocol';

describe('safety protocol seal', () => {
  it('only known states survive', () => {
    expect(cleanSafetyProtocol('verified')).toBe('verified');
    expect(cleanSafetyProtocol('contested')).toBe('contested');
    expect(cleanSafetyProtocol('premium')).toBeUndefined();
    expect(cleanSafetyProtocol(null)).toBeUndefined();
  });

  it('copy spells out each state in text', () => {
    expect(SAFETY_PROTOCOL_COPY.verified.label).toBe('Protocolo Não é Não');
    expect(SAFETY_PROTOCOL_COPY.declared.label).toMatch(/^Declara/);
    expect(SAFETY_PROTOCOL_COPY.contested.tone).toBe('danger');
  });

  it('panel label tells not declared from rejected', () => {
    expect(safetyProtocolPanelLabel(null, null)).toBe('Não declarado');
    expect(safetyProtocolPanelLabel(null, 'Foto ilegível')).toBe('Não aprovado');
    expect(safetyProtocolPanelLabel('declared', null)).toBe('Declarado, em análise');
  });

  it('responsible name needs 2 to 120 characters', () => {
    expect(isValidResponsible(' A ')).toBe(false);
    expect(isValidResponsible('Ana')).toBe(true);
    expect(isValidResponsible('x'.repeat(121))).toBe(false);
  });
});
