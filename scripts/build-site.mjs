import { readFile, readdir, mkdir, copyFile, rm, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const files = new Set();
const pending = ["index.html"];
const localPath = (from, url) => {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return null;
  const path = url.split(/[?#]/)[0];
  const target = resolve(
    path.startsWith("/") ? root : dirname(resolve(root, from)),
    path.replace(/^\//, ""),
  );
  const name = relative(root, target);
  if (name.startsWith(`..${sep}`) || name === "..")
    throw Error(`Asset outside project: ${url}`);
  return name;
};
async function includeTree(directory) {
  for (const entry of await readdir(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error(`Unexpected symlink: ${name}`);
    if (entry.isDirectory()) await includeTree(name);
    else if (/\.(?:json|png|webp|md)$/.test(name)) files.add(name);
  }
}
// Follow actual entry-point dependencies; the comparison route and old model
// experiments are not part of the deployed game.
while (pending.length) {
  const name = pending.pop();
  if (files.has(name)) continue;
  files.add(name);
  const extension = extname(name);
  if (![".html", ".js", ".css"].includes(extension)) continue;
  const source = await readFile(resolve(root, name), "utf8");
  const urls =
    extension === ".html"
      ? [...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1])
      : extension === ".js"
        ? [
            ...source.matchAll(
              /\bimport\s+(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/g,
            ),
          ].map((m) => m[1])
        : [...source.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)].map(
            (m) => m[1],
          );
  for (const url of urls) {
    const dependency = localPath(name, url);
    if (dependency && dependency !== ".") pending.push(dependency);
  }
}
for (const name of ["data/paleomap", "data/maps/raster-v2"])
  await includeTree(name);
for (const name of [
  "data/modern-countries.json",
  "data/country-kinds.json",
  "data/UPSTREAM-ATTRIBUTION.md",
  "vendor/D3-LICENSE",
  "LICENSE",
  "_headers",
])
  files.add(name);
for (const name of await readdir(root))
  if (name.endsWith(".md")) files.add(name);
await rm(output, { recursive: true, force: true });
let bytes = 0;
for (const name of [...files].sort()) {
  const path = resolve(root, name),
    info = await stat(path);
  if (info.size > 25 * 1024 * 1024)
    throw Error(`Cloudflare file-size limit exceeded: ${name}`);
  const target = resolve(output, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(path, target);
  bytes += info.size;
}
if (files.size > 20000)
  throw Error("Cloudflare free-plan asset limit exceeded");
console.log(
  `Built ${files.size} public files (${(bytes / 1048576).toFixed(1)} MiB) in dist/`,
);
