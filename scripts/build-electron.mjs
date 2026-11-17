import esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    sourcemap: false,
});

await esbuild.build({
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist-electron/preload.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    packages: 'external',
    sourcemap: false,
});

console.log('Built Electron main and preload bundles.');
