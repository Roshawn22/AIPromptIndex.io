import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repoUrl = new URL('../../../', import.meta.url);

function readRepoFile(relativePath) {
  return fs.readFileSync(new URL(relativePath, repoUrl), 'utf8');
}

test('deterministic SEO pulls do not depend on removed AI or Medium automation', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const dailyWorkflow = readRepoFile('.github/workflows/seo-data-pull.yml');
  const envExample = readRepoFile('.env.example');

  assert.equal(packageJson.dependencies['@anthropic-ai/sdk'], undefined);
  assert.equal(packageJson.dependencies.marked, undefined);
  assert.equal(packageJson.scripts['seo:ops:ai'], undefined);
  assert.equal(packageJson.scripts['syndicate:medium'], undefined);

  for (const scriptName of ['seo:pull:daily', 'seo:pull:all', 'seo:pull:hybrid']) {
    assert.ok(packageJson.scripts[scriptName]);
    assert.doesNotMatch(packageJson.scripts[scriptName], /anthropic|medium|syndicate/i);
  }

  assert.doesNotMatch(dailyWorkflow, /anthropic|medium|syndicat/i);
  assert.match(dailyWorkflow, /permissions:\n  contents: read\n  issues: write/);
  assert.doesNotMatch(envExample, /ANTHROPIC_API_KEY|ANTHROPIC_SEO_MODEL|MEDIUM_API_TOKEN/);

  assert.equal(fs.existsSync(new URL('.github/workflows/seo-ai-ops.yml', repoUrl)), false);
  assert.equal(fs.existsSync(new URL('scripts/seo/run-ai-ops.mjs', repoUrl)), false);
  assert.equal(fs.existsSync(new URL('scripts/seo/syndicate-medium.mjs', repoUrl)), false);

  for (const workflow of [
    '.github/workflows/seo-data-pull.yml',
    '.github/workflows/seo-weekly.yml',
    '.github/workflows/seo-monthly.yml',
  ]) {
    assert.equal(fs.existsSync(new URL(workflow, repoUrl)), true);
  }
});
