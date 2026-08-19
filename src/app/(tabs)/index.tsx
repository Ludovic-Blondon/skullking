import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { db } from '@/db/client';
import { games } from '@/db/schema';
import { Screen, Watermark } from '@/ui/screen';

/** Raccourcis de l'accueil (PLAN.md §7.1) — la barre d'onglets reste la voie longue. */
const MENU: { emoji: string; label: string; href: Href }[] = [
  { emoji: '📜', label: 'Historique', href: '/history' },
  { emoji: '👥', label: 'Joueurs', href: '/players' },
  { emoji: '📊', label: 'Stats', href: '/stats' },
  { emoji: '⚙️', label: 'Réglages', href: '/settings' },
];

export default function HomeScreen() {
  // Reprise automatique d'une partie interrompue (PLAN.md §1 et §7.1).
  const { data: ongoing } = useLiveQuery(
    db
      .select()
      .from(games)
      .where(eq(games.status, 'in_progress'))
      .orderBy(desc(games.createdAt))
      .limit(1),
  );
  const current = ongoing[0];

  return (
    <View className="flex-1 bg-surface">
      <Watermark emoji="🏴‍☠️" size={220} />
      <Screen transparent>
        {current ? (
          <Link href={{ pathname: '/game/[id]', params: { id: String(current.id) } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reprendre la partie"
              testID="resume-game"
              className="gap-1 rounded-card bg-primary p-4 active:opacity-80">
              <Text className="font-semi text-micro uppercase tracking-widest text-primary-fg opacity-70">
                Partie en cours
              </Text>
              <Text className="font-title text-h2 text-primary-fg">
                Reprendre — manche {current.currentRound}
              </Text>
              <Text className="font-body text-caption text-primary-fg opacity-70">
                {current.currentPhase === 'bidding' ? 'Annonces' : 'Résultats'}
              </Text>
            </Pressable>
          </Link>
        ) : (
          <View className="gap-1 rounded-card bg-surface-raised p-4">
            <Text className="font-title text-h1 text-content">Skull King</Text>
            <Text className="font-body text-body text-content-muted">
              Comptage de points, historique et statistiques. 100 % hors ligne, sans pub ni compte.
            </Text>
          </View>
        )}

        <Link href="/game/new" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouvelle partie"
            testID="new-game"
            className={`min-h-touch items-center justify-center rounded-card p-4 active:opacity-80 ${
              current ? 'bg-surface-raised' : 'bg-primary'
            }`}>
            <Text className={`font-title text-h2 ${current ? 'text-content' : 'text-primary-fg'}`}>
              + Nouvelle partie
            </Text>
          </Pressable>
        </Link>

        <View className="flex-row flex-wrap gap-2.5">
          {MENU.map((item) => (
            <Link key={item.label} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                className="min-h-touch flex-1 basis-[45%] items-center justify-center gap-1 rounded-field bg-surface-raised p-3.5 active:opacity-70">
                <Text className="text-lg">{item.emoji}</Text>
                <Text className="font-semi text-caption text-content-muted">{item.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <Link href="/rules" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aide-mémoire du barème"
            className="min-h-touch items-center justify-center active:opacity-70">
            <Text className="font-body text-caption text-content-muted">
              Aide-mémoire du barème
            </Text>
          </Pressable>
        </Link>
      </Screen>
    </View>
  );
}
