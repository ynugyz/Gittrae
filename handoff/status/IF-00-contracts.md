# IF-00 · 公共契约与接线约定

必做；负责人：人员3，总控审批语义变更。报告人：本机人员3，2026-10-25T15:40:01+08:00；来源分支dev/app。依据 [v1.0](../01_公共接口.md) 及 [总控汇报规则](../decisions/2026-10-25-interface-reporting.md)，本轮无新增产品接口批准。

实现：`39c92f147dc1ff81e0bdaf9f4190b81051a74cbd`，[类型](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/index.ts)、[样例](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/contracts/example.ts)、[接线](https://github.com/ynugyz/Gittrae/blob/39c92f147dc1ff81e0bdaf9f4190b81051a74cbd/src/app/modules.ts)。本轮复跑commit `197d6b2478e5666eef2dd241a4bd1a0443fce435`，产品文件一致；[自测证据](../../reports/person3/verification.md#handoff-recheck)。

| 阶段 | 状态与证据 |
|---|---|
| 实现 | in_progress：人员3公共类型、样例及页面接线已交付，跨模块兼容尚未完成 |
| 本机自测 | passed：20项测试、构建、格式检查；覆盖为人员3模块，非上游联调 |
| 真实联调 | blocked：下述可复查差异尚未对齐 |
| 人员4产品复验 | not_started：尚无相容的集成commit |

## 已取得的上游与差异（本轮仅静态核对）

| 来源 | 远程实现commit / 作者证据 | 当前接入障碍 |
|---|---|---|
| 人员1 | `2781eca3a7ca05543330a91697c0fb02d93243aa`；[作者报告](https://github.com/ynugyz/Gittrae/blob/2781eca3a7ca05543330a91697c0fb02d93243aa/src/data/REPORT.md) 声称54项通过、58/58覆盖；本机未复跑 | `importFiles.ts`接收name/bytes，页面检测index.ts并传File[]；originalName/parseOptions、可空unit、affectedFields等与共享类型不同，仍有types.ts镜像 |
| 人员2 | `8dff711eac824fb7acedeca9f9c0c301c9fe52fa`；[作者报告](https://github.com/ynugyz/Gittrae/blob/8dff711eac824fb7acedeca9f9c0c301c9fe52fa/reports/人员2_交付与复验.md) 记录18项自测和API/HTTP探通；本机未复跑。远程文档提交为8dff711，报告绑定成果commit `d72ab3f7a98d88f2f0904d6241729af7e85bd4d5` | 入口index.mjs/server/index.mjs未被.ts接线识别；ids.mjs依赖node:crypto；scope.selectedRecordIds/labels、对象型ref、reason/validCount及methodVersion与当前校验不符；数据集节点已改为优先复用，指标节点ID和须线样本覆盖仍需对齐 |

默认范围钩子、AI resultId到fieldId映射、通用CSV角色/单位确认仍待决定；本次汇报规则没有批准这些变更。上游已有代码，不能继续写“未开发/未交付”，也不能将作者自测变成人员3或审计已验证。

## 最小下一步

总控先裁决上述字段、ID和浏览器/服务端边界；人员1/2按决定对齐模块，人员3更新唯一共享类型、样例与接线。相容模块commit齐备后，人员3执行三域联调，再交人员4按 [验收矩阵](../../acceptance/cases.md) 复验。当前不直接合入不相容业务模块；独立自测可继续，签收暂缓。
