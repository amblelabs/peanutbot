import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import config from "config.json";

const data = await fetch(config.wikisearch.index_url);
const iPath = path.resolve(__dirname, '../index.json');
fs.writeFileSync(iPath, await data.text());

const outputZip = path.resolve(__dirname, '../release.zip');
const output = fs.createWriteStream(outputZip);

const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('Archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

const srcDir = path.resolve(__dirname, '../');

// Add files and directories, excluding node_modules
archive.glob('**/*', {
  cwd: srcDir,
  ignore: ['.git', '.git/**', 'node_modules/**', 'node_modules', 'assets', 'assets/**', '*.zip', '*.sqlite', 'logs/**'], // Exclude node_modules directory and its contents
  dot: true // Include dot files
});

archive.finalize();