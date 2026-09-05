import { INTEGRATION_VERSION } from './integration';

export const INTEGRATION_SKILL = `---
name: muirouter-integration
description: 接入或升级 MuiRouter AI Provider。用户说“接入 MuiRouter 作为 AI Provider”时，完成项目登记、凭证安装、调用适配和业务验收。
metadata:
  version: "${INTEGRATION_VERSION}"
  managed_by: muirouter-cli
---

# MuiRouter 接入与升级

目标：项目专注业务；模型和供给由 MuiRouter 配置。默认发送 model: "default"。
入口：https://api.muirouter.com/v1；接入工具：pnpm dlx @muirouter/cli@${INTEGRATION_VERSION}。
下文 muirouter 表示已安装的 CLI；未全局安装时，每条命令用 pnpm dlx @muirouter/cli@${INTEGRATION_VERSION} 代替 muirouter。

## 执行

1. 读取当前项目的 AGENTS.md、依赖、AI 调用和部署说明，保护无关改动；不读取 .env 或 .dev.vars，不搜索或输出密钥值。
2. 执行 muirouter connect --json。首次需要用户在浏览器登录一次。重复执行应复用 .muirouter.json 和本地凭证，不重复建项目或重置配置。
3. 依据 connect 返回的配置适配服务端调用。OpenAI SDK 使用 baseURL + MUIROUTER_API_KEY；通用文本从 MUIROUTER_MODEL 取值，缺省 default。图片/音频/视频使用各自的显式模型或中心对应能力默认，不能套用文本默认。业务校验、用户套餐、积分和任务流程保持原语义。
4. 本地用 muirouter run -- <启动命令> 注入凭证；Cloudflare 部署用 muirouter credentials install --config <已核实的 wrangler 配置>。仅将项目运行 key 安装到目标服务，不把管理 token 放进项目、网页或 Git。
5. 执行 muirouter doctor --probe --json，再运行项目相关回归和构建。验证结构化结果、流式工具调用、多模态输入、费用记录和实际扣款。doctor 的调用成功不等于整个业务验收通过。
6. 有部署授权时使用项目现有流程完成发布和线上验证，保存非秘密的接入状态。缺少账户登录或上游凭证时明确报告具体待办，不把项目标成完成。

## 配置

优先级：请求显式模型（包括项目环境变量） > 项目中心 defaults > 全局 defaults。
MUIROUTER_BASE_URL 默认为 https://api.muirouter.com/v1；Anthropic SDK baseURL 使用 https://api.muirouter.com。
Chat: /chat/completions；OpenAI Responses: /responses；Anthropic: /v1/messages；Images: /images/generations、/images/edits；TTS: /audio/speech；STT: /audio/transcriptions。
每种协议和模型能力都要匹配；缺能力时通过中心配置或中心 adapter 修复一次，不在所有项目复制 provider 分流。
内部项目 meter_only 继续计量、估算费用，chargedCost=0。它由管理员授权，普通运行 key 不能自行开启。各项目终端用户计费规则是独立业务。

## MCP 与升级

远程 MCP：https://api.muirouter.com/mcp。先 get_service_info / get_upgrade_plan，随后读取配置版本，再 apply_configuration；修改使用 expectedVersion 与 idempotencyKey。
模型、默认值、项目、连接配置工具返回结构化数据；连接只接收 credentialRef，不读取上游密钥。需要实际密钥安装时由 CLI 安全传递。
执行 muirouter upgrade --json 更新接入规范和 skill，保留显式模型覆盖与业务代码；按返回步骤补齐代码，再 doctor 和业务回归。
全局默认切换不需要各项目重新部署。已有协议和业务不兼容时保留项目覆盖，不静默删除能力。
`;
