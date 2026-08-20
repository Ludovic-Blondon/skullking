import { tokens, type ThemeName } from '../tokens';

/**
 * Audit de contraste (PLAN.md §11, critère d'acceptation de P6).
 *
 * Un chiffre plutôt qu'un avis : le contraste se calcule, il ne se discute pas.
 * Ce test garde les deux thèmes au-dessus du seuil AA du WCAG, pour que
 * retoucher une couleur ne puisse pas dégrader la lisibilité en silence.
 *
 * Le seuil retenu est celui du **texte normal** (4,5:1) : l'app affiche
 * l'essentiel de ses informations secondaires en 11 et 13 px, tailles qui ne
 * bénéficient d'aucune tolérance.
 */

const AA_NORMAL = 4.5;

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(index, index + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative, telle que définie par le WCAG. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Toutes les paires que l'app met réellement à l'écran. */
const PAIRS: [fg: keyof typeof tokens.light, bg: keyof typeof tokens.light][] = [
  ['content', 'surface'],
  ['content', 'surfaceRaised'],
  ['content', 'surfaceSunken'],
  ['contentMuted', 'surface'],
  ['contentMuted', 'surfaceRaised'],
  ['contentMuted', 'surfaceSunken'],
  ['primary', 'surface'],
  ['primary', 'surfaceRaised'],
  ['accent', 'surface'],
  ['accent', 'surfaceRaised'],
  ['positive', 'surface'],
  ['positive', 'surfaceRaised'],
  ['negative', 'surface'],
  ['negative', 'surfaceRaised'],
  // Texte posé sur un aplat de couleur : boutons et bandeaux.
  ['primaryFg', 'primary'],
  ['accentFg', 'accent'],
];

describe.each(['light', 'dark'] as ThemeName[])('contraste — thème %s', (theme) => {
  it.each(PAIRS)('%s sur %s atteint le seuil AA', (foreground, background) => {
    const ratio = contrast(tokens[theme][foreground], tokens[theme][background]);
    // Le message d'échec porte le ratio mesuré : on sait de combien on manque.
    expect({ pair: `${foreground}/${background}`, ratio: Number(ratio.toFixed(2)) }).toMatchObject({
      ratio: expect.any(Number),
    });
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('mesure', () => {
  it('reconnaît les extrêmes', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#123456', '#123456')).toBeCloseTo(1, 5);
  });
});
