import { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: ReactNode;
  /** Ajoute l'inset bas (écrans hors onglets, où la tab bar ne le fait pas). */
  edgeToEdgeBottom?: boolean;
};

/** Conteneur d'écran : fond thémé, scroll, marges cohérentes. */
export function Screen({ children, edgeToEdgeBottom = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4"
      contentContainerStyle={{ paddingBottom: edgeToEdgeBottom ? insets.bottom + 16 : 16 }}
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

/** Carte de contenu (surface surélevée + bordure). */
export function Card({ children }: { children: ReactNode }) {
  return (
    <View className="gap-2 rounded-card border border-border bg-surface-raised p-4">
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold text-content">{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text className="text-base leading-6 text-content-muted">{children}</Text>;
}

/**
 * Écran d'attente d'une phase du plan de développement.
 * À supprimer au fur et à mesure que les phases P2→P5 remplissent les routes.
 */
export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: ReactNode;
}) {
  return (
    <Screen edgeToEdgeBottom>
      <Card>
        <View className="self-start rounded-full bg-accent px-2 py-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-accent-fg">
            {phase}
          </Text>
        </View>
        <Title>{title}</Title>
        <Body>{children}</Body>
      </Card>
    </Screen>
  );
}
