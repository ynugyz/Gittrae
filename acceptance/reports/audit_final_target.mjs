// 最终冻结前专项：修复空值回源、新D2模型记录、三域项目往返；不重跑已验矩阵。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(process.argv[2]),dir=path.dirname(fileURLToPath(import.meta.url));
const load=p=>import(pathToFileURL(path.join(root,p)).href);
const data=await load('src/data/index.ts'),analysis=await load('src/analysis/index.mjs'),storage=await load('src/storage/index.ts'),graph=await load('src/graph/index.ts'),state=await load('src/app/state.ts'),api=await load('src/app/api.ts');
const commit=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const priorFile='2026-10-25_product-integrated-33c3438-D3-retry.json',prior=JSON.parse(fs.readFileSync(path.join(dir,priorFile),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/manifest.json'),'utf8'));
const out={kind:'targeted_final_independent_recheck_not_browser',generatedAt:new Date().toISOString(),testedCommit:commit,dataFingerprint:manifest.packageFingerprintSha256,checks:[],liveAi:[],priorEvidence:priorFile};
async function check(id,fn){try{const detail=await fn();out.checks.push({id,status:'passed',detail});}catch(e){out.checks.push({id,status:'failed',error:e.message});}}
const bundles=await data.importFiles(manifest.files.map(f=>new File([fs.readFileSync(path.join(root,f.relativePath))],path.basename(f.relativePath))),{});
const d1=bundles.find(b=>b.domain==='D1'),d2=bundles.find(b=>b.domain==='D2'),d3=bundles.find(b=>b.adapterType==='gasgoo-ranking'&&b.fields.some(f=>f.fieldId==='vendor'));
const chosen=[d1,d2,d3],analyses=chosen.map(b=>analysis.analyze(b,data.getDefaultRequest(b))),facts=analyses.flatMap(a=>analysis.buildFacts(a).insights);
const a2=analyses[1];
let project={...state.emptyProject(),datasets:chosen,analyses,insights:facts,selection:{datasetId:d2.datasetId,analysisId:a2.analysisId,measureFieldIds:a2.request.measureFieldIds,nodeId:null}};
await check('CLOSE-05:fixed-original-empty-cell',()=>{
  assert.equal(d2.adapterVersion,'1.0.1');
  const result=a2.results.find(r=>r.metric==='mean'&&r.fieldIds[0]==='revenue'),e=graph.getEvidence(project,result.resultId);
  const row=e.excludedRecords.find(r=>r.recordId==='rec:d2:FY2025:688759');assert.ok(row);const c=row.cells.find(c=>c.fieldId==='revenue');assert.equal(c.value,null);assert.equal(c.sources.length,1);
  const s=c.sources[0];assert.equal(s.recordIndex,2755);assert.equal(s.columnIndex,4);assert.equal(s.rawValue,'');assert.equal(row.exclusionReason,'missing_value');
  assert.equal(result.validRecordIds.length,5227);assert.equal(a2.scope.recordIds.length,5228);
  const old=prior.domains.find(d=>d.domain==='D2');assert.notEqual(a2.datasetVersion,old.datasetVersion);
  return {adapterVersion:d2.adapterVersion,datasetVersion:d2.datasetVersion,analysisId:a2.analysisId,recordId:row.recordId,recordIndex:s.recordIndex,columnIndex:s.columnIndex,rawValue:s.rawValue,sha256:s.sha256,exclusionReason:row.exclusionReason,nullRetained:true};
});
await check('unchanged-D1-D3-real-evidence-still-matches',()=>{
  for(const a of [analyses[0],analyses[2]]){const old=prior.liveAi.find(r=>r.analysisId===a.analysisId);assert.ok(old);for(const i of old.insights)graph.validateInsight(i,a);out.liveAi.push(old);}
  return {unchangedAnalysisIds:[analyses[0].analysisId,analyses[2].analysisId],newCalls:0};
});
const realFetch=globalThis.fetch;let modelRequests=0;
globalThis.fetch=(url,init)=>{if(typeof url==='string'&&url.startsWith('/api/')){if(url==='/api/insights')modelRequests++;return realFetch('http://127.0.0.1:8787'+url,init);}return realFetch(url,init);};
await check('new-D2-version-real-AI',async()=>{
  const response=await api.requestInsights(d2,a2,new AbortController().signal);
  assert.equal(response.analysisId,a2.analysisId);for(const i of response.insights)graph.validateInsight(i,a2);
  const r={domain:'D2',analysisId:response.analysisId,requestId:response.requestId,model:response.model,generatedAt:response.generatedAt,insights:response.insights};out.liveAi.push(r);
  const wording=response.insights.filter(i=>/榜单/.test(i.textTemplate));assert.equal(wording.length,0,'D2 should be company sample, not ranking');
  return {analysisId:response.analysisId,requestId:response.requestId,model:response.model,generatedAt:response.generatedAt,insights:response.insights.length};
});
globalThis.fetch=realFetch;
if(out.liveAi.length===3)await check('final-three-domain-clear-restore-and-tamper-rejection',async()=>{
  const currentAi=out.liveAi.flatMap(r=>r.insights);project={...project,insights:[...facts,...currentAi],selection:{...project.selection,nodeId:`finding:${out.liveAi.find(r=>r.domain==='D2').insights[0].insightId}`}};
  const saved=structuredClone(project);let duringRestore=0;globalThis.fetch=async()=>{duringRestore++;throw new Error('restore must not call network');};
  try{const json=await storage.exportProject(project);project=state.emptyProject();assert.equal(project.datasets.length,0);project=await storage.importProject(json);assert.deepEqual(project,saved);assert.equal(duringRestore,0);assert.ok(graph.rebuildGraph(project).nodes.some(n=>n.id===saved.selection.nodeId));
    const bad=JSON.parse(json);bad.datasets[0].sources[0].rawRecords[0][1]='CACHE_TAMPERED';await assert.rejects(storage.importProject(JSON.stringify(bad)));assert.ok(!/DEEPSEEK_API_KEY|Authorization|"apiKey"/.test(json));
    return {jsonBytes:Buffer.byteLength(json),datasets:project.datasets.length,analysisIds:project.analyses.map(a=>a.analysisId),historicalAiCount:currentAi.length,selectedFinding:project.selection.nodeId,modelCallsThisRun:modelRequests,modelRequestsDuringRestore:duringRestore,tamperedCacheRejected:true,stableIdsAndRawBytes:true};
  }finally{globalThis.fetch=realFetch;}
});
out.summary={passed:out.checks.filter(c=>c.status==='passed').length,failed:out.checks.filter(c=>c.status==='failed').length};
fs.writeFileSync(path.join(dir,'2026-10-25_final-targeted.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({testedCommit:commit,summary:out.summary,checks:out.checks},null,2));process.exitCode=out.summary.failed?1:0;
