---
title: 为什么开启 TUN 模式就断网？一次由OPPO互联引发的网络故障
published: 2026-10-24
description: 网络故障排查。
image: /assets/posts/mihomo-tun-wlan-forwarding-conflict/cover.png
tags:
  - Mihomo
  - TUN
  - 路由
  - 网络排障
  - Windows
  - PowerShell
category: 网络折腾
draft: false
lang: ''
slug: mihomo-tun-wlan-forwarding-conflict
date: '2026-10-24'
---

在日常的代理环境中，**系统代理（System Proxy）** 与 **TUN 虚拟网卡模式** 是两套运作在不同层级的机制：

- **系统代理**基于应用层或传输层接口（如 HTTP/HTTPS/SOCKS5），依赖应用程序主动识别系统的代理环境变量或 WinINet 设置；
- **TUN 模式**则在操作系统内核中虚拟出一个三层（IP 层）网络适配器，通过系统路由表或策略路由接管全机进出流量，真正做到全应用透明透明转发。

按常理而言，如果系统代理可用，说明节点链路、鉴权与基础连通性均无异常。然而，在某次系统重启后，出现了一个诡异故障：**系统代理工作一切正常，但只要切换到 TUN 模式，所有网络通信瞬时阻断，全部失联。**

本文记录了这次排查的全过程。

---

## 1. 现象复现与初探：DNS 假象与 Loopback 警报

将客户端（Clash Verge / Mihomo 内核）切至 TUN 模式后，无论是浏览器、终端命令行还是日常应用，均提示无法建立连接。

打开 Mihomo 的实时控制台，日志迅速被大量警告信息刷屏：

```text
[TCP] dial DIRECT (match RuleSet/cn-ip)
172.21.191.110:2750 -> 120.53.53.53:443
error: reject loopback connection to: 120.53.53.53:443

[TCP] dial DIRECT (match RuleSet/cn-ip)
172.21.191.110:2749 -> 223.5.5.5:443
error: reject loopback connection to: 223.5.5.5:443

error: dns resolve failed: couldn't find ip
```

![图 1：Mihomo 控制台中的 loopback 拒绝与 DNS 解析失败日志](/assets/posts/mihomo-tun-wlan-forwarding-conflict/01-mihomo-loopback-log-a.png)

![图 2：大量直连出站连接因 loopback 检测被终止](/assets/posts/mihomo-tun-wlan-forwarding-conflict/02-mihomo-loopback-log-b.png)

### 诊断误区与底层警示

很多人看到 `dns resolve failed` 会下意识去修改 DNS 配置、更换上游 DoH 地址或改动 Fallback 组。但在本例中，DNS 失败仅是**表象**，罪魁祸首其实是紧随其后的这行核心警告：

```text
error: reject loopback connection to: 223.5.5.5:443
```

在配置中，`223.5.5.5:443` 与 `120.53.53.53:443` 是直连（`DIRECT`）访问的公共安全 DNS 服务器。
Mihomo 抛出 `reject loopback connection`，意味着：**内核发出的直连出站数据包，经过系统协议栈的路由决策后，并没有顺利通过真实网卡送出物理链路，反而被某种路由或转发机制重新送回了 TUN 自身或本地监听端口。**

为了防止网络栈形成无休止的自我死循环进而耗尽系统句柄与 CPU，Mihomo 的保护机制主动掐断了该连接。直连 DNS 连不出去，上层域名自然全部瘫痪。

---

## 2. 深入系统协议栈：锁定物理网卡的 IPv4 转发属性

既然问题出在出站流量被反弹回环，就必须检查当前主机的网络接口状态与路由策略。

以管理员身份打开 PowerShell，执行以下命令，检索当前所有 IPv4 适配器的状态：

```powershell
Get-NetIPInterface -AddressFamily IPv4 | Format-Table InterfaceAlias, Forwarding, ConnectionState
```

输出呈现了一个不寻常的状态：

```text
InterfaceAlias              Forwarding  ConnectionState
--------------              ----------  ---------------
WLAN                        Enabled     Connected
vgate0                      Enabled     Connected
Loopback Pseudo-Interface 1 Enabled     Connected
```

![图 3：初次排查发现物理 WLAN 接口的 Forwarding 处于 Enabled 状态](/assets/posts/mihomo-tun-wlan-forwarding-conflict/03-wlan-forwarding-enabled.png)

### 为什么 WLAN 的 Forwarding 会导致 TUN 环路？

在常规桌面操作系统中，普通的客户端物理网卡（如无线网卡 `WLAN`）默认应该处于 **终端角色**（Host Model），即：
- `Forwarding = Disabled`：本机只接收目的地址为本机的报文，出站数据包直接交给网关。

而一旦将物理网卡配置为 `Forwarding = Enabled`，Windows 的 TCP/IP 协议栈就会切换为 **路由器角色**（Router Model），允许在该网卡和其他接口之间转发非本机目的地的数据包。

当 TUN 虚拟适配器接管了默认路由（`0.0.0.0/0`），而物理出口网卡同时又开启了数据包转发时，系统在处理从虚拟网卡发往物理出口的 `DIRECT` 流量时出现转发判决紊乱，将出站包重新判定进入转发流程，从而导致数据包重入 TUN 接口，构成了内核层面的环路。

---

## 3. 临时关闭 WLAN 转发与权限注意

对症下药，尝试精准关闭 `WLAN` 网卡的转发功能：

```powershell
Set-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -Forwarding Disabled -PolicyStore ActiveStore
```

在普通权限窗口下执行时，系统会报 `Windows System Error 5：拒绝访问`：

![图 4：未提权时尝试修改网卡配置将遭遇 System Error 5](/assets/posts/mihomo-tun-wlan-forwarding-conflict/04-powershell-access-denied.png)

切换至**管理员权限**的 PowerShell 重新执行上述指令后，指令顺利完成。

**结果立竿见影：**
WLAN 接口的 Forwarding 关闭的瞬间，Mihomo 日志中的 `reject loopback connection` 全部消失，所有直连 DoH 恢复响应，TUN 模式下的海内外访问彻底恢复正常！

**物理网卡被激活的 IPv4 转发，正是扼杀 TUN 路由的关键根源。**

---

## 4. 幽灵复发：ActiveStore 与 PersistentStore 的博弈

本以为大功告成，但在常规重启 Windows 之后，断网故障如期复发。

再次执行检查，令人头疼的一幕出现了：

```text
InterfaceAlias  Forwarding  ConnectionState
--------------  ----------  ---------------
WLAN            Enabled     Connected
```

![图 5：重启系统后，WLAN 接口的转发属性再次被重新置为 Enabled](/assets/posts/mihomo-tun-wlan-forwarding-conflict/05-forwarding-enabled-after-reboot.png)

![图 6：复核确认，重启后网卡转发确已重新生效](/assets/posts/mihomo-tun-wlan-forwarding-conflict/06-forwarding-enabled-again.png)

难道之前的设置没有保存？

在 Windows 网络模型中，配置存储被划分为两个维度：
1. **`ActiveStore`**：当前内核内存中正在生效的实时网络状态，生命周期仅持续到当前开机运行期；
2. **`PersistentStore`**：写入注册表中的持久化配置，供系统下一次启动及适配器初始化时加载。

为了搞清楚到底是“写入失败”还是“开机被篡改”，分别对两个 Store 进行查询：

```powershell
# 查询当前运行生效值
Get-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -PolicyStore ActiveStore | Select-Object InterfaceAlias, Forwarding

# 查询持久化存储值
Get-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -PolicyStore PersistentStore | Select-Object InterfaceAlias, Forwarding
```

对比输出令人大吃一惊：

```text
# ActiveStore（当前生效）
WLAN    Enabled

# PersistentStore（持久配置）
WLAN    Disabled
```

![图 7：ActiveStore 与 PersistentStore 的截然相反对比](/assets/posts/mihomo-tun-wlan-forwarding-conflict/07-active-vs-persistent-and-wsl.png)

![图 8：完整的输出信息佐证持久化与运行态的割裂](/assets/posts/mihomo-tun-wlan-forwarding-conflict/08-active-persistent-wsl-output.png)


系统持久化注册表中明明清清楚楚写着 `Forwarding = Disabled`，但在系统开机进入桌面的过程中，**有某种未知的后台服务或驱动程序强行将 WLAN 接口的当前运行态改写成了 `Enabled`！**

---

## 5. 排除误判：WSL2 镜像网络的嫌疑洗清

由于测试机上配置了 WSL2（Ubuntu 24.04），且启用了进阶的镜像网络特性：

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
autoProxy=true
```

WSL2 的 Mirrored 模式依赖 Host Network Service (HNS) 和底层虚拟网络交换机，经常与各类代理网卡发生互动，因此成为首要怀疑对象。

将配置暂时降级回传统的 NAT 模式：

```ini
[wsl2]
networkingMode=nat
```

随后执行 `wsl --shutdown` 并重启计算机。进入系统后再次捕获状态：

```text
WLAN    Enabled    Connected
```

![图 9：切换为 NAT 模式后，WLAN 依然在开机后被置为 Enabled](/assets/posts/mihomo-tun-wlan-forwarding-conflict/09-wsl-nat-forwarding-still-enabled.png)

![图 10：重启验证排除了 WSL 镜像网络作为罪魁祸首的可能性](/assets/posts/mihomo-tun-wlan-forwarding-conflict/10-forwarding-enabled-after-nat-reboot.png)

由此可以确定：**WSL2 不是导致物理网卡被强制开启转发的元凶。**

---

## 6. 水落石出：跨屏协同软件的隐秘操作

在排除了系统内置组件后，顺着时间线倒推近期安装的第三方软件：**问题恰好始于安装「OPPO 互联」之后。**

### 为什么手机跨屏软件会篡改网卡属性？

诸如 OPPO 互联、各类手机多屏协作助手等工具，为了实现跨设备无感连接、低延迟投屏与局域网大文件 P2P 流转，往往集成了复杂的多网络适配策略：
1. **自动热点与 Wi-Fi Direct 桥接**：在不需要路由器的情况下，建立手机与 PC 的高速直接通道；
2. **虚拟局域网与网络共享**：为了让手机能借助 PC 的网络或将手机热点透明共享给 PC，其常驻后台服务会在初始化或检测到特定无线网卡时，直接下发网卡参数变更指令，强制开启物理 WLAN 适配器的 IP Forwarding；
3. **开机服务的隐蔽性**：许多用户即使在任务管理器里关闭了客户端 UI 的“开机启动”，这类软件安装的 Windows 系统后台服务（Service）和驱动依然会在系统引导时随内核启动，并悄无声息地改变网络运行栈。

### 最终解决与验证

在 Windows「控制面板」或「应用与功能」中，**完整卸载「OPPO 互联」及其随附的网络协同驱动组件**。

重启计算机后再次验证：

```powershell
Get-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 | Format-Table InterfaceAlias, Forwarding, ConnectionState
```

输出终于回归预期：

```text
InterfaceAlias  Forwarding  ConnectionState
--------------  ----------  ---------------
WLAN            Disabled    Connected
```

随后启动 Mihomo 并开启 TUN 模式：
- 节点连通；
- DoH 与直连出站流量顺畅通过物理出口；
- 多次重启机器测试，`Forwarding` 均死死保持在 `Disabled`，困扰已久的 TUN 断网幽灵彻底烟消云散。

---


```

### 常用排查命令速查

```powershell
# 1. 检查各网卡 IPv4 转发状态
Get-NetIPInterface -AddressFamily IPv4 | Format-Table InterfaceAlias, Forwarding, ConnectionState

# 2. 临时关闭指定物理网卡的转发（需管理员权限）
Set-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -Forwarding Disabled -PolicyStore ActiveStore

# 3. 对比运行态与持久态差异
Get-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -PolicyStore ActiveStore | Select-Object InterfaceAlias, Forwarding
Get-NetIPInterface -InterfaceAlias "WLAN" -AddressFamily IPv4 -PolicyStore PersistentStore | Select-Object InterfaceAlias, Forwarding
```

