import type { GalleryConfig } from "@/types/galleryConfig";

// 添加自己的相册时，在 albums 中填写信息，并在 public/gallery 下放置对应目录。
export const galleryConfig: GalleryConfig = {
	albums: [],
	// 瀑布流最小列宽(px)
	columnWidth: 240,
};
