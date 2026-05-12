import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('package dependencies', () => {
  it('pins @isonia/types to v0.7.0-alpha.2', () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies?.['@isonia/types']).toBe(
      'github:isoniaos/types#v0.7.0-alpha.2',
    );
  });
});
