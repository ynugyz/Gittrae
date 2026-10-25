# 交接必读入口

[返回仓库首页](../README.md)。进度统一读 [接口状态索引](status/README.md)，不在多份角色模板重复填报。

<a id="common"></a>

## 共同必读

[AGENTS](../AGENTS.md) → [00 共同上下文](00_共同上下文.md) → [01 公共接口](01_公共接口.md) → [02 协作规则](02_协作与提交规则.md) → [03 验收标准](03_总体验收标准.md) → [04 初始资料核验](04_交接包核验.md)。初始资料记录是历史证据，当前阶段以角色报告为准。

<a id="control"></a>

## 总控必读

[角色入口](总控/START_HERE.md)及其中基础文件；[接口状态](status/README.md)、[IF-00待裁决差异](status/IF-00-contracts.md)、[人员3接手事项](人员3_界面与集成/START_HERE.md)、[人员4审计](../acceptance/reports/STATUS.md)。

<a id="person1"></a>

## 人员1必读

[角色入口](人员1_数据与来源/START_HERE.md)及其中四份基础文件；[数据接入](人员3_界面与集成/IMPLEMENTATION.md#data)、[IF-00](status/IF-00-contracts.md)、[IF-01](status/IF-01-import-files.md)、[数据及三域来源](../data/README.md)、[样例](../acceptance/fixtures/README.md)。

<a id="person2"></a>

## 人员2必读

[角色入口](人员2_统计与AI/START_HERE.md)及其中四份基础文件；[统计与服务接入](人员3_界面与集成/IMPLEMENTATION.md#analysis)、[IF-00](status/IF-00-contracts.md)、[IF-02](status/IF-02-analyze.md)、[IF-03](status/IF-03-build-facts.md)、[IF-08](status/IF-08-live-insights.md)、[固定预期](../acceptance/fixtures/expected.json)。

<a id="person3"></a>

## 人员3必读

[精简交接](人员3_界面与集成/START_HERE.md) → [接入说明](人员3_界面与集成/IMPLEMENTATION.md) → 自己负责的 [IF-00](status/IF-00-contracts.md)、[04](status/IF-04-merge-graph.md)、[05](status/IF-05-get-evidence.md)、[06](status/IF-06-export-project.md)、[07](status/IF-07-import-project.md)、[08客户端](status/IF-08-live-insights.md)。原TASK、DELIVERABLES、STATUS_TEMPLATE已合并到入口与接口卡，不再单独维护。

<a id="person4"></a>

## 人员4必读

[角色入口](人员4_独立审计/START_HERE.md)及其中四份基础文件；[运行与恢复](人员3_界面与集成/IMPLEMENTATION.md#runtime)、[人员3自测](../reports/person3/verification.md)、[验收矩阵](../acceptance/cases.md)、[数据清单](../data/manifest.json)、[已有审计](../acceptance/reports/STATUS.md)。在新集成commit复验后另记结论。
