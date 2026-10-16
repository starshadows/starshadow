# 星影的博客

基于 Astro、Svelte 和 [Firefly](https://github.com/CuteLeaf/Firefly) 主题的个人博客。仓库保存站点源码、文章与本地素材。

## 本地运行

使用 Node.js 22.23.0 或更高版本，以及项目指定的 pnpm 11.22.0。

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4321
```

预览地址：<http://127.0.0.1:4321/>。

## 检查与构建

```sh
pnpm check
pnpm type-check
pnpm build
pnpm preview --host 127.0.0.1 --port 4321
```

构建输出位于 `dist/`，不纳入 Git。部署前在 `src/config/siteConfig.ts` 的 `site_url` 中设置实际站点域名，用于 canonical、RSS 和站点地图。

## 内容与素材

| 内容 | 位置 |
| --- | --- |
| 文章 | `src/content/posts/` |
| 文章配图 | `public/assets/posts/` |
| 个人信息 | `src/config/profileConfig.ts` |
| 关于页 | `src/content/spec/about.md` |
| 头像 | `src/assets/images/touxiang.png` |
| 浏览器标签页图标 | `public/favicon/starshadow-avatar.png` |
| 导航徽章 | `src/assets/images/logo/elysia-emblem.png` |
| 横屏背景 | `src/assets/images/DesktopWallpaper/` |
| 竖屏背景 | `src/assets/images/MobileWallpaper/` |
| 背景、轮播和首页打字内容 | `src/config/backgroundWallpaper.ts` |
| 主题色与站点设置 | `src/config/siteConfig.ts` |
| 色相调节面板 | `src/config/displaySettingsConfig.ts` |
| 本地歌单 | `src/config/musicConfig.ts` |
| 音乐和封面 | `public/media/music/`、`public/media/covers/` |
| 摇摇乐组件 | `src/components/features/SakanaWidget.astro` |
| 摇摇乐角色 | `public/sakana/starshadow.webp` |

文章 frontmatter 的 `published` 使用未加引号的日期，例如 `published: 2026-05-22`；修改文章时可填写 `updated`。分类、标签、文章总数和总字数从文章自动统计。

音乐使用现有播放器和本地 MP3。新增歌曲时在歌单中设置 `name`、`artist`、`url` 和 `cover`；素材路径从 `public/` 对应的站点根路径开始。文件名建议避免 `&` 等特殊符号。

`pnpm build` 会自动把 `public/` 中的 PNG、JPEG、AVIF、GIF 及页面引用的源位图生成 WebP，并同步更新文章配图、封面、歌单、JSON 与订阅中的本站图片链接。原始素材不变，部署产物使用带内容指纹的 WebP；PNG 教程截图采用无损转换，保留文字和透明度。SVG、模型贴图、Apple 触屏图标和社交分享元数据的兼容图片保留原格式。第三方图片链接不下载或改写。

`pnpm dev` 仍可直接编辑和预览源图；检查最终 WebP 效果时使用 `pnpm build` 后的 `pnpm preview`。

当前背景按桌面与手机分别轮播，间隔为 20 秒。首页副标题使用原有打字组件按配置顺序循环。摇摇乐支持拖动、自动跳动与临时关闭，按钮颜色跟随主题。

## 迁移记录

正式文章 4 篇、本地音乐 16 首及个人信息来自旧博客备份，测试文章已排除。保留当前主题和布局，未迁入旧博客后台、评论、友链数据或其他插件。详细文件位置和验证结果见 [迁移记录](docs/migration-2026-10-15.md)。

## 主题与组件来源

- [Firefly](https://github.com/CuteLeaf/Firefly)，基于 [Fuwari](https://github.com/saicaca/fuwari)。原主题说明保留在 [README.theme.md](README.theme.md)，代码许可见 [LICENSE](LICENSE)。
- 摇摇乐使用 [Sakana Widget](https://github.com/dsrkafuu/sakana-widget)。本地脚本和样式位于 `public/vendor/sakana/`，许可见 [组件 LICENSE](public/vendor/sakana/LICENSE)。

主题代码的许可不代表文章、音乐或图片素材的授权。
