const IMAGE_URL =
	/(?:https?:\/\/|\/\/|\.{1,2}\/|\/)[^\s"'<>`\\()]*?\.(?:png|jpe?g|avif|gif)(?=$|[\s"'<>`\\()?#&,;])/gi;
const COMPATIBILITY_TAG =
	/<(?:link|meta)\b[^>]*(?:apple-touch-icon|og:image|twitter:image)[^>]*>/gi;
const QUOTED_IMAGE_URL =
	/(["'])(?:https?:\/\/|\/\/|\.{1,2}\/|\/)[^"'<>`\\?#,]*?\.(?:png|jpe?g|avif|gif)(?:[?#][^"'<>`\\]*)?\1/gi;

/** 仅解析本站 URL；不改写第三方图片。 */
export function localImagePath(value: string, documentUrl: URL): string | null {
	try {
		const parsed = new URL(value, documentUrl);
		return parsed.origin === documentUrl.origin
			? decodeURIComponent(parsed.pathname)
			: null;
	} catch {
		return null;
	}
}

/** 保留 Apple 触屏图标和分享元数据所需的 PNG/JPEG。 */
export function compatibilityImages(
	text: string,
	documentUrl: URL,
): Set<string> {
	const paths = new Set<string>();
	for (const tag of text.match(COMPATIBILITY_TAG) ?? []) {
		const value = tag.match(/\b(?:href|content)\s*=\s*(["'])(.*?)\1/i)?.[2];
		const pathname = value ? localImagePath(value, documentUrl) : null;
		if (pathname && /\.(?:png|jpe?g|avif|gif)$/i.test(pathname))
			paths.add(pathname);
	}
	return paths;
}

/** 覆盖 HTML、内联歌单、CSS、JSON 和 RSS；查询参数及锚点保持原样。 */
export function rewriteImageUrls(
	text: string,
	images: ReadonlyMap<string, string>,
	documentUrl: URL,
): string {
	const references = new RegExp(
		`${COMPATIBILITY_TAG.source}|${QUOTED_IMAGE_URL.source}|${IMAGE_URL.source}`,
		"gi",
	);
	return text.replace(references, (value) => {
		if (value.startsWith("<")) return value;
		const quote = /^["']/.test(value) ? value[0] : "";
		const source = quote ? value.slice(1, -1) : value;
		const pathname = localImagePath(source, documentUrl);
		const target = pathname && images.get(pathname);
		if (!target) return value;
		const original = new URL(source, documentUrl);
		const optimized = new URL(target, documentUrl);
		optimized.search = original.search;
		optimized.hash = original.hash;
		const rewritten = source.startsWith("//")
			? optimized.href.replace(/^https?:/, "")
			: /^https?:/.test(source)
				? optimized.href
				: optimized.pathname + optimized.search + optimized.hash;
		return quote + rewritten + quote;
	});
}
