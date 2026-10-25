# 交接必读总索引

> **接口进度必读。** 每次接手或决定下一步，先查[逐接口状态索引](status/README.md)，再读自己及直接依赖的负责人分支报告与实现commit。该入口分别记录实现、自测、真实联调与独立审计；不以缺报告推断别的电脑没有开发。

**本页是统一阅读清单。所有角色先完成共同必读，再完成自己的角色必读。** 返回 [仓库首页](../README.md) 查看分支、已实现范围和证据版本。清单确定阅读与接手依赖，不替代用户的阶段授权或总控的接口决定。

<a id="common"></a>

## 共同必读【总控、人员1、2、3、4】

1. [仓库README](../README.md)：区分main文档入口、dev/app应用代码及固定受测提交。
2. [根协作规则](../AGENTS.md)：所有权、数据只读、密钥和真实AI要求。
3. [00 共同上下文](00_共同上下文.md)：目标、三域口径和职责依赖。
4. [01 公共接口](01_公共接口.md)：v1设计和六个共同对象；实现细节与待决定事项另行核对。
5. [02 协作与提交规则](02_协作与提交规则.md)：分支、交接格式和角色边界。
6. [03 总体验收标准](03_总体验收标准.md)：产品硬验收与独立审计。
7. [04 初始交接包核验](04_交接包核验.md)：历史材料检查的证据范围。
8. 自己目录的四份基础文件：START_HERE.md → TASK.md → DELIVERABLES.md → STATUS_TEMPLATE.md，再读以下本轮新增交接。

**阶段规则：**“首轮只读”适用于尚未明确进入下一阶段的新角色。人员3已进入开发；人员4已有针对初始材料的独立核验。每个角色按自己的实际授权汇报，不能照抄“尚未开发”，也不能仅凭此文自动开始其他角色的开发。

<a id="control"></a>

## 总控必读

- [本角色入口](总控/START_HERE.md) 及其中四份基础文件。
- [待决定接口](人员3_界面与集成/IMPLEMENTATION.md#pending)、[下一角色接手](人员3_界面与集成/IMPLEMENTATION.md#next)：需决定默认范围钩子、模型结果与指标映射、通用CSV确认流程；当前均未自动批准。
- [人员3自测及未验证项](../reports/person3/verification.md)、[验收矩阵](../acceptance/cases.md)、[人员4材料核验](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md)：核对受测版本，明确人员1/2模块commit、集成顺序和复验版本。

<a id="person1"></a>

## 人员1必读

- [本角色入口](人员1_数据与来源/START_HERE.md) 及其中四份基础文件。
- 实现交接 [第1节入口](人员3_界面与集成/IMPLEMENTATION.md#delivered)、[第2节数据接入](人员3_界面与集成/IMPLEMENTATION.md#data)、[第4节项目校验](人员3_界面与集成/IMPLEMENTATION.md#runtime)、[第5节待决定接口](人员3_界面与集成/IMPLEMENTATION.md#pending)。
- [已实现共享类型](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/index.ts) 与 [固定MOCK样例](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/example.ts)：核对importFiles、源字节、CSV记录索引及全项目校验，不能另造同名类型。
- [数据说明](../data/README.md)、[manifest](../data/manifest.json)、[D1来源字段](../data/sources/D1_居民收支_来源与字段.md)、[D2来源字段](../data/sources/D2_企业财务_来源与字段.md)、[D3来源字段](../data/sources/D3_汽车行业_来源与字段.md)、[CSV边界样例](../acceptance/fixtures/README.md)。
- [独立核验的来源参考及记录编号说明](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md)。交付实际导入证据；原字节重解析通过不等于三域业务适配通过。

<a id="person2"></a>

## 人员2必读

- [本角色入口](人员2_统计与AI/START_HERE.md) 及其中四份基础文件。
- 实现交接 [第1节入口](人员3_界面与集成/IMPLEMENTATION.md#delivered)、[第3节统计及服务接入](人员3_界面与集成/IMPLEMENTATION.md#analysis)、[第4节运行约定](人员3_界面与集成/IMPLEMENTATION.md#runtime)、[第5节待决定接口](人员3_界面与集成/IMPLEMENTATION.md#pending)。
- [已实现共享类型](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/index.ts)、[固定MOCK样例](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/example.ts)、[数据口径](../data/README.md)、[样例说明](../acceptance/fixtures/README.md) 与 [固定预期](../acceptance/fixtures/expected.json)。
- [验收矩阵](../acceptance/cases.md) 的统计和真实AI要求、[独立参考与复算说明](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md)。交付analyze、buildFacts、本机服务及三域真实API证据；固定样例和伪响应不能计作真实调用成功。

<a id="person3"></a>

## 人员3必读

- [本角色入口](人员3_界面与集成/START_HERE.md) 及其中四份基础文件。
- [实现交接全文](人员3_界面与集成/IMPLEMENTATION.md)、[开发自测](../reports/person3/verification.md)、[验收矩阵](../acceptance/cases.md)、[数据与来源说明](../data/README.md)。
- [共享类型](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/index.ts)、[模块接线](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/app/modules.ts)、[图谱与回源](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/graph/index.ts)、[保存恢复](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/storage/index.ts)、[锁文件](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/package-lock.json)。
- 接入人员1/2前取得模块commit和总控接口决定；新增依赖统一更新锁文件；提供集成后的新commit给人员4，不沿用旧版本的通过结论。

<a id="person4"></a>

## 人员4必读

- [本角色入口](人员4_独立审计/START_HERE.md) 及其中四份基础文件。
- 实现交接 [第4节运行与恢复](人员3_界面与集成/IMPLEMENTATION.md#runtime)、[第5节未定接口](人员3_界面与集成/IMPLEMENTATION.md#pending)、[第6节接手条件](人员3_界面与集成/IMPLEMENTATION.md#next)，以及 [人员3开发自测](../reports/person3/verification.md)。
- [总体验收标准](03_总体验收标准.md)、[验收矩阵](../acceptance/cases.md)、[样例说明](../acceptance/fixtures/README.md)、[固定预期](../acceptance/fixtures/expected.json)、[数据说明](../data/README.md) 与 [manifest](../data/manifest.json)。
- [已有独立材料核验](https://github.com/ynugyz/Gittrae/blob/1f48917a6dfdd2b7ae988d445ed138428a6ab663/acceptance/reports/README.md)：受测基线是472d151，参考编号不是产品recordId。复算脚本会覆盖参考JSON，先读说明；应用审计需另建绑定实际集成commit的报告。

## 交接签收时必须写清

使用本角色状态模板，填写已读资料、实际分支与完整commit、实现入口、实际检查及证据、尚未解决事项、下一角色接手条件。代码链接固定到已测39c92f1，材料审计链接固定到1f48917；文档同步提交不代表应用重新测试或审计通过。
