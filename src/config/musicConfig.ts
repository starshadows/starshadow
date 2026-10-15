import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 是否显启用歌词
	showLyrics: false,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/song.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: [
			{
				name: "Da Capo",
				artist: "HOYO-MiX",
				url: "/media/music/Da%20Capo%20-%20HOYO-MiX.mp3",
				cover: "/media/covers/embedded-86470f0b79ed928693d0.jpg",
			},
			{
				name: "I Wish My Mind Would Shut Up",
				artist: "Ivoris",
				url: "/media/music/I%20Wish%20My%20Mind%20Would%20Shut%20Up%20-%20Ivoris.mp3",
				cover: "/media/covers/embedded-8ca564761825c21b4858.jpg",
			},
			{
				name: "No Ceiling",
				artist: "HOYO-MiX",
				url: "/media/music/No-Ceiling---HOYO-MiX-39747f04077f.mp3",
				cover: "/media/covers/embedded-23bcb82a77a59d253f77.jpg",
			},
			{
				name: "One Last Kiss",
				artist: "宇多田ヒカル",
				url: "/media/music/One%20Last%20Kiss%20-%20%E5%AE%87%E5%A4%9A%E7%94%B0%E3%83%92%E3%82%AB%E3%83%AB.mp3",
				cover: "/media/covers/embedded-bab5dcad6f593a2cda72.jpg",
			},
			{
				name: "Sincerely",
				artist: "TRUE",
				url: "/media/music/Sincerely%20-%20TRUE.mp3",
				cover: "/media/covers/embedded-eb2bc609daa80a092400.jpg",
			},
			{
				name: "Touch",
				artist: "3LAU",
				url: "/media/music/Touch%20-%203LAU.mp3",
				cover: "/media/covers/embedded-c8691034c8476242b61c.jpg",
			},
			{
				name: "Towards the Light",
				artist: "Jacoo",
				url: "/media/music/Towards%20the%20Light%20-%20Jacoo.mp3",
				cover: "/media/covers/embedded-19f5965befddf4bea470.jpg",
			},
			{
				name: "TruE",
				artist: "黄龄&HOYO-MiX",
				url: "/media/music/TruE%20-%20%E9%BB%84%E9%BE%84-HOYO-MiX.mp3",
				cover: "/media/covers/embedded-06df07add7877a40468f.jpg",
			},
			{
				name: "Wild",
				artist: "Monogem",
				url: "/media/music/Wild%20-%20Monogem.mp3",
				cover: "/media/covers/embedded-d2c717eb31dc9ace2796.jpg",
			},
			{
				name: "使一颗心免于哀伤",
				artist: "知更鸟&HOYO-MiX&Chevy",
				url: "/media/music/%E4%BD%BF%E4%B8%80%E9%A2%97%E5%BF%83%E5%85%8D%E4%BA%8E%E5%93%80%E4%BC%A4%20-%20%E7%9F%A5%E6%9B%B4%E9%B8%9F-HOYO-MiX-Chevy.mp3",
				cover: "/media/covers/embedded-879b3c48f4bbce1d02a2.jpg",
			},
			{
				name: "唯一",
				artist: "G.E.M. 邓紫棋",
				url: "/media/music/%E5%94%AF%E4%B8%80%20-%20G.E.M.%20%E9%82%93%E7%B4%AB%E6%A3%8B.mp3",
				cover: "/media/covers/embedded-a209ac60de3b608c793a.jpg",
			},
			{
				name: "妖精小姐的魔法邀约 (Miss Elf's Magical Invitation)",
				artist: "宴宁&HOYO-MiX",
				url: "/media/music/%E5%A6%96%E7%B2%BE%E5%B0%8F%E5%A7%90%E7%9A%84%E9%AD%94%E6%B3%95%E9%82%80%E7%BA%A6%20%28Miss%20Elf%27s%20Magical%20Invitation%29%20-%20%E5%AE%B4%E5%AE%81-HOYO-MiX.mp3",
				cover: "/media/covers/embedded-bed6b23dd899ad6a1a39.jpg",
			},
			{
				name: "昔涟",
				artist: "张韶涵&HOYO-MiX",
				url: "/media/music/%E6%98%94%E6%B6%9F%20-%20%E5%BC%A0%E9%9F%B6%E6%B6%B5-HOYO-MiX.mp3",
				cover: "/media/covers/embedded-6640088be6e52e14b503.jpg",
			},
			{
				name: "星与你消失之日",
				artist: "泠鸢yousa",
				url: "/media/music/%E6%98%9F%E4%B8%8E%E4%BD%A0%E6%B6%88%E5%A4%B1%E4%B9%8B%E6%97%A5%20-%20%E6%B3%A0%E9%B8%A2yousa.mp3",
				cover: "/media/covers/embedded-7c0ad720a10d1bbfde7b.jpg",
			},
			{
				name: "星降る海",
				artist: "日本群星&Aqu3ra&早見沙織",
				url: "/media/music/%E6%98%9F%E9%99%8D%E3%82%8B%E6%B5%B7%20-%20%E6%97%A5%E6%9C%AC%E7%BE%A4%E6%98%9F-Aqu3ra-%E6%97%A9%E8%A6%8B%E6%B2%99%E7%B9%94.mp3",
				cover: "/media/covers/embedded-5ece0e24251861a8d5be.jpg",
			},
			{
				name: "願い〜あの頃のキミへ〜",
				artist: "當山みれい",
				url: "/media/music/%E9%A1%98%E3%81%84%E3%80%9C%E3%81%82%E3%81%AE%E9%A0%83%E3%81%AE%E3%82%AD%E3%83%9F%E3%81%B8%E3%80%9C%20-%20%E7%95%B6%E5%B1%B1%E3%81%BF%E3%82%8C%E3%81%84.mp3",
				cover: "/media/covers/embedded-c3de1367c75dc70119ab.jpg",
			},
		],
	},
};
