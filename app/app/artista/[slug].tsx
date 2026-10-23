import { useLocalSearchParams } from 'expo-router';

import { ArtistaScreen } from '@/features/artista/ArtistaScreen';

export default function Screen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ArtistaScreen slug={slug} />;
}
