---
title: 个人站点保护的常见思路
published: 2026-05-16
description: 探讨现代 Web 源站防护的方法。
image: /assets/posts/cloudflare-origin-protection/cover.webp
tags:
  - 源站保护
  - Cloudflare
  - Caddy
  - Docker
  - UFW
  - mTLS
category: 网络折腾
draft: false
lang: ''
slug: cloudflare-origin-protection
date: '2026-05-16'
---

在给网站套上 CDN（如 Cloudflare）之后，很多开发者往往会陷入一个虚假的安全感中：“我的 DNS 已经开启了小黄云（Proxy），解析出来的都是 CDN 节点的 Anycast IP，所以源站万无一失。”

然而，在现实的网络攻防与自动化扫描面前，**“隐藏源站 IP”几乎是一个不可能完全成立的伪命题**：
- 历史解析记录（DNSDB、SecurityTrails 等平台常年记录着解析历史）；
- 全网主动嗅探（Censys、Shodan 等搜索引擎通过扫描全网 IPv4 抓取证书和 HTTP 响应）；
- 源站向外发起的请求（如调用第三方 Webhook、抓取外部资源、邮件发送暴露发件 IP）；
- 运维误操作或安全组/防火墙策略疏忽。

一旦源站真实 IP 泄露，攻击者只要修改本地 `hosts` 或在请求中携带对应的 `Host` 头部，就可以完全绕过 Cloudflare 的 WAF、DDoS 弹性防护与速率限制，将攻击流量直接倾泻至源站服务器。

因此，现代源站安全的核心策略应当转变：**不再寄希望于 IP 永不曝光，而是做到“即便真实 IP 彻底公之于众，未经认证鉴权的请求也绝对无法触达源站服务”。**

本文以 AWS EC2（Ubuntu 24.04）+ Docker + Caddy 环境为例，系统化搭建一套覆盖**网络层、容器层、应用层与传输层**的五层源站防御体系。

---

## 1. 纵深防御架构模型

### 五层防御矩阵明细

| 防御层级 | 应对威胁 | 实施方案 | 核心防护机理 |
| :--- | :--- | :--- | :--- |
| **1. 域名接入层** | DNS 直接解析暴露 | Cloudflare 橙云代理 | 将对外解析收敛至 CDN 边缘节点，阻断公网常规直接连通 |
| **2. 网络接口层** | 全网端口扫描与 IP 爆破 | UFW 动态 IP 白名单 | 仅允许 Cloudflare 官方 IPv4/IPv6 CIDR 访问 Web 端口 |
| **3. 容器路由层** | Docker 绕过宿主机防火墙 | `ufw-docker` 规则重整 | 修复 Docker 修改 iptables PREROUTING 导致的防火墙旁路漏洞 |
| **4. 应用准入层** | 伪造 Host 嗅探站点内容 | Caddy 严格 Host 路由 | 未命中指定服务域名的请求全部直接中断并响应 403 |
| **5. 传输认证层** | 仿冒 CDN 协议回源 / 伪造 SNI | Origin CA + AOP (mTLS) | 强制 Full (strict) 模式，且回源连接必须提供 Cloudflare 官方客户端证书 |

![源站保护链路全景图](/assets/posts/cloudflare-origin-protection/architecture.png)

---

## 2. 部署最小化 Caddy 测试环境
我们使用 Docker Compose 拉起一个干净的 Caddy 网关，作为所有 Web 流量的唯一宿主机入口：

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./site:/srv:ro
      - ./certs:/certs:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

> [!NOTE]
> 这里仅暴露 TCP 的 80 与 443 端口。虽然 Caddy 默认支持基于 UDP 443 的 HTTP/3 (QUIC)，但 Cloudflare 到源站的回源目前主要使用稳定高效的 HTTP/1.1 或 HTTP/2 (TCP)。为了最小化攻击面并避免复杂的 UDP 规则维护，源站侧无需暴露 UDP 端口。

在未配置防护前，直接访问宿主机公网 IP，默认会毫无阻拦地渲染出 Caddy 的欢迎页：

![源站 IP 可以直接访问 Caddy 测试页](/assets/posts/cloudflare-origin-protection/source-ip-before.png)



---

## 3. 网络层：UFW 动态白名单与自动化同步

Cloudflare 官方公布了其全球边缘节点的 IP 地址段（[IPv4](https://www.cloudflare.com/ips-v4) 与 [IPv6](https://www.cloudflare.com/ips-v6)）。我们的目标是：**除必要且受保护的 SSH 管理端口外，源站的 80/443 端口拒绝一切非 Cloudflare 来源的 TCP 连接。**

### 编写自动化同步脚本

编写脚本 `/root/update_cf_ips.sh`，定时拉取最新网段并写入 UFW：

```bash
cat << 'EOF' > /root/update_cf_ips.sh
#!/bin/bash
set -euo pipefail

CF_V4_URL="https://www.cloudflare.com/ips-v4"
CF_V6_URL="https://www.cloudflare.com/ips-v6"

echo "[$(date)] 开始同步 Cloudflare IP 白名单..."

# 1. 下载最新 CIDR 表
V4_IPS=$(curl -sSL --connect-timeout 10 "$CF_V4_URL")
V6_IPS=$(curl -sSL --connect-timeout 10 "$CF_V6_URL")

if [ -z "$V4_IPS" ] || [ -z "$V6_IPS" ]; then
    echo "获取 IP 失败，中止更新以防规则被空配置冲掉！" >&2
    exit 1
fi

# 2. 遍历注入 IPv4 规则（兼顾宿主机接入与 Docker 转发链路）
for ip in $V4_IPS; do
    ufw allow proto tcp from "$ip" to any port 80 comment 'CF-HOST'
    ufw allow proto tcp from "$ip" to any port 443 comment 'CF-HOST'
    ufw route allow proto tcp from "$ip" to any port 80 comment 'CF-DOCKER'
    ufw route allow proto tcp from "$ip" to any port 443 comment 'CF-DOCKER'
done

# 3. 遍历注入 IPv6 规则
for ip in $V6_IPS; do
    ufw allow proto tcp from "$ip" to any port 80 comment 'CF-HOST'
    ufw allow proto tcp from "$ip" to any port 443 comment 'CF-HOST'
    ufw route allow proto tcp from "$ip" to any port 80 comment 'CF-DOCKER'
    ufw route allow proto tcp from "$ip" to any port 443 comment 'CF-DOCKER'
done

# 4. 重新加载防火墙
ufw reload
echo "[$(date)] Cloudflare IP 规则重载成功。"
EOF

chmod +x /root/update_cf_ips.sh
```

### 配置 Crontab 定期轮询

```bash
(crontab -l 2>/dev/null | grep -v "/root/update_cf_ips.sh"; echo "0 4 * * 1 /bin/bash /root/update_cf_ips.sh >> /var/log/update_cf_ips.log 2>&1") | crontab -
/root/update_cf_ips.sh
```

> [!WARNING]
> 在执行 `ufw enable` 前，**务必确保 SSH 端口（默认 22）已经加入放行列表**（`ufw allow 22/tcp`）。建议始终保持至少一个存活的 SSH 窗口，通过新会话验证登录无误后再断开。

---

## 4. 容器层：解决 Docker 的防火墙旁路漏洞（ufw-docker）

绝大多数开发者在配置 UFW 时最容易翻车的陷阱就在这里：**Docker 会擅自修改宿主机的 iptables 规则！**

### 漏洞分析

Linux 内核的数据包流转中，数据包进入网卡后先流经 `PREROUTING` 链。
当你在 `docker-compose.yml` 中声明 `ports: - "80:80"` 时，Docker 会在 iptables 的 `PREROUTING` 链中直接注入一条 `DOCKER` 链的 DNAT 规则，在数据包尚未抵达 UFW 控制的 `INPUT` 链之前，就强行把流量改写并转发到了容器网桥（如 `docker0` / `br-xxx`）！

这就导致：**哪怕你在 UFW 里严严实实地配置了 80 端口拒绝公网，外部只要直接敲源站 IP，依然可以长驱直入打进 Docker 容器！**


### 解决方案：使用 `ufw-docker` 实施接管

利用开源工具 [ufw-docker](https://github.com/chaifeng/ufw-docker)，在 iptables 的 `FORWARD` 阶段对容器流量重新引入 UFW 裁决：

```bash
# 下载安装 ufw-docker
curl -fsSL https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker -o /usr/local/bin/ufw-docker
chmod +x /usr/local/bin/ufw-docker

# 初始化安装（调整 /etc/ufw/after.rules）
ufw-docker install
ufw reload
```

接管之后，结合上一步脚本中的 `ufw route allow ... comment 'CF-DOCKER'`，只有符合 Cloudflare 白名单源地址的 IP，才被允许转发给 Docker 内部容器。

此时再次从外部直接在浏览器输入 `http://源站IP`，请求将被完全静默丢弃或拒绝：

![源站 IP 直接访问失败](/assets/posts/cloudflare-origin-protection/source-ip-after.png)

同时，通过已开启橙云的域名访问依然畅通无阻，证明防火墙准入控制精确生效。

---

## 5. 应用层：Caddy 严格 Host 路由与非法探测隔离

即使网络层阻断了直接探测，某些攻击者依然可能通过合法的 Cloudflare 节点（例如利用自身域名的 Cloudflare 反代）尝试将恶意流量引至你的源站 IP。为了防范针对应用层的定向撞库与探测，**Web 服务器必须对每一个 HTTP 请求的 `Host` 头部进行严格鉴权。**

在 Caddyfile 中设计默认兜底与合法白名单：

```text
# 1. 全局配置：禁用不安全的 SNI 回退
{
  servers {
    strict_sni_host on
  }
}

# 2. 合法域名业务块
https://aaa.454849.xyz {
  tls /certs/origin.pem /certs/origin.key
  root * /srv
  file_server
}

# HTTP 自动强转 HTTPS
http://aaa.454849.xyz {
  redir https://aaa.454849.xyz{uri} 301
}

# 3. 默认兜底守卫：拦截一切未匹配的非法 Host / IP 直接探测
:80 {
  respond "Forbidden" 403 {
    close
  }
}

:443 {
  tls /certs/origin.pem /certs/origin.key
  respond "Forbidden" 403 {
    close
  }
}
```

任何直接请求 IP 地址、未绑定二级域名或篡改 Host 标头的流量，都将在应用层第一时间以 `403 Forbidden` 断开：

![Caddy 对非法 Host 返回 403](/assets/posts/cloudflare-origin-protection/host-check-403.png)

---

## 6. 传输层：Origin CA + Authenticated Origin Pulls (mTLS)

前面几步已经构筑了极高的防御壁垒，但还有一个极端场景需要防范：
**如果另一个 Cloudflare 用户在其自己的账号下添加了你的源站 IP 作为回源地址，且伪造了相同的 Host，流量会不会借由 Cloudflare 的官方 IP 网段打入你的源站？**

答案是：**在未开启客户端双向证书鉴权时，理论上确实可能存在通道复用风险。**

为了彻底杜绝此类“借刀杀人”式的回源，我们需要在传输层建立 **mTLS（双向 TLS 认证）**：
- **服务器证书验证**：源站配置 Cloudflare 专有的 **Origin CA** 证书，Cloudflare 将 SSL/TLS 模式提升至 `Full (strict)`，确保回源全链路严格校验源站身份；
- **客户端证书验证**：启用 **Authenticated Origin Pulls (AOP)**，Cloudflare 在发起回源 TCP 连接并进行 TLS 握手时，必须主动向 Caddy 出示 Cloudflare 官方签发的客户端数字证书；Caddy 验签失败则立即在握手阶段切断连接！


### 部署实施步骤

#### 1. 下载 Cloudflare 全局 AOP CA 根证书

```bash
mkdir -p /opt/caddy/certs
curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem \
  -o /opt/caddy/certs/cloudflare-origin-pull-ca.pem

chmod 644 /opt/caddy/certs/cloudflare-origin-pull-ca.pem
```

#### 2. 在 Caddyfile 中应用 mTLS 鉴权片段

使用 Caddy 的 Snippet 语法复用 TLS 配置，要求并强制校验客户端证书：

```text
(origin_tls) {
  tls /certs/origin.pem /certs/origin.key {
    client_auth {
      mode require_and_verify
      trust_pool file /certs/cloudflare-origin-pull-ca.pem
    }
  }
}

https://aaa.454849.xyz {
  import origin_tls
  root * /srv
  file_server
}

:443 {
  import origin_tls
  respond "Forbidden" 403 {
    close
  }
}
```

#### 3. 实施本地反向断言测试

重启 Caddy 容器后，**先不要在 Cloudflare 控制台开启 AOP 开关**，直接在源站命令行利用 curl 发起伪造请求测试：

```bash
curl -kI --resolve aaa.454849.xyz:443:127.0.0.1 https://aaa.454849.xyz
```

若配置正确，由于本地 curl 无法提供受信任的 Cloudflare 客户端证书，终端将立刻报出底层的 TLS 握手失败：

```text
curl: (35) OpenSSL/3.x.x: error:0A000412:SSL routines::ssl/tls alert bad certificate
# 或者：
curl: (35) tlsv13 alert certificate required
```

![没有客户端证书时直接访问源站 HTTPS 触发证书要求告警](/assets/posts/cloudflare-origin-protection/aop-direct-test.png)

这一步确凿证明：**任何未经客户端证书认证的连接，在进入 HTTP 报文解析之前就已被协议栈直接击毙。**

#### 4. 在 Cloudflare 控制台点亮 AOP

登录 Cloudflare Dashboard：
1. 进入对应域名 -> **SSL/TLS** -> **Origin Server**；
2. 找到 **Authenticated Origin Pulls**；
3. 将开关置为 **Enabled**。

![Cloudflare 开启 Global Authenticated Origin Pulls](/assets/posts/cloudflare-origin-protection/cloudflare-aop.png)

开启后，Cloudflare 边缘节点在回源时便会自动注入专属客户端证书，域名访问畅行无阻，而所有旁路通道全部闭锁。

---

## 7. 防护有效性验收清单（Verification Matrix）

完成全部部署后，按照以下矩阵进行全方位验证，确保防御系统无死角且无误伤：

| 验证项 | 测试操作 | 预期观察结果 | 验证层级 |
| :--- | :--- | :--- | :--- |
| **正常合法访问** | 浏览器打开 `https://aaa.454849.xyz` | 网页秒开，SSL 证书正常显示为 Cloudflare 边缘证书 | 全链路贯通 |
| **HTTP 协议升级** | 请求 `http://aaa.454849.xyz` | 301 永久重定向至 HTTPS | 规范化链路 |
| **公网 IP 旁路攻击** | 外部公网终端 `curl http://源站IP` | 连接直接超时（Timeout）或 Connection Refused | 网络层 UFW 成功拦截 |
| **容器转发旁路嗅探**| 外部扫描探测 Docker 映射的 80/443 | 无法建立 TCP 握手 | 容器层 `ufw-docker` 拦截 |
| **伪造 Host 请求** | 携带恶意 Host 头部探测 | 返回 403 Forbidden 并立刻挂断连接 | 应用层 Caddy 拦截 |
| **无证书直连 HTTPS** | 本地直接对 443 端口发起 TLS 握手 | 触发 `alert certificate required`，握手失败 | 传输层 mTLS (AOP) 拦截 |

---

## 8. 总结与思考

这套源站立体防御体系的核心精髓在于**解耦与分层**：
1. **不要将安全寄托于“隐匿”**，隐匿不是安全；
2. **UFW 负责阻断噪音扫描**，将 99.9% 的扫描爬虫与 IP 探测挡在防火墙外，节约服务器资源；
3. **ufw-docker 修复了 Docker 环境下最致命的转发旁路**，让容器端口真正受宿主防火墙管辖；
4. **Caddy 严格 Host 策略防范泛域名探测**；
5. **mTLS (AOP) 提供了密码学级别的来源背书**，彻底终结了“同平台跨账号源站盗刷”的理论可能。



