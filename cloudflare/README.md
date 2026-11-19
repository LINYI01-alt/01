# 邻伊 Cloudflare Workers AI 部署说明

本目录中的 `worker.js` 是网站 AI 的安全 API 网关源代码。当前网站前端尚未切换，等 Worker 部署并取得 URL 后再修改 `js/main.js`，避免先改前端导致 AI 暂时不可用。

## 免费方案约束

- Cloudflare 账户保持 Workers Free，不订阅 Workers Paid。
- 不添加付款方式，不启用付费模型或付费备用服务。
- 模型固定为 `@cf/zai-org/glm-4.7-flash`。
- 免费额度耗尽时返回提示并停止，不自动降级到任何其他供应商。
- 请求限制：单次请求最多 24 KiB、单条消息最多 2,000 字符、最多 10 条历史消息、模型输出最多 512 tokens。
- Workers AI 的免费额度按 Cloudflare 账户计量；Free 计划额度耗尽时请求会失败。不要升级以继续使用。

## 部署步骤（Cloudflare Dashboard）

1. 打开 Workers & Pages，选择 Create application / Create Worker（不要选择任何付费方案）。
2. 创建一个 Worker，名称可用 `linyi-ai-gateway`。
3. 进入 Worker 的 Edit code，把本目录 `worker.js` 的完整内容粘贴进去并保存/部署。
4. 打开 Worker 的 Settings > Bindings，添加 Workers AI binding：
   - Variable name：`AI`
   - Model：`@cf/zai-org/glm-4.7-flash`
5. 确认绑定可用，并复制 Worker 的 `https://...workers.dev` 地址。
6. 不要启用收费功能，不要升级套餐，不要添加银行卡。

## 验证

从网站页面发送一条普通科普问题，成功后 API 返回 JSON：`{"answer":"..."}`。Worker 仅接受来源为 `https://linyi01-alt.github.io` 的浏览器请求，并只允许 POST/OPTIONS。

## 重要说明

Cloudflare 的平台免费额度是最终用量上限；本 Worker 额外限制单次输入、历史长度和输出长度，但没有配置跨所有访客共享的每日计数器。若需要应用层全站每日硬上限，需要另行设计可用的持久化计数服务，并先确认其免费额度及收费边界。当前不要为了计数器开启付费存储服务。
