const fs = require('node:fs');
const path = require('node:path');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');

const [, , sourcePath, destinationPath] = process.argv;
if (!sourcePath || !destinationPath) {
  throw new Error('Usage: node tools/extract-windows-icon.cjs <source.exe> <output.ico>');
}

const executable = NtExecutable.from(fs.readFileSync(sourcePath), {
  ignoreCert: true,
});
const resources = NtExecutableResource.from(executable);
const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
if (!groups.length) {
  throw new Error(`No icon group found in ${sourcePath}`);
}

const group = groups.reduce((largest, candidate) =>
  candidate.icons.length > largest.icons.length ? candidate : largest,
);
const iconFile = new Data.IconFile();
iconFile.icons = group
  .getIconItemsFromEntries(resources.entries)
  .map((data) => ({ data }));

fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
fs.writeFileSync(destinationPath, Buffer.from(iconFile.generate()));
