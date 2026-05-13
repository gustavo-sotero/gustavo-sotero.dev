import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const TEST_FILE_SUFFIXES = ['.test.ts', '.spec.ts'];
const SKIPPED_DIRECTORY_NAMES = new Set(['__mocks__', '__tests__']);

function isRuntimeSourceFile(filePath: string): boolean {
  if (!filePath.endsWith('.ts')) return false;
  if (filePath.endsWith('.d.ts')) return false;
  return !TEST_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

function collectRuntimeEntryPoints(sourceDir: string): string[] {
  const entryPoints: string[] = [];

  function walk(currentDir: string) {
    for (const dirent of readdirSync(currentDir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        if (SKIPPED_DIRECTORY_NAMES.has(dirent.name)) continue;
        walk(join(currentDir, dirent.name));
        continue;
      }

      const absolutePath = join(currentDir, dirent.name);
      if (!isRuntimeSourceFile(absolutePath)) continue;
      entryPoints.push(absolutePath);
    }
  }

  walk(sourceDir);

  return entryPoints.sort();
}

interface RuntimePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function collectExternalPackagePatterns(serviceDir: string): string[] {
  const packageJsonPath = join(serviceDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as RuntimePackageJson;
  const packageNames = new Set<string>([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);

  packageNames.delete('@portfolio/shared');

  return [...packageNames].sort().flatMap((packageName) => [packageName, `${packageName}/*`]);
}

async function main() {
  const servicePathArg = process.argv[2];

  if (!servicePathArg) {
    throw new Error(
      'Missing service path. Usage: bun scripts/build-service-runtime.ts apps/<service>'
    );
  }

  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const serviceDir = resolve(repoRoot, servicePathArg);
  const sourceDir = join(serviceDir, 'src');
  const outputDir = join(serviceDir, 'dist');
  const entryPoints = collectRuntimeEntryPoints(sourceDir);
  const external = collectExternalPackagePatterns(serviceDir);

  if (entryPoints.length === 0) {
    throw new Error(`No runtime TypeScript files found in ${servicePathArg}/src`);
  }

  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });

  await build({
    bundle: true,
    chunkNames: '_chunks/[name]-[hash]',
    entryPoints,
    entryNames: '[dir]/[name]',
    external,
    format: 'esm',
    logLevel: 'silent',
    outbase: sourceDir,
    outdir: outputDir,
    platform: 'node',
    splitting: true,
    sourcemap: 'linked',
    target: 'es2022',
  });

  console.log(
    `[build-service-runtime] Built ${entryPoints.length} runtime entrypoints for ${basename(serviceDir)} to ${servicePathArg}/dist`
  );
}

await main();
