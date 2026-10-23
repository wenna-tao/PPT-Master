# PPT-Master · Peachworks 学习工作台 v0.6

保留原站 DDL 规划器，逐步增加材料提取、要求核对、演讲设定、大纲编辑和可编辑 PPTX 导出。中文优先，兼顾电脑、平板与手机。

## 现在可用

- DDL 多项目、任务增删改查、七日视图、JSON/CSV/ICS 导出及备份导入。沿用 `peachworks_v03_workspace` 和旧版迁移逻辑。
- DDL 区域新增专注钟：默认 50 分钟，范围 25–120 分钟；支持暂停、继续、任务关联、放大视图、可选常亮与轻声提示。切换应用和刷新后按结束时间恢复，完成轮次与分钟数只在本机记录。
- 上传 PDF / PPT / PPTX / TXT / MD，或粘贴要求。文件在浏览器内提取，原始文件不上传。
- 本地关键词摘录，并可逐项修改交付物、评分点、限制和待确认问题。
- 填写日期、听众、时长、语言，以及自己的观点与证据。
- 建立结构模板，编辑 1–16 页标题、要点、演讲备注和来源，调整顺序与配色。
- 导出真正可编辑的 PPTX、Markdown 大纲及 JSON 演示草稿。
- 可选 Gemini / DeepSeek 服务端辅助整理与大纲；没有配置时明确显示“AI 未启用”。PPT 接口不会调用 OpenAI 或 Claude。作业辅导有独立的 DeepSeek / Gemini 接口，默认全部关闭。

## 作业辅导：DeepSeek / Gemini

`#tutor` 支持文字与单张图片提问，只有 DeepSeek、Gemini 两个选项。两家的对话在本页内分开，刷新清空；不持久化问题、答案、图片或访问码。仅主动点击发送并同意后，才发送当前问题、当前附图和该 AI 最近最多两轮完整文字。

**默认两家均未启用。没有真实密钥时明确显示“未启用”，不会生成假答案、自动重试或切换服务商。** 根据用户最终决定，已移除 ChatGPT / Claude 的页面入口、后台适配器、配置项和调用路径；过期配置或伪造请求不能重新启用。相应的 7 人阈值、4 次降额和浏览器人数统计也已移除。本站不转发个人 ChatGPT 订阅、网页账号或登录 Cookie。

### 在原 Netlify 项目启用

1. 将原 Netlify 项目连接到 GitHub，发布源码。拖放静态 ZIP 不会部署问答后端。
2. 运行 `node scripts/tutor-secrets.mjs`，在被 Git 忽略的 `.env` 中生成随机常规访问码和独立管理码，不打印秘密、不开启付费调用。免费期设 `TUTOR_TRIAL_MODE=true`，把约定试用码只填写在私密的 `TUTOR_TRIAL_ACCESS_CODE`；约定码不包含在源码、示例或 ZIP 中。
3. 将私密配置安全地复制至 Netlify 的服务端环境变量 / Functions 范围。`TUTOR_ADMIN_ACCESS_CODE` 至少 32 字符，不能与访客码相同。不要上传 `.env`，也不要把密钥发到聊天中。
4. 只给要开放的提供商设置 `TUTOR_DEEPSEEK_*` 或 `TUTOR_GEMINI_*` 中的 `API_KEY`、`MODEL`、`ENABLED=true`；模型 ID 应在自己的账户中确认。确认具体模型支持图片后才设 `VISION=true`，默认关闭图片能力。PPT 的 `AI_PROVIDER` 与辅导单独配置。
5. 确认提供商支持的地区和使用条件后才设置 `TUTOR_ENABLED=true` 并重新部署。检查 `/api/tutor/status`，再在网页中用访问码实际提问一题。状态“已配置”只表示配置完整，不证明真实密钥、余额、模型权限或图片能力已验证。
6. 检查 Netlify 站点级 `peachworks-tutor-usage` Blobs 存储是否正常。没有 Blobs 上下文时停止调用，不用本机内存冒充线上配额。

### 自己优先、朋友限额

- 用户不用登录 AI 账号，凭访问码提问。免费期使用配置好的固定试用码；结束免费期时运行 `node scripts/tutor-secrets.mjs --end-trial`，把新随机 `TUTOR_ACCESS_CODE` 和 `TUTOR_TRIAL_MODE=false` 更新至 Netlify 后重新部署，旧试用码失效。管理码不改变。
- 自己在同一输入框填写独立管理码，点击“验证访问码”。管理者不受访客每日次数限制，不扣朋友额度；身份只能由服务端验证，页面参数不能冒充。仍遵守单次长度、授权、重放、平台频率与提供商余额限制；此权限不预留提供商容量或账户余额。
- DeepSeek、Gemini **各为全站访客每天共享最多 10 次**，不是每人 10 次。`TUTOR_<PROVIDER>_DAILY_LIMIT` 只能降至 1–10，超大配置仍不超过 10。按 `Europe/London` 日期重置。
- 不再统计人数，不设置匿名识别 Cookie，不收集 IP 指纹。每日配额只保存不含题目的随机请求 ID；管理者使用单独的逐请求去重记录。升级兼容旧额度，保留已有当日用量，并在下一次成功写入时移除旧人数字段。
- 采用 Netlify Blobs 站点级强一致读取和 ETag 原子条件写入，**先预占、再发付费请求**。刷新、冷启动或重新部署不重置当日次数。失败和超时也占一次，重复请求 ID 拒绝再次调用。存储故障停止调用，没有自动重试、模型切换或付费故障转移。
- 每次最多 800 输出 token；内部生成 token 也可能占用提供商的上限，回答可能不完整。输入单独计费：问题最多 2000 字符，历史最多 4000、每条最多 1600，超长整轮省略，不切断公式或代码，不发送 DDL/PPT 数据。
- 单图原文件限 5 MB，本机转换为最长边 1280 像素、JPEG 不超过 300 KB；服务端再验证大小、格式和图像头尺寸，不接收远程图片 URL。发送前确认文字清晰。
- 次数限制不是固定金额预算。API 另行计费，不使用个人聊天订阅；Netlify 托管/存储也可能计费。关闭 `TUTOR_ENABLED` 可停止新问答；模型没有默认 ID，所有开关默认关闭。

### 访问与验证边界

仓库私有只隐藏源码，不等于网站访问保护；这里保护问答接口，静态页面可以浏览。境外部署不自动改变提供商的终端用户地区规则。DeepSeek / Gemini 的实际网络、地区资格、密钥和模型可用性须各自验证，**未验证时不承诺国内免 VPN 稳定可用**。

当前适配器、费用控制和管理权限通过明确标注的模拟响应验证，未完成真实提供商或已部署 Blobs 付费调用验证。没有密钥时不声称 AI 已能回答。AI 不能保证答案正确；条件不足时询问补充，禁止考试作弊/隐瞒作者身份的要求只给概念辅导。用户代码作为文字发送，不在服务器执行。模型处理收到的内容，Netlify 仍可能保留常规访问日志；本站不把题目或图片写入 Blobs。

## 本地运行

需要 Node.js 22.12 或更新版本。解压并进入项目目录后运行：

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

打开终端显示的 `http://localhost:4173/#studio`。不填写任何密钥即可使用本地模式；导出接口也不需要模型密钥。`npm run dev -- --static` 可测试没有后端时的浏览器导出备用路径。不要直接双击 HTML，模块和 PDF worker 需要 HTTP/HTTPS 服务。

## 发布到 GitHub Pages（无模型费用的前端版本）

仓库目标：`wenna-tao/PPT-Master`。GitHub Pages 只运行静态文件，**不运行 Netlify Functions，也不能安全存储模型密钥**。因此 Pages 版本保留本地提取、要求摘录、大纲编辑及浏览器 PPTX 导出；AI 按钮关闭。

1. 将项目源码放到仓库根目录，默认分支为 `main`。已有仓库请先检查内容，不要覆盖无关文件。
2. 在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。
3. `.github/workflows/pages.yml` 会安装锁定依赖、运行测试、构建 `dist/` 并发布。
4. 在 Actions 中确认成功结果，访问该部署结果返回的 URL。通常形式为 `https://wenna-tao.github.io/PPT-Master/`，以实际返回结果为准。
5. 静态部署不需要任何 API key 或第三方部署 token。

前端资源使用相对路径，支持 `/PPT-Master/` 这样的项目子路径。

## 保留 Netlify 原域名并启用安全服务端

若要在网页里实际调用 Gemini / DeepSeek，使用现有 Netlify 项目连接同一 GitHub 仓库即可。无需重建复杂后台。

1. 在 Netlify 中打开原项目 `sprightly-druid-1da7ae`，先记录上一份成功部署，便于回滚。
2. 将 GitHub 仓库连接到该项目。项目根目录应包含 `package.json` 与 `netlify.toml`。
3. 构建命令 `npm run build`，发布目录 `dist`，Functions 目录 `netlify/functions`；配置文件已经声明这些值。
4. 先创建分支预览，测试 DDL 和演示流程，再按你的发布安排上线。手动拖放 `dist` 只会发布静态网页，**不会部署服务端 AI 接口**。
5. 部署后访问 `/api/status`：未配置时应返回 `aiConfigured: false`；配置完整时只表示服务可以尝试调用，并不代表已经验证密钥或额度。
6. 同一 Netlify 域名上的 DDL 存储键没有变化。GitHub Pages 是另一个域名，不会自动拿到原站浏览器数据；请先在原站导出 JSON，再在新站导入。

### 配置 Gemini 或 DeepSeek（二选一）

本地可将 `.env.example` 复制为 `.env`；线上在 Netlify **服务端环境变量 / Functions 运行范围**中设置，不要写进 HTML、前端 JS、GitHub 公开文件或静态构建变量。

| 变量 | Gemini | DeepSeek |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `deepseek` |
| `GEMINI_API_KEY` | 服务商密钥 | 留空 |
| `GEMINI_MODEL` | 你账户可用且支持 generateContent JSON Schema 的模型 ID | 留空 |
| `DEEPSEEK_API_KEY` | 留空 | 服务商密钥 |
| `DEEPSEEK_MODEL` | 留空 | 你账户可用的 Chat Completions 模型 ID |
| `PEACHWORKS_ACCESS_CODE` | 自行设置的私密测试访问码 | 同左 |
| `PEACHWORKS_ALLOWED_ORIGIN` | 可选，固定站点 origin，不含结尾 `/` | 同左 |

默认 `AI_PROVIDER=none`，不调用任何提供商。没有默认模型，以避免误用不在你账户内的模型。选择 `gemini` 只调用 Google，选择 `deepseek` 只调用 DeepSeek，失败不会自动切换或重试。

修改运行环境配置后重新部署。预览站和正式站域名不同；若设置固定 `PEACHWORKS_ALLOWED_ORIGIN`，应按部署环境分别设置，或留空使用请求自身的 origin。

访问码用于小范围邀请测试，填在页面的“AI 辅助与隐私设置”。它与提供商密钥不同，不持久化到 localStorage。即使服务端已配置，访问者仍需勾选课程规则和发送授权，并主动点击 AI 按钮才会发起一次请求。

### 用量控制

- 提取、编辑、备份、预览及 PPTX 导出不调用模型。
- AI 正文每次最多 12000 字符；不发送原始文件、图片、聊天历史或 DDL 数据。
- 单次整理最多 2400 输出 token，大纲最多 4500；DeepSeek 关闭 thinking 模式。
- 不自动调用、不中途轮询模型、不自动重试，不做付费故障转移。
- Netlify Functions 声明每 IP/域名每分钟 12 次请求限制，正式发布后需在 Netlify 实测平台规则是否生效。本机预览使用独立的 60 次/分钟限制。
- 单次限制不是月度费用上限。启用 AI 前，在服务商账户设置适合自己的额度或预算；关闭 `AI_PROVIDER` 可停止新模型请求。

## 数据流与接口

```text
文件 → 浏览器本机提取 → 用户核对正文与要求
                                ↓（主动授权、访问码正确）
                           /api/assist → Gemini 或 DeepSeek
                                ↓
                       用户修改大纲与来源
                                ↓
                /api/export → PPTX（无模型调用）
                静态站备用：浏览器本地生成 PPTX
```

- `GET /api/status`：只返回可用状态与服务商名称，不返回密钥、访问码或原始材料。
- `POST /api/assist`：同源检查、访问码验证、发送授权、输入/输出格式及长度验证。响应失败不回传服务商原始报错内容。
- `POST /api/export`：对上下文和幻灯片再次验证，在服务端用 PptxGenJS 打包可编辑文本与备注，返回二进制 PPTX。
- 上传文件不写入服务器磁盘，不创建云端文件库，不记录请求正文。服务端函数宿主仍会有常规访问日志，AI 提供商仍按其政策处理收到的文字。
- 本机演示草稿含正文与个人材料，保存在单独的 `peachworks_presentation_v05` 键中。清除演示草稿不清除 DDL。
- 构建只复制 `public/` 及解析库，不读取 `.env`，不把服务端代码放进 `dist/`。Netlify 的 CSP 使用原有内联脚本哈希；GitHub Pages 不应用 `_headers` 文件。

## 专注钟与白噪音

在 DDL 区域点击“开始 50 分钟”，也可选择 25 / 50 / 90 / 120 分钟，或输入范围内的整数分钟。开始后锁定本轮时长，暂停可保留剩余时间；重置需要确认，不会清除已完成的专注记录。当前项目的未完成任务可关联到本轮；专注结束后请按实际进度自行勾选任务。

时钟使用横向长方形液态玻璃样式，显示分钟与秒数。“设置背景”可切换森林、蜜桃、海盐、薰衣草配色，或上传 5 MB 以内的 JPG / PNG / WebP；图片缩小后仅保存在当前浏览器，不上传服务器。可关闭流动效果，并尊重系统的减少动态效果偏好。背景不改变计时。

计时进行中，页面切换为横屏比例（包括放宽电脑窗口、手机或平板横屏）会自动进入大字专注视图；转回竖屏时，自动打开的视图会收起。手动打开的视图由自己关闭。展开图标进入大字视图；顶部可选择自动布局、横向大字或竖向居中，也可点击全屏图标隐藏支持浏览器的工具栏。不支持全屏时保留页内大屏时钟，设备方向由系统控制。横屏收起桃树与次要提示，并按屏幕调整字距、尺寸和留白。

“放大时钟”提供适合手机摆在旁边看的大字倒计时，右下方留出白噪音小窗空间。画中画需要在 B 站和设备中手动开启，本站不会嵌入视频或控制 B 站。切换应用时计时继续，不锁其他 App，也不因切换而扣除记录。

计时依据设备时间戳，不依靠每秒递减。锁屏、关闭标签页或系统暂停网页时，网页不能保证即时发声；回到页面会校准剩余时间并结算已结束轮次。屏幕常亮只在浏览器和系统允许、页面可见且正在计时时尝试保持，暂停或结束后释放。轻声提示默认关闭，不播放内置白噪音。

专注记录使用独立的 `peachworks_focus_v1` 存储键，不清除或覆盖 DDL 与演示草稿。不同设备和浏览器之间不自动同步。计时完成表示完成了一轮计划时间，并不监测或判断实际注意力。

## 当前边界

- PDF 最多 60 页；扫描图片没有 OCR。PPTX 最多 100 页，按实际幻灯片顺序读取正文；不提取图片、图表、备注、批注。旧版 `.ppt` 仅按二进制文本记录尽力提取，复杂或加密文件请先另存为 `.pptx`。
- 单文件最多 10 MB，PPTX 解压总量最多 40 MB；本地正文最多 24000 字符。超过限制不会悄悄截断，提取失败不会替换原有文字。
- 本地整理是关键词摘录，本地大纲是结构模板。AI 草稿也需要对照原文核对；不编造证据或引用，不提供隐瞒 AI 使用或冒充本人完成考核的功能。
- 幻灯片仅导出基本文字版式和备注，不复制源文件里的图片、图表或动画。字体在 Windows/Mac 上可能替换；导出后应在实际使用的 PowerPoint 中复核。
- 已做本机浏览器响应式验收，尚未在真实 Windows、iPad、手机、微信内分别实机测试；无法保证各地区或微信内的 GitHub/Netlify 可达性。
- Gemini/DeepSeek 适配器有模拟响应测试。**未配置真实密钥时，没有真实模型调用成功的验证。**

## 文件导航

`public/index.html` 保留 DDL 和原站风格；`public/assistant.js` 管理新流程；`public/extract.js` 在本机解析文件；`public/shared/` 提供验证与导出版式；`netlify/functions/peach.mjs` 是服务端入口；`netlify/lib/providers.mjs` 是两家服务商适配；`scripts/` 是构建与本机预览；`tests/` 是接口和导出验证；`reference/original-site.html` 是公开原站恢复快照，不会发布到网站。

## 官方参考

- [GitHub Pages 自定义发布流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Netlify Functions API 与频率限制配置](https://docs.netlify.com/build/functions/api/)
- [Gemini generateContent 结构化输出](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [DeepSeek JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)

## 作业辅导官方接口参考

- [Gemini 图片理解](https://ai.google.dev/gemini-api/docs/image-understanding)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [Netlify Blobs 原子条件写入](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
