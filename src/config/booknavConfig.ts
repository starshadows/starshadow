import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "ai-overseas",
		name: "国外 AI",
		icon: "material-symbols:smart-toy",
		items: [
			{
				title: "ChatGPT",
				url: "https://chatgpt.com/",
				desc: "OpenAI 聊天助手",
				icon: "/assets/booknav/external/chatgpt.png",
			},
			{
				title: "Gemini",
				url: "https://gemini.google.com/",
				desc: "Google AI 助手",
				icon: "/assets/booknav/external/gemini.png",
			},
		],
	},
	{
		id: "ai-china",
		name: "国内 AI",
		icon: "material-symbols:smart-toy",
		items: [
			{
				title: "豆包",
				url: "https://www.doubao.com/",
				desc: "字节 AI 助手",
				icon: "/assets/booknav/external/doubao.png",
			},
			{
				title: "DeepSeek",
				url: "https://chat.deepseek.com/",
				desc: "深度求索大模型",
				icon: "/assets/booknav/external/deepseek.png",
			},
			{
				title: "Kimi",
				url: "https://www.kimi.com/",
				desc: "长文本 AI 助手",
				icon: "/assets/booknav/external/kimi.png",
			},
			{
				title: "MiniMax",
				url: "https://www.minimax.io/",
				desc: "多模态 AI 平台",
				icon: "/assets/booknav/external/minimax.png",
			},
		],
	},
	{
		id: "webmaster",
		name: "云厂商 / 站长工具",
		icon: "material-symbols:cloud",
		items: [
			{
				title: "Cloudflare",
				url: "https://dash.cloudflare.com/",
				desc: "DNS / CDN / Workers",
				icon: "/assets/booknav/external/cloudflare.png",
			},
			{
				title: "Vercel",
				url: "https://vercel.com/",
				desc: "前端部署平台",
				icon: "/assets/booknav/external/vercel.png",
			},
			{
				title: "ITDOG",
				url: "https://www.itdog.cn/",
				desc: "网络测试工具",
				icon: "/assets/booknav/external/itdog.png",
			},
			{
				title: "EdgeOne（国内版）",
				url: "https://console.cloud.tencent.com/edgeone",
				desc: "腾讯云边缘安全加速平台",
				icon: "/assets/booknav/external/edgeone.png",
			},
			{
				title: "Speedtest",
				url: "https://www.speedtest.net/",
				desc: "测速网站",
				icon: "/assets/booknav/external/speedtest.png",
			},
			{
				title: "IPING",
				url: "https://www.iping.cc/",
				desc: "IP 检测工具",
				icon: "/assets/booknav/external/iping.png",
			},
			{
				title: "IPLeak",
				url: "https://ipleak.net/",
				desc: "DNS 泄露检测",
				icon: "/assets/booknav/external/ipleak.png",
			},
			{
				title: "Scamalytics",
				url: "https://scamalytics.com/",
				desc: "IP 风险检测",
				icon: "/assets/booknav/external/scamalytics.png",
			},
			{
				title: "GitHub",
				url: "https://github.com/",
				desc: "代码托管平台",
				icon: "/assets/booknav/external/github.png",
			},
		],
	},
	{
		id: "servers",
		name: "云服务器",
		icon: "material-symbols:dns",
		items: [
			{
				title: "NovixLink",
				url: "https://novixlink.com/",
				desc: "美国原生住宅 IP VPS",
				icon: "/assets/booknav/external/novixlink.png",
			},
			{
				title: "VMISS",
				url: "https://www.vmiss.com/",
				desc: "亚太及欧美优化线路 VPS",
				icon: "/assets/booknav/external/vmiss.png",
			},
			{
				title: "Panstar.ai",
				url: "https://panstar.ai/",
				desc: "优化线路 VPS 与 AI 网关",
				icon: "/assets/booknav/external/panstar.png",
			},
			{
				title: "ZgoVPS",
				url: "https://zgovps.com/",
				desc: "高性能优化线路 VPS",
				icon: "/assets/booknav/external/zgovps.png",
			},
			{
				title: "AWS",
				url: "https://aws.amazon.com/",
				desc: "Amazon 云服务",
				icon: "/assets/booknav/external/aws.png",
			},
			{
				title: "阿里云",
				url: "https://www.aliyun.com/",
				desc: "国内云服务商",
				icon: "/assets/booknav/external/aliyun.png",
			},
			{
				title: "腾讯云",
				url: "https://cloud.tencent.com/",
				desc: "国内云服务商",
				icon: "/assets/booknav/external/tencent-cloud.png",
			},
		],
	},
	{
		id: "community",
		name: "社区",
		icon: "material-symbols:groups",
		items: [
			{
				title: "pixiv",
				url: "https://www.pixiv.net/",
				desc: "日本二次元网站",
				icon: "/assets/booknav/external/pixiv.png",
			},
		],
	},
];
