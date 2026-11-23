# AI Companion — Flutter App

这是放在现有网站仓库中的独立 Flutter 应用目录，不会覆盖仓库原有的网站文件。

## 当前状态

- 已建立 Flutter 项目基础结构。
- 已加入中文 AI 聊天界面。
- 当前聊天回复是本地演示文字，**尚未连接 GPT API**。
- 文件上传、真实 AI 回复、账号与聊天记录将在后续阶段开发。

## 本地运行

先安装 Flutter SDK、Git 和 Android Studio，然后在本目录运行：

```bash
flutter pub get
flutter doctor
flutter run
```

## 安全说明

不要把 OpenAI API Key 写入 Flutter 客户端、提交到 GitHub，或放进公开配置文件。真实 GPT 调用应经过服务端函数，并在服务端保存密钥。

## 平台说明

- Android：可在 Windows、macOS、Linux 或 ChromeOS 环境配置 Android 工具链后构建。
- iOS：需要 macOS、Xcode 和 Apple 的签名/发布配置。
- Web：Flutter 也可以构建浏览器版本。

## 官方文档

- https://docs.flutter.dev/install
- https://docs.flutter.dev/reference/create-new-app
- https://docs.flutter.dev/platform-integration/android/setup
- https://docs.flutter.dev/platform-integration/ios/setup
