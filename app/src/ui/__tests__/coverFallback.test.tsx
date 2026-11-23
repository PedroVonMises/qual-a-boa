import '@/ui/testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { ArtistRow } from '../ArtistRow';
import { Cover } from '../Cover';

const opts = { includeHiddenElements: true } as const;

describe('Media fallbacks (zero broken images)', () => {
  it('Cover skips invalid/non-https URLs and renders deterministic SVG art directly', async () => {
    await render(
      <ThemeProvider mode="dark">
        <Cover coverKey="art:disco:rosa-ambar:a" imageUrl="http://insecure.example/broken.jpg" />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('cover-image', opts)).toBeNull();
    expect(screen.getByTestId('cover-art:disco:rosa-ambar:a', opts)).toBeTruthy();
  });

  it('Cover falls back to deterministic SVG art when a remote https image fails to load', async () => {
    await render(
      <ThemeProvider mode="dark">
        <Cover coverKey="bolt" imageUrl="https://cdn.example.com/missing.jpg" />
      </ThemeProvider>,
    );
    const img = screen.getByTestId('cover-image', opts);
    await fireEvent(img, 'error', { nativeEvent: { error: '404' } });
    expect(screen.queryByTestId('cover-image', opts)).toBeNull();
    expect(screen.getByTestId('cover-bolt', opts)).toBeTruthy();
  });

  it('ArtistRow falls back to initials when artist image URL is invalid or fails', async () => {
    await render(
      <ThemeProvider mode="dark">
        <ArtistRow name="DJ Maresia" imageUri="javascript:alert(1)" />
      </ThemeProvider>,
    );
    expect(screen.getByText('DM')).toBeTruthy();
  });
});
