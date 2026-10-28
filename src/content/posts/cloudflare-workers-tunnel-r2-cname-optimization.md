---
title: Cloudflare Workers、Tunnel 与 R2 优选
published: 2026-05-22
description: 优选ip。
image: /assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/cover.webp
tags:
  - Cloudflare
  - Workers
  - Tunnel
  - R2
  - CNAME
  - 优选 IP
  - Serverless
category: 网络折腾
draft: false
lang: ''
slug: cloudflare-workers-tunnel-r2-cname-optimization
date: '2026-05-22'
---

本文将分别针对 Tunnel、Workers 和 R2 这三类云原生资产，落地 CNAME 优选接入方案。
> [!TIP]
> 仅推荐电信优选，移动和联通的cloudflare几乎不可用。

## 1. 场景一：Cloudflare Tunnel

在内网穿透场景中，本地部署了私有文件管理器（如 File Browser），并通过 Cloudflare Tunnel 实现了无公网 IP 穿透。默认情况下，访客只能通过 Cloudflare 自动生成的 CNAME 接入，在弱网环境下下载速度极度受限。

### 核心设计思想：双 Public Hostname 路由解耦

1. **`file.454849.xyz`（回源锚点）**：在 Tunnel 中绑定，保留官方生成的原生解析记录，作为底层数据通路的内部锚点；
2. **`file1.454849.xyz`（优选业务域名）**：在 Tunnel 中同样绑定，但**剥离其原生 DNS 解析**，将其改造成指向优选 CNAME 的入口。

### 实战配置流程

#### 1. 在 Zero Trust 中配置两条公共主机名路由
在 Zero Trust 控制台 -> Networks -> Tunnels -> 对应 Tunnel 的 Public Hostnames 中，分别为 `file` 和 `file1` 创建两条指向同一个本地内网服务（如 `http://filebrowser:80`）的路由规则：

![Tunnel 里给同一个服务创建 file 和 file1 两条路由](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-01-tunnel-routes.png)

#### 2. 重整 DNS 解析拓扑
前往 Cloudflare DNS 控制台：
- 观察由 Tunnel 自动同步创建的两条解析：保留回源专用的 `file.454849.xyz`；

![file 域名保留为 Tunnel 默认解析](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-02-tunnel-original-dns.png)

- **删除原有的 `file1` 自动解析**，重新将其添加为 `CNAME`，指向中转记录 `cdn.454849.xyz`（仅 DNS，灰云）：

![file1 CNAME 到 cdn.454849.xyz](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-03-tunnel-file1-cname.png)

- 将 `cdn.454849.xyz` CNAME 指向第三方优选入口（如 `youxuan.cf.090227.xyz`）：

![cdn CNAME 到优选入口](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-04-tunnel-cdn-cname.png)

#### 3. 编排 SaaS 自定义主机名
为了让请求顺利通过边缘转发回 Tunnel：
1. 准备一条回退源 DNS 记录（如 `origin.454849.xyz`，开启橙云）：

![origin 作为 SaaS 回退源记录](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-05-tunnel-origin-record.png)

2. 在 **SSL/TLS -> Custom Hostnames** 中将 `origin.454849.xyz` 设为 **Fallback Origin**：

![添加 SaaS 回退源](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-06-tunnel-fallback-origin.png)

3. 点击 **Add Custom Hostname**：
   - **Custom Hostname**：填写用户访问的业务域名 `file1.454849.xyz`；
   - **Custom Origin Server（自定义源服务器）**：填写真正的 Tunnel 路由域名 `file.454849.xyz`。

![自定义主机名使用 file1，自定义源服务器使用 file](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-07-tunnel-custom-hostname.png)

配置生效后，访问 `file1.454849.xyz`，流量在优选节点完成接入后，瞬间经由专线无缝穿透进内网 File Browser：

![file1 访问成功](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-08-tunnel-access-ok.png)

### 测速对比


![Tunnel 不走优选入口时的测速](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-10-tunnel-direct-speedtest.png)

![Tunnel 走优选入口后的测速](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-09-tunnel-optimized-speedtest.png)

---

## 2. 场景二：Workers / Pages（边缘算力的 CNAME 透传）

将静态网站或轻量 API 部署在 Cloudflare Workers 时，通常有 **Route（路由匹配）** 与 **Custom Domains（自定义域）** 两种绑定方式。

对于需要接入优选的场景，最纯粹优雅的方式是**结合 Workers Route 与 DNS CNAME**。

### 配置实践

1. **确立 Workers 路由覆盖**：
   确保你的 Worker（例如驱动博客的静态托管项目）已配置通配路由规则，例如绑定了 `blog.starshadow.cc/*`：

![Workers 路由匹配 blog.starshadow.cc](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-11-workers-route.png)

2. **编排 DNS CNAME 链**：
   - 将 `blog.starshadow.cc` 配置为 `CNAME`，指向中转记录 `cdn.starshadow.cc`（仅 DNS，灰云）：

![blog CNAME 到 cdn.starshadow.cc](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-12-workers-blog-cname.png)

   - 将 `cdn.starshadow.cc` 配置为 `CNAME`，指向优选接入点：

![cdn.starshadow.cc CNAME 到优选入口](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-13-workers-cdn-cname.png)

> [!TIP]
> **关于 Pages 演进至 Workers**：目前 Cloudflare 官方已经全面推行从 Pages 迁移至 [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/)。迁入 Workers 后，资产调度和路由规则更加统一，对于需要做精细化 CNAME 优选引流的站点而言，配置路径将大幅简化。

---

## 3. 场景三：R2 对象存储（利用 Cloud Connector）

传统上，如果要给 R2 存储桶接入外部优选 CNAME，很多开发者不得不专门编写一个反代 Worker（如在 Worker 中读取 `env.MY_BUCKET.get(key)`）来转发请求。这种做法不仅增加了代码维护负担，还会额外消耗 Workers 的请求配额与执行时长。

**新一代原生解决方案：利用 Cloudflare Cloud Connector。**

### 配置实施

#### 1. 为 R2 公开存储桶绑定基准自定义域名
进入 R2 控制台 -> 点击对应存储桶 -> **Settings** -> **Public access** -> 添加 Custom Domain（例如 `r2.454849.xyz`）：

![R2 绑定自定义域名](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-14-r2-custom-domain.png)

#### 2. 配置 Cloud Connector 路由转换规则
进入域名控制台 -> **Rules** -> **Cloud Connector** -> 点击创建规则：
- **Target**：选择 **Cloudflare R2**：

![规则里选择 Cloudflare R2](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-15-r2-cloud-connector.png)

- **Bucket 配置**：选中目标存储桶，并关联前面绑定的自定义域名 `r2.454849.xyz`：

![选择 R2 存储桶和自定义域名](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-16-r2-connector-bucket.png)

- **匹配条件**：配置自定义主机名表达式，指定当请求 Host 为拟优选域名（例如 `youxuanr2.454849.xyz`）时触发直通转发：

![配置 Cloud Connector 的主机名匹配规则](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-17-r2-connector-rule.png)

#### 3. 设置 CNAME 优选记录
在 DNS 控制台中，将 `youxuanr2.454849.xyz` CNAME 至中转记录 `cdn.454849.xyz`，再由中转记录指向优选入口：

![youxuanr2 CNAME 到 cdn](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-18-r2-youxuan-cname.png)

![cdn CNAME 到优选入口](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-19-r2-cdn-cname.png)

#### 4. 结果验证注意事项
直接访问 R2 存储桶根路径（`https://youxuanr2.454849.xyz/`）时，浏览器返回 `404 Object not found` 是**完全符合预期的正常现象**，因为 S3 存储桶根路径下默认不存在索引文件：

![R2 根路径没有对象时返回 404](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-20-r2-object-404.png)

真正验证时，应请求存储桶内的具体文件路径（如 `/avatar.png`）或通过测速工具验证，此时可以看到由优选节点带来的优秀网络表现：

![R2 优选入口测速结果](/assets/posts/cloudflare-workers-tunnel-r2-cname-optimization/step-21-r2-optimized-speedtest.png)
