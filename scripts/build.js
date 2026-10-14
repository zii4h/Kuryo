import { mkdir, copyFile } from 'node:fs/promises';
const files = ['index.html','styles.css','src/app.js','src/discovery.js'];
for (const file of files) {
  const output = new URL(`../dist/${file}`,import.meta.url);
  await mkdir(new URL('.',output),{recursive:true});
  await copyFile(new URL(`../${file}`,import.meta.url),output);
}
console.log('Live topic discovery ready in dist/. Upload its contents to a static host.');
