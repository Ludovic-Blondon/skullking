import { cardsDealtFor } from '../game';
import { rules } from './helpers';

/**
 * PLAN.md §4.1 : la manche N distribue N cartes, sauf à 8 joueurs où les
 * manches 9 et 10 se jouent à 8 cartes. C'est de cette règle que dépend le
 * décompte des mises 0 en fin de partie (§12.4).
 */
describe('cardsDealtFor', () => {
  const officialRule = (roundNumber: number, playerCount: number) =>
    playerCount === 8 && roundNumber >= 9 ? 8 : roundNumber;

  for (let playerCount = 2; playerCount <= 8; playerCount += 1) {
    for (let roundNumber = 1; roundNumber <= 10; roundNumber += 1) {
      it(`manche ${roundNumber} à ${playerCount} joueurs`, () => {
        expect(cardsDealtFor(roundNumber, playerCount)).toBe(
          officialRule(roundNumber, playerCount),
        );
      });
    }
  }

  it('plafonne bien les deux dernières manches à 8 joueurs', () => {
    expect(cardsDealtFor(9, 8)).toBe(8);
    expect(cardsDealtFor(10, 8)).toBe(8);
    // À 7 joueurs le paquet suffit encore : 7 × 10 = 70 cartes.
    expect(cardsDealtFor(10, 7)).toBe(10);
  });

  it('renvoie le numéro de manche si le nombre de joueurs est absurde', () => {
    expect(cardsDealtFor(4, 0)).toBe(4);
  });

  /** L'extension porte le paquet à 89 cartes et ouvre une 9ᵉ place (§4.6). */
  describe('avec l’extension', () => {
    const expansion = rules({ expansion: true });

    it('rend leurs 10 cartes aux deux dernières manches à 8 joueurs', () => {
      expect(cardsDealtFor(9, 8, expansion)).toBe(9);
      expect(cardsDealtFor(10, 8, expansion)).toBe(10);
    });

    it('borne les dernières manches à 9 joueurs', () => {
      // 89 cartes pour 9 joueurs : 9 chacun, pas 10.
      expect(cardsDealtFor(9, 9, expansion)).toBe(9);
      expect(cardsDealtFor(10, 9, expansion)).toBe(9);
    });

    it('ne change rien aux manches que le paquet de base couvrait déjà', () => {
      for (let roundNumber = 1; roundNumber <= 8; roundNumber += 1) {
        expect(cardsDealtFor(roundNumber, 8, expansion)).toBe(roundNumber);
      }
    });
  });
});
