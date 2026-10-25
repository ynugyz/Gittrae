import type {
  AnalysisRequest,
  DatasetBundle,
  ImportOptions,
} from "../contracts";

// 数据在浏览器导入；统计统一通过本机 /api/analyze，模块缺失不伪造结果。
interface DataModule {
  importFiles(files: File[], options: ImportOptions): Promise<DatasetBundle[]>;
  getDefaultRequest?: (bundle: DatasetBundle) => AnalysisRequest;
}
const dataModules = import.meta.glob("../data/index.ts", {
  eager: true,
}) as Record<string, DataModule>;
export const dataModule = dataModules["../data/index.ts"];
export const moduleStatus = {
  data: typeof dataModule?.importFiles === "function",
};
