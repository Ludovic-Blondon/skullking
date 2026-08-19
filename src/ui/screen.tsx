import { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: ReactNode;
  /** Ajoute l'inset bas (écrans hors onglets, où la tab bar ne le fait pas). */
  edgeToEdgeBottom?: boolean;
  /** Laisse voir ce qui est peint dessous — un filigrane, typiquement. */
  transparent?: boolean;
};

/** Conteneur d'écran : fond thémé, scroll, marges cohérentes. */
export function Screen({ children, edgeToEdgeBottom = false, transparent = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className={`flex-1 ${transparent ? '' : 'bg-surface'}`}
      contentContainerClassName="gap-3 p-4"
      contentContainerStyle={{ paddingBottom: edgeToEdgeBottom ? insets.bottom + 16 : 16 }}
      contentInsetAdjustmentBehavior="automatic"
      // Sans ça, clavier ouvert, le premier appui sur un bouton ne sert qu'à
      // fermer le clavier : ajouter un joueur demandait deux gestes.
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/**
 * Filigrane de fond : un emoji surdimensionné à très faible opacité, posé en
 * bas à droite. La maquette prévoyait un crâne dessiné ; l'emoji évite d'ajouter
 * une dépendance native pour un décor, et reste dans la consigne « aucun
 * artwork officiel » (PLAN.md §12.1).
 */
export function Watermark({ emoji = '☠️', size = 200 }: { emoji?: string; size?: number }) {
  return (
    <View pointerEvents="none" className="absolute -bottom-6 -right-10 opacity-[0.04]">
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </View>
  );
}

/** Carte de contenu (surface surélevée). */
export function Card({ children }: { children: ReactNode }) {
  return <View className="gap-2 rounded-card bg-surface-raised p-4">{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text className="font-title text-h1 text-content">{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text className="font-body text-body text-content-muted">{children}</Text>;
}

/** Intertitre de section : petites capitales espacées, très discrètes. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="font-semi text-micro uppercase tracking-widest text-content-muted">
      {children}
    </Text>
  );
}

/** État vide : un emoji, une phrase, une invitation. */
export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View className="items-center gap-1.5 rounded-card bg-surface-raised p-6">
      <Text className="text-3xl">{emoji}</Text>
      <Text className="text-center font-semi text-h2 text-content">{title}</Text>
      {children && (
        <Text className="text-center font-body text-caption text-content-muted">{children}</Text>
      )}
    </View>
  );
}

/**
 * Écran d'attente d'une phase du plan de développement.
 * À supprimer au fur et à mesure que les phases P3→P5 remplissent les routes.
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
        <View className="self-start rounded-full bg-accent px-2.5 py-1">
          <Text className="font-title text-micro uppercase tracking-widest text-accent-fg">
            {phase}
          </Text>
        </View>
        <Title>{title}</Title>
        <Body>{children}</Body>
      </Card>
    </Screen>
  );
}
