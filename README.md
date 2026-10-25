# T3 数据洞察官 · Gittrae

三类经济数据的统计、三图、信息网络、数字回源、真实DeepSeek解读和本地项目保存恢复。

**全员必读：** [协作规则](AGENTS.md) → [共同及角色阅读入口](handoff/README.md) → [接口进度](handoff/status/README.md)。开始下一步前，核对负责人分支的报告、代码commit和直接依赖；缺报告只记未确认。

## 当前交接

- **人员3入口：** [本机进度与接手事项](handoff/人员3_界面与集成/START_HERE.md)。接口进度只维护在IF-00、04～08，技术调用见 [接入说明](handoff/人员3_界面与集成/IMPLEMENTATION.md)。
- 人员3代码为 [39c92f1](https://github.com/ynugyz/Gittrae/tree/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd)；本轮在197d6b2复跑20项测试、构建与格式检查通过，产品文件一致。详见 [自测记录](reports/person3/verification.md#handoff-recheck)。
- 人员1、2均已远程交付；入口、运行环境和部分结构不兼容，**尚未接入人员3页面**。差异与准确版本集中在 [IF-00](handoff/status/IF-00-contracts.md)。人员2的API探通报告不能替代三域应用验收。
- `main` 提供交接资料；运行应用使用 [dev/app](https://github.com/ynugyz/Gittrae/tree/dev/app)。本轮只改文档，未把业务代码合入main，未批准新业务契约。

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

在含应用代码的dev/app，使用Node.js 22.12+，从仓库根目录执行 `npm ci`、`npm run dev`，打开 http://127.0.0.1:5173 。当前可体验明确标注MOCK的联调样例。模块入口及端口见 [接入说明](handoff/人员3_界面与集成/IMPLEMENTATION.md#runtime)。

## 数据与验收【全员必读】

[数据来源](data/README.md) · [58份CSV清单](data/manifest.json) · [产品验收矩阵](acceptance/cases.md) · [团队样例](acceptance/fixtures/README.md) · [人员4材料审计](acceptance/reports/STATUS.md)。

三域真实完整流程、真实AI、回源及保存恢复仍为硬验收；开发自测和基线材料核验不等于集成产品通过。原始CSV保持字节不变；缺失值不填零、相关不等于因果。官方清洗数据与统计真值未随包提供；原始材料权利归属不变。密钥仅留本机服务端，不上传仓库或项目文件。
