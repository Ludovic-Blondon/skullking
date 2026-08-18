import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';

import { Body, Card, Screen, Title } from '@/ui/screen';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <Screen edgeToEdgeBottom>
        <Card>
          <Title>Cette page n'existe pas</Title>
          <Body>Le lien suivi ne correspond à aucun écran de l'application.</Body>
          <Link href="/">
            <Text className="text-base font-semibold text-primary">Retour à l'accueil</Text>
          </Link>
        </Card>
      </Screen>
    </>
  );
}
