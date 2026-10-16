// 在 Astro 完成后统一处理 public 位图和元数据引用的源图。
// 原图始终保留在 public/ 和 src/；只修改 dist，并在 Pagefind 建索引之前更新引用。
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import sharp from "sharp";
import { siteConfig } from "../src/config/siteConfig";
import { compatibilityImages, rewriteImageUrls } from "./image-output-utils";
import { resolveSiteRoot } from "./site-root";

const root = path.resolve(resolveSiteRoot());
const origin = new URL(siteConfig.site_url);
const quality = siteConfig.imageOptimization?.quality ?? 85;
const supported = /\.(?:png|jpe?g|avif|gif)$/i;

function outputPath(relative: string): string {
	const resolved = path.resolve(root, relative);
	if (!resolved.startsWith(root + path.sep)) {
		throw new Error(`Image output is outside the build directory: ${relative}`);
	}
	return resolved;
}

async function main(): Promise<void> {
	const files = await glob("**/*", { cwd: root, nodir: true, posix: true });
	const textFiles = files.filter((file) =>
		/\.(?:html|css|js|mjs|json|xml|txt|webmanifest)$/i.test(file),
	);
	const documents = await Promise.all(
		textFiles.map(async (file) => ({
			file,
			text: await fs.readFile(outputPath(file), "utf8"),
			url: new URL(file, origin),
		})),
	);
	const retained = new Set<string>();
	for (const document of documents) {
		for (const image of compatibilityImages(document.text, document.url)) {
			retained.add(image);
		}
	}

	const images = new Map<string, string>();
	let sourceBytes = 0;
	let optimizedBytes = 0;
	for (const file of files.filter((file) => supported.test(file))) {
		// 模型贴图由模型运行时按 atlas/json 寻址，不能只改其中的文件名。
		if (file.startsWith("pio/")) continue;
		const source = await fs.readFile(outputPath(file));
		const converter = sharp(source, { animated: true });
		const metadata = await converter.metadata();
		const optimized = await converter
			.rotate()
			.webp({
				quality,
				// 教程截图的文字和透明图层无损保留，照片使用配置的压缩质量。
				lossless: metadata.format === "png",
			})
			.toBuffer();
		const hash = createHash("sha256")
			.update(optimized)
			.digest("hex")
			.slice(0, 12);
		const target = file.replace(supported, `.${hash}.webp`);
		await fs.writeFile(outputPath(target), optimized);
		images.set(
			`/${file}`,
			`/${target.split("/").map(encodeURIComponent).join("/")}`,
		);
		sourceBytes += source.length;
		optimizedBytes += optimized.length;
	}

	let rewritten = 0;
	for (const document of documents) {
		const next = rewriteImageUrls(document.text, images, document.url);
		if (next !== document.text) {
			await fs.writeFile(outputPath(document.file), next);
			rewritten++;
		}
	}
	// 只移除本轮已成功转换的构建文件；兼容图标仍随站点部署。
	for (const image of images.keys()) {
		if (!retained.has(image)) await fs.unlink(outputPath(image.slice(1)));
	}
	await fs.mkdir("cache", { recursive: true });
	await fs.writeFile(
		"cache/image-output.json",
		JSON.stringify(
			{
				images: Object.fromEntries(images),
				retained: [...retained],
				sourceBytes,
				optimizedBytes,
			},
			null,
			2,
		),
	);
	console.log(
		`[IMAGES] ${images.size} images → WebP; ${rewritten} documents updated; ${(sourceBytes / 1048576).toFixed(2)} → ${(optimizedBytes / 1048576).toFixed(2)} MiB.`,
	);
}

main().catch((error) => {
	console.error("[IMAGES] Image optimization failed:", error);
	process.exitCode = 1;
});
