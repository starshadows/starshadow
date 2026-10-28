---
title: 基于 Cloudflare for SaaS 与 CNAME 的网站优选加速（单域名 vs 双域名架构）
published: 2026-05-20
description: 优选ip
image: /assets/posts/cloudflare-single-domain-saas-cname/cover.webp
tags:
  - Cloudflare
  - SaaS
  - CNAME
  - 优选 IP
  - Caddy
  - 双域名
  - 网络优化
category: 网络折腾
draft: false
lang: ''
slug: cloudflare-single-domain-saas-cname
date: '2026-05-20'
---

将个人网站或在线服务托管在海外 VPS 时，开启 Cloudflare 的免费 CDN 代理往往是抵御攻击、隐藏源站ip的最省心方式。

然而，国内用户访问 Cloudflare 免费cdn节点体验很差，尤其是联通和移动。

为了改善这一现状，社区探索出了一种利用 **Cloudflare for SaaS（自定义主机名）配合 CNAME 优选 IP** 的加速方案：
> 让国内用户经由优选出的低延迟、低丢包 Cloudflare 优质边缘节点接入，再通过 Cloudflare 内部强大的全球专线骨干网高速回源到源站。

> [!TIP]
> 仅推荐电信优选，联通移动即使优选，丢包率也很高。

但在实际落地中，很多朋友常常会陷入 **Error 1000** 与 **HTTP 421 Misdirected Request** 的配置泥潭。本文将以 Caddy 为源站网关，深入剖析**单域名方案**与**双域名方案**的底层机制、踩坑根源与最佳实践。



## 1. 单域名方案：快速验证及其局限性

所谓的“单域名方案”，是指**所有的业务入口、优选中转以及源站回源均隶属于同一个根域名**（例如全部基于 `starshadow.cc`）。

![单域名 SaaS + CNAME 优选原理图](/assets/posts/cloudflare-single-domain-saas-cname/single-domain-flow.png)

### 基础环境与准备

- **源站环境**：Caddy 配置了业务域名 `bot1.starshadow.cc` 与基准域名 `bot.starshadow.cc`，后端代理至本地应用（如 AstrBot）：

![Caddy 中已经配置 bot 和 bot1 两个域名](/assets/posts/cloudflare-single-domain-saas-cname/step-01-caddy-config.png)

- **Cloudflare 设置**：开启 SSL/TLS `Full (strict)` 模式并强制 HTTPS 重定向。

### 配置步骤与踩坑排查

#### 步骤 1：添加 SaaS 回退源记录与 DNS 链

1. 在 DNS 中添加一条 A 记录 `saas.starshadow.cc` 指向服务器源站 IP（开启橙云）：

![saas.starshadow.cc 指向源站 IP](/assets/posts/cloudflare-single-domain-saas-cname/step-02-saas-origin-dns.png)

2. 前往 **SSL/TLS -> Custom Hostnames**，将 `saas.starshadow.cc` 登记为 **Fallback Origin（回退源）**：

![添加 SaaS 回退源](/assets/posts/cloudflare-single-domain-saas-cname/step-03-add-fallback-origin.png)

3. 编排 DNS 解析链：
   - `bot1.starshadow.cc` -> `CNAME` -> `cdn.starshadow.cc` (仅 DNS)
   - `cdn.starshadow.cc` -> `CNAME` -> `youxuan.cf.090227.xyz` (仅 DNS，由优选服务提供)
   - `bot.starshadow.cc` -> `A` -> 源站 IP (保持橙云，用于直接对比和回源)

![添加 CNAME 记录](/assets/posts/cloudflare-single-domain-saas-cname/step-04-cname-records.png)

![添加源站记录](/assets/posts/cloudflare-single-domain-saas-cname/step-05-origin-record.png)

#### 陷阱一：默认回退源触发 Cloudflare Error 1000

在添加 Custom Hostname `bot1.starshadow.cc` 时，如果直接选择“默认回退源”（Default Fallback Origin）：

![添加自定义主机名时选择默认回退源](/assets/posts/cloudflare-single-domain-saas-cname/step-06-custom-hostname-default-origin.png)

虽然控制台能保存成功，但在浏览器访问 `bot1.starshadow.cc` 时，会直接弹出 Cloudflare 经典的 **Error 1000: DNS points to prohibited IP** 拦截页：

![默认回退源触发 1000 错误](/assets/posts/cloudflare-single-domain-saas-cname/step-07-error-1000.png)

**原因剖析**：在同一个 Zone 内，当请求通过 CNAME 引导进入边缘节点后，Cloudflare 检测到回退源记录解析出的仍是自身网络内的受保护资产，引发了防止边缘递归死循环的自保护规则。

#### 陷阱二：改用自定义源服务器引发 HTTP 421 Misdirected Request

为了规避 Error 1000，通常的做法是在 Custom Hostname 高级设置中指定 **Custom Origin Server（自定义源服务器）**，填入开启了橙云的基准域名 `bot.starshadow.cc`：

![改用自定义源服务器](/assets/posts/cloudflare-single-domain-saas-cname/step-08-custom-origin-server.png)

然而，保存并等待证书颁发后访问，浏览器却弹出了另一个冷门错误：**HTTP 421 Misdirected Request**。

![自定义源服务器触发 421 错误](/assets/posts/cloudflare-single-domain-saas-cname/step-09-error-421.png)

### 为什么会出现 421？协议级根因探秘

HTTP 421 错误属于 HTTP 协议规范中的“请求定向错误”。其根本原因在于 **TLS 握手阶段的 SNI 与 HTTP 应用层的 Host 标头发生了割裂**：

1. **SNI (Server Name Indication)**：由边缘节点发往源站 Caddy。因为配置了自定义源服务器为 `bot.starshadow.cc`，Cloudflare 在发起 TLS 握手时，`ClientHello` 中的 SNI 被填成了 `bot.starshadow.cc`；
2. **HTTP Host 头部**：访客原本请求的是 `bot1.starshadow.cc`，因此 HTTP 请求头中的 `Host: bot1.starshadow.cc` 原样传递给源站。

在 Caddy 的设计哲学中，为了防止基于 TLS 连接复用的“虚拟主机混淆攻击（Virtual Host Confusion）”，Caddy 默认开启了严格的 `strict_sni_host` 校验：**只要发现连接握手的 SNI 与应用层报文的 Host 不一致，立即以 421 拒绝处理！**

### 单域名的妥协方案：放宽 Caddy 安全校验

在单域名架构下要强行跑通，只能在 Caddyfile 全局块中显式关闭严格校验：

```text
{
  servers {
    strict_sni_host insecure_off
  }
}
```

配置重载后，访问 `bot1.starshadow.cc` 恢复正常并展示出应用界面：

![重启 Caddy 后网站正常访问](/assets/posts/cloudflare-single-domain-saas-cname/step-11-astrbot-login.png)

> [!WARNING]
> 配置项中的 `insecure_off` 顾名思义：它关闭了 TLS 握手名称与 HTTP Host 的一致性约束。对于个人测试环境尚可接受，但在多租户或高安全等级的生产环境中，这并非最佳工程实践。

---

## 2. 双域名方案：优雅解耦与安全对齐（推荐实践）

为了在不妥协安全性的前提下享受优选加速，更高级且标准的设计是**双域名架构**：将“用户访问的主域名”与“承接 SaaS 回退和优选引导的辅助域名”进行物理隔离。

- **主域名**（如 `starshadow.cc`）：面向用户，承载实际业务；
- **辅助域名**（如 `454849.xyz`）：充当纯粹的 SaaS 基础设施中转层。

![双域名 SaaS + CNAME 优选原理图](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-flow.png)

### 双域名链路编排矩阵

| 域名角色 | 域名配置示例 | 解析类型 | 指向目标 | 代理状态 | 作用 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **业务入口** | `bot1.starshadow.cc` | CNAME | `cdn.454849.xyz` | 仅 DNS (灰云) | 面向终端访客的业务地址 |
| **优选中转** | `cdn.454849.xyz` | CNAME | `youxuan.cf.090227.xyz` | 仅 DNS (灰云) | 桥接第三方优选服务入口 |
| **回源锚点** | `origin.454849.xyz` | A | 源站实际公网 IP | 开启代理 (橙云) | 注册为 SaaS 的默认回退源 |

### 实操配置步骤

1. **清理主域名旧配置**：在主域名控制台中删除之前的 SaaS Fallback 记录和自定义主机名，避免配置冲突。
2. **在主域名设置 CNAME**：将 `bot1.starshadow.cc` CNAME 指向辅助域名的中转记录 `cdn.454849.xyz`：

![主域名 CNAME 到辅助域名](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-main-cname.png)

3. **在辅助域名配置中转与回退源**：
   - `cdn.454849.xyz` CNAME 指向 `youxuan.cf.090227.xyz`：

![cdn.454849.xyz CNAME 到 youxuan.cf.090227.xyz](/assets/posts/cloudflare-single-domain-saas-cname/step-05b-cdn-to-youxuan.png)

   - `origin.454849.xyz` 开启橙云指向源站 IP：

![origin 辅助记录指向源站](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-origin-record.png)

   - 在辅助域名的 **Custom Hostnames** 界面将 `origin.454849.xyz` 登记为 **Fallback Origin**。

4. **添加跨域自定义主机名**：
   在辅助域名的 Custom Hostnames 中，添加主域名的业务地址 `bot1.starshadow.cc`，**回源方式直接选择默认回退源（Default Fallback）**，无需填写自定义源服务器：

![双域名方案下的回退源和自定义主机名](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-custom-hostname.png)

### 为什么双域名方案完美解决了 SNI/Host 冲突？

在双域名的默认回退模型下，Cloudflare 边缘节点在发起回源时：
- 会自动将 **SNI** 与 **Host 标头** 统一重写为 Custom Hostname 本身（即 `bot1.starshadow.cc`）；
- 两者完全一致，源站 Caddy 可以坦然启用 `strict_sni_host on` 严格校验，无需任何安全妥协！

![双域名方案下保持 Caddy 严格校验](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-strict-sni-host.png)

配置完毕并重启 Caddy 后，双域名方案下的优选访问同样畅通无阻：

![双域名方案访问正常](/assets/posts/cloudflare-single-domain-saas-cname/double-domain-access-ok.png)



