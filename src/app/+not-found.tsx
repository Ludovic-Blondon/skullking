import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';

import { useT } from '@/i18n';
import { Body, Card, Screen, Title } from '@/ui/screen';

export default function NotFoundScreen() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <Screen edgeToEdgeBottom>
        <Card>
          <Title>{t('notFound.heading')}</Title>
          <Body>{t('notFound.body')}</Body>
          <Link href="/">
            <Text className="font-semi text-body text-primary">{t('common.back')}</Text>
          </Link>
        </Card>
      </Screen>
    </>
  );
}
