# T3 数据洞察官 · Gittrae

三类经济数据的统计、三图、信息网络、数字回源、真实DeepSeek解读和本地项目保存恢复。

**全员必读：** [协作规则](AGENTS.md) → [共同及角色阅读入口](handoff/README.md) → [接口进度](handoff/status/README.md)。开始下一步前，核对负责人分支的报告、代码commit和直接依赖；缺报告只记未确认。

## 当前交接

- **人员3入口：** [本机进度与接手事项](handoff/人员3_界面与集成/START_HERE.md)。接口进度只维护在IF-00、04～08，技术调用见 [接入说明](handoff/人员3_界面与集成/IMPLEMENTATION.md)。
- **本轮正式决定：** [总控40分钟收尾决定（db28c7c）](https://github.com/ynugyz/Gittrae/blob/db28c7cd6a23dfb45ded717baaf2e803b7f42145/handoff/decisions/2026-10-25-final-40-minutes.md)。默认范围钩子、Node分析路由和AI指标映射按此执行。
- 当前集成版本、实际检查与阻塞只看 [IF-00](handoff/status/IF-00-contracts.md)；页面真实AI证据看 [IF-08](handoff/status/IF-08-live-insights.md)。HTTP探通或健康检查不能替代三域应用验收。
- `main` 提供交接资料；运行与复验使用 [dev/app](https://github.com/ynugyz/Gittrae/tree/dev/app) 中接口卡指定的完整commit。

## 角色必读入口

| 角色 | 从这里开始 |
|---|---|
| 总控 | [总控入口](handoff/总控/START_HERE.md) |
| 人员1：数据与来源 | [人员1入口](handoff/人员1_数据与来源/START_HERE.md) |
| 人员2：统计与AI | [人员2入口](handoff/人员2_统计与AI/START_HERE.md) |
| 人员3：界面与集成 | [精简交接](handoff/人员3_界面与集成/START_HERE.md) |
| 人员4：独立审计 | [人员4入口](handoff/人员4_独立审计/START_HERE.md) |

新角色未获后续任务时先只读核对；已授权的开发或审计继续原任务，按真实阶段汇报。

## 本机运行【开发与复验前必读】

在含应用代码的dev/app，使用Node.js 22.12+，从仓库根目录执行 `npm ci`、`npm run dev`，打开 http://127.0.0.1:5173 。统计和真实AI使用同机服务；入口及端口见 [接入说明](handoff/人员3_界面与集成/IMPLEMENTATION.md#runtime)。MOCK样例始终单独标注。

## 数据与验收【全员必读】

[数据来源](data/README.md) · [58份CSV清单](data/manifest.json) · [产品验收矩阵](acceptance/cases.md) · [团队样例](acceptance/fixtures/README.md) · [人员4材料审计](acceptance/reports/STATUS.md)。

三域真实完整流程、真实AI、回源及保存恢复仍为硬验收；开发自测和基线材料核验不等于集成产品通过。原始CSV保持字节不变；缺失值不填零、相关不等于因果。官方清洗数据与统计真值未随包提供；原始材料权利归属不变。密钥仅留本机服务端，不上传仓库或项目文件。
