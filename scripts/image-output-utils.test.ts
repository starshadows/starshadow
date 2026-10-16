import assert from "node:assert/strict";
import test from "node:test";
import { compatibilityImages, rewriteImageUrls } from "./image-output-utils";

const origin = new URL("https://blog.starshadow.cc/posts/example/index.html");
const images = new Map([
	["/assets/截图.png", "/assets/截图.hash.webp"],
	["/favicon/avatar.png", "/favicon/avatar.hash.webp"],
	["/media/cover.jpg", "/media/cover.hash.webp"],
	["/assets/screen shot.png", "/assets/screen%20shot.hash.webp"],
]);

test("rewrites local, encoded, absolute and CSS image URLs without changing queries", () => {
	const input =
		'<img src="/assets/%E6%88%AA%E5%9B%BE.png?download=1#view"><img src="https://blog.starshadow.cc/media/cover.jpg"><style>.a{background:url(/media/cover.jpg)}</style>';
	const output = rewriteImageUrls(input, images, origin);
	assert.ok(
		output.includes(`${encodeURI("/assets/截图.hash.webp")}?download=1#view`),
	);
	assert.equal(output.match(/\/media\/cover\.hash\.webp/g)?.length, 2);
	assert.ok(
		output.includes('src="https://blog.starshadow.cc/media/cover.hash.webp"'),
	);
});

test("handles quoted filenames containing spaces and keeps CSS srcset variants", () => {
	const input =
		'<img src="/assets/screen shot.png?v=2"><source srcset="/media/cover.jpg 640w, /media/cover.jpg 1280w">';
	const output = rewriteImageUrls(input, images, origin);
	assert.ok(output.includes("/assets/screen%20shot.hash.webp?v=2"));
	assert.equal(output.match(/cover\.hash\.webp/g)?.length, 2);
});

test("leaves external URLs, SVG, existing WebP and unrelated text intact", () => {
	const input =
		'<img src="https://elsewhere.example/media/cover.jpg"><img src="//elsewhere.example/media/cover.jpg"><img src="/diagram.svg"><img src="/image.webp">';
	assert.equal(rewriteImageUrls(input, images, origin), input);
});

test("keeps compatible metadata formats while changing the visible favicon", () => {
	const apple =
		'<link rel="apple-touch-icon" href="/favicon/avatar.png" type="image/png">';
	const share =
		'<meta property="og:image" content="https://blog.starshadow.cc/media/cover.jpg">';
	const input = `${apple}${share}<link rel="icon" href="/favicon/avatar.png">`;
	const output = rewriteImageUrls(input, images, origin);
	assert.ok(output.includes(apple));
	assert.ok(output.includes(share));
	assert.ok(output.includes('rel="icon" href="/favicon/avatar.hash.webp"'));
	assert.deepEqual(
		[...compatibilityImages(input, origin)],
		["/favicon/avatar.png", "/media/cover.jpg"],
	);
});

test("updates inline playlists, JSON and escaped RSS image markup", () => {
	const input =
		'{"pic":"/media/cover.jpg"}<script>const src="/media/cover.jpg"</script>&lt;img src=&quot;/media/cover.jpg&quot;&gt;';
	assert.equal(
		rewriteImageUrls(input, images, origin).match(/cover\.hash\.webp/g)?.length,
		3,
	);
});
