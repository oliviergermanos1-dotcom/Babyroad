// Bundle src/ → www/ (webDir Capacitor)
// Les imports bare (@capacitor/core, @supabase/supabase-js) exigent un bundler.
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';

if (!existsSync('src/config.js')) {
  console.error('⚠ src/config.js manquant — copier src/config.example.js et remplir les clés.');
  process.exit(1);
}

mkdirSync('www', { recursive: true });
copyFileSync('src/index.html', 'www/index.html');

await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'esm',
  outfile: 'www/app.js',
  minify: true,
  target: 'es2020',
});

console.log('✓ Build www/ OK');
