// Vite 接入点：人员3 的 src/app/modules.ts 只发现 src/analysis/index.ts。
// 运行时实现保持 .mjs，便于用 node 直接运行自测；这里只补共享类型签名。
import type {
  AnalysisRequest,
  AnalysisResult,
  DatasetBundle,
  FactsOutput,
} from "../contracts";
// @ts-expect-error 纯 JS 运行时实现，暂无声明文件
import { AnalysisError, analyze as analyzeImpl } from "./analyze.mjs";
// @ts-expect-error 纯 JS 运行时实现，暂无声明文件
import { buildFacts as buildFactsImpl } from "./facts.mjs";

export function analyze(
  bundle: DatasetBundle,
  request: AnalysisRequest,
): AnalysisResult {
  return analyzeImpl(bundle, request) as AnalysisResult;
}

export function buildFacts(analysis: AnalysisResult): FactsOutput {
  return buildFactsImpl(analysis) as FactsOutput;
}

export { AnalysisError };
