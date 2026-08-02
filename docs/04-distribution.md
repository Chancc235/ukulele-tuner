# 免费部署与 iPhone 安装

## 当前准备状态

项目已经包含 `.github/workflows/deploy-pages.yml`，会先运行 22 项核心测试和静态/隐私检查，再把 `app/` 上传到 GitHub Pages。工作流配置已在本地解析，但目前没有创建远程仓库，也没有对外发布地址。

## 默认方案：GitHub Pages

GitHub Free 可以从公开仓库部署静态 PWA，并提供 `github.io` HTTPS 地址。项目没有后端、数据库或构建服务器需求，因此不产生托管费用。

### 用户需要做的事

1. 准备 GitHub 账号。
2. 确认接受项目仓库公开；部署后的前端代码无论如何都能被浏览器查看。
3. 创建一个空的公开仓库；建议名为 `ukulele-tuner`。
4. 在自己的浏览器中完成 GitHub 登录，不把密码、验证码或恢复码发给项目。
5. 把本项目推送到仓库的 `main` 分支。
6. 在仓库 Settings -> Pages 的 Source 选择 GitHub Actions。
7. 等待 Actions 显示绿色成功标记，并复制生成的 HTTPS 地址。
8. 在 iPhone 的 Wi-Fi 和蜂窝网络分别打开发布地址，确认实际可达性。

不需要 Apple Developer Program、Xcode、信用卡、付费域名或服务器账号。

### 项目负责的事

- 提供 `.github/workflows/deploy-pages.yml`。
- 自动执行测试和静态校验后才上传 `app/`。
- 使用官方 Pages Actions 发布。
- 记录发布 URL、commit、版本、Service Worker cache version 和回滚点。

## 备选：Cloudflare Pages

如果不接受公开 GitHub 仓库，或 GitHub Pages 在目标网络下不可用，可连接 Cloudflare Pages 免费计划：

- 支持公开或私有 GitHub 仓库。
- 静态资源请求在免费/付费计划中均为免费且不限量。
- 自动获得 `pages.dev` HTTPS 地址。
- 同一个 `app/` 目录可以原样部署，无需改产品代码。

私有仓库只隐藏开发历史，已发布的 JavaScript 仍可由浏览器查看。

## iOS 26 安装步骤

1. 在 Safari 打开 HTTPS 发布地址。
2. 等待页面显示“已可离线使用”。
3. 点击 Safari 的分享按钮。
4. 选择“添加到主屏幕”。
5. 开启“打开为 Web App”。
6. 点击“添加”。
7. 从主屏幕打开 UkeTune。
8. 点击“开始实时调音”并允许麦克风。

如果只在微信/邮件中收到链接，应选择“在 Safari 中打开”后再添加到主屏幕。

发布后复制同一个 HTTPS 地址即可通过微信、邮件或备忘录发送。安装只需要目标 iPhone；不需要两台 iPhone，也不需要发送 `.ipa` 安装包。

## 录音备用流程

1. 在“语音备忘录”录制 2–10 秒，一次只拨一根弦。
2. 分享 -> 存储到文件。
3. 打开 UkeTune -> 选择录音（本机分析）。
4. 选择 `.m4a` 文件并等待结果。

文件不上传到 GitHub、Cloudflare或任何服务器。

## 更新与回滚

- 每次发布提升应用版本和 Service Worker cache version。
- 新 Service Worker 下载完成后提示用户刷新，不在调音过程中强制重载。
- 激活新版本后删除旧应用壳 cache，但绝不删除用户系统中的录音文件。
- 如果新版本 P0 失败，回滚 Git commit 并重新部署，生成新的 cache version。
- 用户在线打开一次即可取得更新；无需重新添加主屏幕图标。

## 网络现实

免费境外托管在中国大陆不同运营商下的可达性不能只靠桌面判断。正式选择平台前，用目标 iPhone 在 Wi-Fi 和蜂窝网络各测试 GitHub Pages；不稳定就切 Cloudflare Pages。首次安装完成后，调音和本地录音分析不依赖网络。

## 官方资料

- [GitHub Pages 简介和免费范围](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 自动部署](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages 免费限制](https://developers.cloudflare.com/pages/platform/limits/)
- [Apple：将网站作为 Web App 添加到主屏幕](https://support.apple.com/en-bw/guide/iphone/iphea86e5236/26/ios/26)
