# T3 数据洞察官 · Gittrae

把经济数据转换为可计算、可解释、可回查原始记录的信息网络。

**所有角色必读：先读本页，再按 [交接必读总索引](handoff/README.md) 进入自己的角色。不要只转发一份任务文件；共同资料、四份基础角色文件和本轮接入说明都必须阅读。**

## 先核对版本与阶段【全员必读】

| 内容 | 已核对版本与入口 | 能证明什么 |
|---|---|---|
| 初始交接基线 | [472d151](https://github.com/ynugyz/Gittrae/tree/472d151b811cb9f4af0620c2bdc6bd8e78a09de7) | 需求、原始数据、公共接口设计与角色分工 |
| 人员3已实现代码 | [39c92f1](https://github.com/ynugyz/Gittrae/tree/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd)，开发分支 [dev/app](https://github.com/ynugyz/Gittrae/tree/dev/app) | 公共类型、页面、图谱与回源、保存恢复；见 [实现交接](handoff/人员3_界面与集成/IMPLEMENTATION.md) 和 [开发自测](reports/person3/verification.md) |
| 人员4独立材料核验 | [审计入口（1f48917）](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md) | 核验对象为初始基线472d151，包含数据参考值；不是对人员3应用的审计 |

本次只同步交接文档与导航到 `main` 和 `dev/app`，没有把应用合并到 `main`。**运行人员3应用请使用含代码的 `dev/app`；复现上述自测请使用固定提交39c92f1。** 分支后续可能前进，每次交接仍须记录实际分支和完整commit。

人员3已获授权进入开发阶段；人员1/2模块及真实模型服务尚未接入该代码版本。三域真实完整流程、真实API和集成后的独立审计仍未完成。20项开发检查、58份CSV原字节核对、11,525行财务展示检查，都不能替代这些验收。

新角色尚未获得下一阶段任务时，先按首轮模板只读核对；已明确获准开发或审计的角色按自己的授权继续。旧文档中的“首轮只读”是接收模板，不把已完成的开发重置为未开始。

## 从这里领取交接【全员必读】

依次阅读 [AGENTS.md](AGENTS.md) → [00 共同上下文](handoff/00_共同上下文.md) → [01 公共接口](handoff/01_公共接口.md) → [02 协作规则](handoff/02_协作与提交规则.md) → [03 总体验收标准](handoff/03_总体验收标准.md) → [04 初始交接包核验](handoff/04_交接包核验.md)，再进入自己的角色。

| 角色 | 必读入口（含完整阅读清单） | 本轮必须关注 | 开发助手建议 |
|---|---|---|---|
| 总控 | [总控 START_HERE](handoff/总控/START_HERE.md) | [待决定接口](handoff/人员3_界面与集成/IMPLEMENTATION.md#pending)、模块版本、集成顺序与审计边界 | Codex；协调角色，不增加一名开发者 |
| 人员1：数据与来源 | [人员1 START_HERE](handoff/人员1_数据与来源/START_HERE.md) | [数据接入](handoff/人员3_界面与集成/IMPLEMENTATION.md#data)、公共类型、来源映射、默认范围 | DeepSeek |
| 人员2：统计与AI | [人员2 START_HERE](handoff/人员2_统计与AI/START_HERE.md) | [统计与服务接入](handoff/人员3_界面与集成/IMPLEMENTATION.md#analysis)、真实API、结果到指标映射 | DeepSeek |
| 人员3：界面与集成 | [人员3 START_HERE](handoff/人员3_界面与集成/START_HERE.md) | [实现交接全文](handoff/人员3_界面与集成/IMPLEMENTATION.md)、保存边界、集成和复验 | Codex 6.1 Sol |
| 人员4：独立审计 | [人员4 START_HERE](handoff/人员4_独立审计/START_HERE.md) | [运行与恢复约定](handoff/人员3_界面与集成/IMPLEMENTATION.md#runtime)、自测证据、绑定新commit复验 | Codex |

[交接必读总索引](handoff/README.md) 是阅读清单的统一入口。每个角色目录的 `START_HERE.md`、`TASK.md`、`DELIVERABLES.md`、`STATUS_TEMPLATE.md` 均标注必读及返回入口；本轮接入说明需另外阅读，不包含在原来的“四份文件”计数中。

以上模型是各人员的开发助手。应用运行时统一通过本机服务调用DeepSeek官方API；这些对话不会自动在其他电脑建立开发或模型会话。

## 本机运行【人员1、2、3、4接入或复验前必读】

先核对所在版本确实包含 [依赖清单](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/package.json) 和 [锁文件](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/package-lock.json)。使用 Node.js 22.12+，在仓库根目录执行：

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:5173 。点击“先体验联调样例”可查看三图、数字回源、关系网络，并下载/恢复项目。样例始终标明MOCK，不调用模型，不替代真实数据验收。

`npm run build` 执行类型检查和生产构建，`npm test` 执行人员3的20项集成边界检查，`npm run format:check` 检查源码格式。`npm run review:fixtures` 在忽略目录 `local/` 生成完整财务展示、三指标选择和手算分析三个测试项目；它们仅用于界面联调。

人员1提供 `src/data/index.ts`；人员2提供 `src/analysis/index.ts` 与 `server/index.ts`。三者在上述已测代码中尚未实现，接入后重新启动。共享类型只引用 `src/contracts/index.ts`，具体导出、字段和失败处理见 [实现交接](handoff/人员3_界面与集成/IMPLEMENTATION.md)。

模型服务绑定 `127.0.0.1:8787`，前端统一代理 `/api`。启动脚本检测 `server/index.ts`，存在时一并启动，并仅在服务端读取本机 `.env`；缺失时明确提示未接入。仓库没有真实密钥或真实API成功记录。

保存恢复保留已完成分析的范围、ID、来源和历史解释，不自动重新计算或请求模型。未计算的筛选草稿未纳入v1的 `selection`，当前仅保存其中的指标选择。

## 产品范围与验收【全员必读】

- 三名开发、一名独立审计、一个总控对话；正式开发以150分钟为目标，作品在一台主机的本地浏览器运行。
- 支持居民收支、企业财务、汽车销量三类CSV；计算均值、中位数、样本标准差、分布和相关性，展示直方图、散点图和箱线图。
- 信息网络连接来源、数据集、指标、分析范围、计算和发现；点击数字回查参与计算的原始记录。
- 真实DeepSeek解读属于最终硬验收，事实与AI解读分区，相关不等于因果；支持本地项目保存恢复。

技术方案为React、TypeScript、Vite、Papa Parse、ECharts、本机Node模型代理。验收必须对指定代码版本实测，详见 [验收场景](acceptance/cases.md) 和 [团队核验样例](acceptance/fixtures/README.md)。

## 数据与交接材料【按角色必读标记进入】

- [真实数据与来源说明](data/README.md)、[数据清单](data/manifest.json)：58份原始CSV，按来源保留字节；人员1、2、4及处理回源的人员3必读。
- [实现与接入说明](handoff/人员3_界面与集成/IMPLEMENTATION.md)：本轮新增交接，五个角色按文中标记阅读。
- [人员3开发自测](reports/person3/verification.md)：总控、人员3、人员4必读；不是独立审计结论。
- [人员4独立材料核验入口](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md)及 [人员4本机工作状态](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/STATUS.md)：总控、人员2、人员4必读，人员1核对来源参考；复算脚本会覆盖其参考JSON，先读运行说明。

题包说明提到的清洗数据、官方统计真值和复现脚本没有实际随包提供。团队样例与人员4独立参考均不能冒充官方真值。

每次交接记录 **成果路径、实际commit、已通过检查、遗留问题、下一角色接手事项**。原始数据权利归属不变，仓库不额外授予原始材料许可；密钥和本地项目导出文件不提交。历史占位目录及提交记录保留，原始数据统一在 `data/raw/`，历史本机目录 `data_raw/` 继续忽略。
