import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Asset = {
  key: string;
  output: string;
  permalink: string;
  alt: string;
  url?: string;
};

async function main() {
  const root = process.cwd();
  const manifestPath = path.join(root, "scripts", "instagram-assets.json");
  const destination = path.join(root, "public", "images", "sonique");
  const assets = JSON.parse(await readFile(manifestPath, "utf8")) as Asset[];

  await mkdir(destination, { recursive: true });

  for (const asset of assets) {
    if (!asset.url) {
      console.log(`Skipped ${asset.key}; the saved file is already in public/images/sonique.`);
      continue;
    }

    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`Could not download ${asset.key}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`${asset.key} did not return an image.`);
    }

    await writeFile(
      path.join(destination, asset.output),
      Buffer.from(await response.arrayBuffer()),
    );
    console.log(`Imported ${asset.key} -> ${asset.output}`);
  }

  const provenance = assets.map(({ key, output, permalink, alt }) => ({
    key,
    path: `/images/sonique/${output}`,
    permalink,
    alt,
    importedAt: new Date().toISOString(),
  }));

  await writeFile(
    path.join(destination, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
