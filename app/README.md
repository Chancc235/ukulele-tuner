# PWA 应用目录

本目录是可直接部署的静态网站根目录。它包含：

- `index.html`：语义化单页界面。
- `styles.css`：iPhone 竖屏优先的响应式样式。
- `src/`：调音算法、麦克风、录音文件和状态管理模块。
- `manifest.webmanifest`：主屏幕安装信息。
- `sw.js`：离线应用壳缓存。
- `icons/`：PWA 与 Apple Touch 图标。

发布时只部署此目录；任何录音都不会进入该目录或离开用户设备。

页面代码不依赖构建步骤或 CDN。仓库根目录的测试和静态质量门通过后，GitHub Pages workflow 原样上传本目录。
