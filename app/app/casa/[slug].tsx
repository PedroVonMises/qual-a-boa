import { useLocalSearchParams } from 'expo-router';

import { CasaScreen } from '@/features/casa/CasaScreen';

export default function Screen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <CasaScreen slug={slug} />;
}
