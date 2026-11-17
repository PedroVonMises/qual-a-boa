import { locationShareMessage, mapsLink, telUrl } from './safetyReport';

const place = { name: 'Casa Maré', address: 'Rua da Praia, 10', lat: -20.3, lng: -40.29 };

describe('emergency helpers (S4)', () => {
  it('dials only digits', () => {
    expect(telUrl('1 9 0')).toBe('tel:190');
  });

  it('builds a universal maps link', () => {
    expect(mapsLink(-20.3, -40.29)).toBe('https://www.google.com/maps/search/?api=1&query=-20.300000,-40.290000');
  });

  it('shares my own position when there is a fix', () => {
    expect(locationShareMessage({ ...place, eventTitle: 'Noite do Funk' }, { lat: -20.31, lng: -40.3 })).toBe(
      'Estou em Noite do Funk, na Casa Maré (Rua da Praia, 10). Minha localização agora: https://www.google.com/maps/search/?api=1&query=-20.310000,-40.300000',
    );
  });

  it('falls back to the venue position', () => {
    expect(locationShareMessage({ ...place, address: undefined }, null)).toBe(
      'Estou na Casa Maré. Endereço no mapa: https://www.google.com/maps/search/?api=1&query=-20.300000,-40.290000',
    );
  });
});
