import type {
  AnalysisRequest,
  AnalysisResult,
  DatasetBundle,
  FactsOutput,
  ImportOptions,
} from "../contracts";

// 接入点只有这两处；模块缺失时返回明确状态，不伪造数据或计算结果。
interface DataModule {
  importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>;
  getDefaultRequest?: (bundle: DatasetBundle) => AnalysisRequest;
}
interface AnalysisModule {
  analyze(bundle: DatasetBundle, request: AnalysisRequest): AnalysisResult;
  buildFacts(analysis: AnalysisResult): FactsOutput;
}
const dataModules = import.meta.glob("../data/index.ts", {
  eager: true,
}) as Record<string, DataModule>;
const analysisModules = import.meta.glob("../analysis/index.ts", {
  eager: true,
}) as Record<string, AnalysisModule>;
export const dataModule = dataModules["../data/index.ts"];
export const analysisModule = analysisModules["../analysis/index.ts"];
export const moduleStatus = {
  data: typeof dataModule?.importFiles === "function",
  analysis:
    typeof analysisModule?.analyze === "function" &&
    typeof analysisModule?.buildFacts === "function",
};
