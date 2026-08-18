import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { tokens } from '../tokens';

/**
 * `src/global.css` (utilisé par NativeWind) et `src/ui/tokens.ts` (utilisé par le
 * thème de navigation et les graphiques) décrivent la même palette. Ce test
 * garantit qu'ils ne divergent pas : oublier un jeton d'un côté est une erreur
 * silencieuse qui ne se voit qu'en mode sombre, sur un écran, un jour.
 */
function cssVariables(block: string): string[] {
  return [...block.matchAll(/--color-([a-z-]+)\s*:/g)].map(([, name]) => name);
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const css = readFileSync(join(__dirname, '..', '..', 'global.css'), 'utf8');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark:root {'));
const darkBlock = css.slice(css.indexOf('.dark:root {'));

describe('jetons de design', () => {
  it('déclare les mêmes clés en clair et en sombre côté JS', () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort());
  });

  it('reste aligné avec les variables CSS du thème clair', () => {
    expect(cssVariables(lightBlock).map(toCamelCase).sort()).toEqual(
      Object.keys(tokens.light).sort(),
    );
  });

  it('reste aligné avec les variables CSS du thème sombre', () => {
    expect(cssVariables(darkBlock).map(toCamelCase).sort()).toEqual(
      Object.keys(tokens.dark).sort(),
    );
  });

  it("n'utilise que des couleurs hexadécimales", () => {
    const values = [...Object.values(tokens.light), ...Object.values(tokens.dark)];
    for (const value of values) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
