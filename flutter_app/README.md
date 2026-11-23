# AI Companion — Flutter App

这是一个独立 Flutter 手机应用目录，Android 与 iOS 共用同一套 Dart 代码。

## 当前接入状态

- Flutter 聊天界面已连接 Supabase Edge Function：`ai-companion-chat`。
- GPT 请求由服务端转发，OpenAI API Key 不放在 App 或 GitHub 中。
- 模型：`gpt-5-mini`。
- App 使用 Supabase 匿名登录取得用户会话；需要在 Supabase Auth 中开启 Anonymous Sign-Ins。
- 还需要在 Supabase Edge Function Secrets 中设置 `OPENAI_API_KEY`，否则后端会返回 503。

## 配置

Supabase 项目 URL：`https://rhmoeecrznpkhtkoktng.supabase.co`

Edge Function：`ai-companion-chat`

在 Supabase Dashboard：
1. Authentication → Sign In / Providers（或 Auth Providers）→ 开启 Anonymous Sign-Ins。
2. Edge Functions → Secrets → 添加 `OPENAI_API_KEY`，值填写你在 OpenAI Platform 创建的 API Key。
3. 不要把 OpenAI API Key 发到聊天、提交到 GitHub，或写入 Flutter 客户端。

## 本地运行

```bash
flutter pub get
flutter doctor
flutter run
```

## 平台说明

- Android：可在 Windows、macOS、Linux 或 ChromeOS 环境配置 Android 工具链后构建。
- iOS：需要 macOS、Xcode 和 Apple 的签名/发布配置。
- Web：Flutter 也可以构建浏览器版本。

## 官方文档

- https://docs.flutter.dev/install
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://platform.openai.com/api-keys
