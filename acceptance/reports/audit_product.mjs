// 独立产品检查；只读取开发提交与既有参考，结果只写 acceptance/reports。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const reportDir = path.dirname(fileURLToPath(import.meta.url));
const [dataRoot, analysisRoot = dataRoot, appRoot, tag = 'split'] = process.argv.slice(2).map((v, i) => i < 3 ? path.resolve(v) : v);
if (!dataRoot) throw new Error('需要固定受测工作区路径');
const load = async (root, relative) => import(pathToFileURL(path.join(root, relative)).href);
const commit = root => execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const wrapper = fs.existsSync(path.join(dataRoot, 'src/data/index.ts'));
const data = await load(dataRoot, wrapper ? 'src/data/index.ts' : 'src/data/importFiles.ts');
const { analyze, buildFacts } = await load(analysisRoot, 'src/analysis/index.mjs');
const reference = JSON.parse(fs.readFileSync(path.join(reportDir, '2026-10-25_472d151_reference.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, 'data/manifest.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(dataRoot, 'acceptance/fixtures/expected.json'), 'utf8'));
const out = { generatedAt: new Date().toISOString(), kind: 'independent_product_module_check_not_ui_or_live_ai', commits: { data: commit(dataRoot), analysis: commit(analysisRoot), app: appRoot ? commit(appRoot) : null }, packageFingerprintSha256: manifest.packageFingerprintSha256, checks: [], domains: [], unexecuted: ['browser UI', 'page live AI', 'page scope race', 'UI chart clicks'] };
const close = (a, b, tiny = false) => {
  if (b === null) return assert.equal(a, null);
  assert.equal(typeof a, 'number');
  assert.ok(Math.abs(a - b) <= (tiny ? 1e-9 : Math.max(1e-6, Math.abs(b) * 1e-9)), `actual=${a}, expected=${b}`);
};
async function check(id, fn) {
  try { const detail = await fn(); out.checks.push({ id, status: 'passed', ...(detail ? { detail } : {}) }); }
  catch (e) { out.checks.push({ id, status: 'failed', error: e.message }); }
}
function input(relative) {
  const full = path.join(dataRoot, relative), bytes = new Uint8Array(fs.readFileSync(full)), name = path.basename(full);
  return wrapper ? new File([bytes], name, { type: 'text/csv' }) : { name, bytes };
}
const request = (b, measures, filters = [], pair = measures.length > 1 ? measures.slice(0, 2) : null) => ({ datasetId: b.datasetId, datasetVersion: b.datasetVersion, measureFieldIds: measures, correlationPair: pair, filters });
const result = (a, metric, fieldId) => a.results.find(r => r.metric === metric && (!fieldId || r.fieldIds[0] === fieldId));
const importStarted = performance.now();
let bundles = [];
await check('IMP-01:58-real-files', async () => {
  bundles = await data.importFiles(manifest.files.map(f => input(f.relativePath)), {});
  const sources = new Map(bundles.flatMap(b => b.sources).map(s => [s.sha256, s]));
  for (const f of manifest.files) { const source = sources.get(f.sha256); assert.ok(source, f.relativePath); assert.equal(source.rawRecords.length, f.parsedRecordCount); assert.deepEqual(source.headers, f.columns); }
  return { sourceFiles: sources.size, bundles: bundles.length, elapsedMs: Math.round(performance.now() - importStarted) };
});
out.provenanceGaps=bundles.map(b=>{
  const transformed=new Set(b.transformations.flatMap(t=>t.fieldIds??[])); const missing={};
  for(const r of b.records) for(const f of b.fields) if(r.values[f.fieldId]!==null && !r.provenance[f.fieldId]?.length && !transformed.has(f.fieldId)) missing[f.fieldId]=(missing[f.fieldId]??0)+1;
  return {datasetId:b.datasetId,missing};
}).filter(b=>Object.keys(b.missing).length);

for (const name of ['basic.csv', 'missing_constant.csv', 'single.csv', 'all_missing.csv']) {
  await check(`STAT:fixture:${name}`, async () => {
    const options = wrapper ? { fieldRoles: { value: 'measure' } } : { fieldOverrides: { value: { role: 'measure' } } };
    const [b] = await data.importFiles([input(`acceptance/fixtures/${name}`)], options);
    const fields = b.fields.filter(f => f.role === 'measure');
    assert.ok(fields.length > 0, '没有数值字段');
    const a = analyze(b, request(b, fields.map(f => f.fieldId)));
    for (const field of fields) {
      const wanted = expected[name][field.label]; if (!wanted) continue;
      for (const [metric, key] of [['mean','mean'],['median','median'],['stddev','std'],['q1','q1'],['q3','q3']]) {
        if (key in wanted) close(result(a, metric, field.fieldId)?.value, wanted[key], true);
      }
      assert.equal(result(a, 'mean', field.fieldId).validRecordIds.length, wanted.count);
      if (wanted.histogram) {
        const h = a.chartData.histograms.find(h => h.fieldId === field.fieldId);
        assert.deepEqual(h.counts, wanted.histogram.counts);
        assert.equal(h.edges.length, wanted.histogram.edges.length);
        h.edges.forEach((e,i) => close(e, wanted.histogram.edges[i], true));
        assert.deepEqual(h.binRecordIds.map(ids => ids.length), h.counts);
      }
      if(wanted.whiskers) {close(result(a,'low',field.fieldId).value,wanted.whiskers[0],true);close(result(a,'high',field.fieldId).value,wanted.whiskers[1],true);}
    }
    const xy = fields.filter(f => ['x', 'y'].includes(f.label));
    const correlation = expected[name].correlation ?? expected[name].correlations?.[0];
    if (xy.length === 2 && correlation) {
      const c = result(analyze(b, request(b, xy.map(f => f.fieldId))), 'pearson');
      close(c.value, correlation.value, true); assert.equal(c.validRecordIds.length, correlation.pairCount);
    }
    if (name === 'missing_constant.csv') {
      const ids = ['x', 'constant'].map(label => fields.find(f => f.label === label).fieldId);
      assert.equal(result(analyze(b, request(b, ids)), 'pearson').value, null);
    }
    return { analysisId: a.analysisId, samples: a.scope.recordIds.length };
  });
}

const d1 = bundles.find(b => b.domain === 'D1');
const d2 = bundles.find(b => b.domain === 'D2');
const d3 = bundles.find(b => b.adapterType === 'gasgoo-ranking' && b.fields.some(f => f.fieldId === 'vendor'));
const specs = [
  { name: 'D1', bundle: d1, fields: ['income_all','expend_all'], filter: { fieldId: 'year', operator: 'eq', values: [2024] } },
  { name: 'D2', bundle: d2, fields: ['revenue','net_profit'], filter: { fieldId: 'report_period', operator: 'eq', values: ['FY2025'] } },
  { name: 'D3', bundle: d3, fields: ['month_sales','yoy'], filter: { fieldId: 'year_month', operator: 'eq', values: ['2026-08'] } },
];
const analyses = [], insights = [];
for (const s of specs) await check(`${s.name}:real-statistics-charts-source`, async () => {
  assert.ok(s.bundle, '缺少数据域Bundle');
  const a = analyze(s.bundle, request(s.bundle, s.fields, [s.filter]));
  const f = buildFacts(a); analyses.push(a); insights.push(...f.insights);
  const compare = (fieldId, wanted) => {
    assert.equal(result(a,'mean',fieldId).validRecordIds.length, wanted.count);
    for (const [metric,key] of [['mean','mean'],['median','median'],['stddev','std'],['q1','q1'],['q3','q3']]) close(result(a,metric,fieldId).value, wanted[key]);
    close(result(a,'low',fieldId).value,wanted.whiskers[0]);close(result(a,'high',fieldId).value,wanted.whiskers[1]);
    const h = a.chartData.histograms.find(h => h.fieldId === fieldId);
    assert.deepEqual(h.counts, wanted.histogram.counts); assert.deepEqual(h.binRecordIds.map(ids => ids.length), h.counts);
    h.edges.forEach((e,i) => close(e,wanted.histogram.edges[i]));
  };
  if (s.name === 'D1') {
    for (const [fid,part] of [['income_all','_income__全体'],['expend_all','_expend__全体']]) compare(fid,Object.entries(reference.realDataReferences).find(([k]) => k.includes(part))[1].statistics);
    close(result(a,'pearson').value, reference.realDataReferences.D1_2024_income_expenditure_pair.correlation.value);
    assert.equal(a.scope.recordIds.length,31);
  } else if (s.name === 'D2') {
    const ref=Object.entries(reference.realDataReferences).find(([k])=>k.includes('EM_yjbb_FY2025'))[1];
    compare('revenue',ref.statistics['营业总收入-营业总收入']); compare('net_profit',ref.statistics['净利润-净利润']);
    close(result(a,'pearson').value,ref.correlation.value); assert.equal(result(a,'pearson').validRecordIds.length,ref.correlation.pairCount);
    const selected=s.bundle.records.filter(r=>r.values.report_period==='FY2025');
    assert.equal(selected.length,5228); assert.equal(selected.filter(r=>r.values.industry===null).length,1); assert.equal(selected.filter(r=>r.values.net_profit<0).length,ref.negativeProfitCount);
    assert.ok(selected.some(r=>/^0/.test(r.values.code)));
  } else {
    const ref=Object.entries(reference.realDataReferences).find(([k])=>k.includes('GASGOO_rank_firm_202608'))[1]; compare('month_sales',ref.statistics); assert.equal(a.scope.recordIds.length,50);
    assert.equal(s.bundle.fields.find(f=>f.fieldId==='mom').analysisPolicy,'excluded');
    assert.throws(()=>analyze(s.bundle,request(s.bundle,['mom'],[s.filter],null)));
  }
  assert.equal(a.chartData.boxplots.length,2); assert.equal(a.chartData.scatter.points.length,result(a,'pearson').validRecordIds.length);
  assert.ok(f.insights.every(i=>i.resultRefs.every(id=>a.results.some(r=>r.resultId===id))));
  const records=new Map(s.bundle.records.map(r=>[r.recordId,r]));
  for(const h of a.chartData.histograms) {
    const seen=new Set();
    h.binRecordIds.forEach((ids,i)=>ids.forEach(id=>{assert.ok(!seen.has(id));seen.add(id);const v=records.get(id).values[h.fieldId];assert.ok(v>=h.edges[i]&&(i===h.counts.length-1?v<=h.edges[i+1]:v<h.edges[i+1]),'bin source record does not belong to interval');}));
    assert.deepEqual([...seen].sort(),[...result(a,'mean',h.fieldId).validRecordIds].sort());
  }
  for(const point of a.chartData.scatter.points) {const r=records.get(point.recordId);assert.equal(point.x,r.values[a.chartData.scatter.xFieldId]);assert.equal(point.y,r.values[a.chartData.scatter.yFieldId]);}
  for(const box of a.chartData.boxplots) {const low=a.results.find(r=>r.resultId===box.lowResultId).value,high=a.results.find(r=>r.resultId===box.highResultId).value;for(const p of box.outliers) {assert.equal(p.value,records.get(p.recordId).values[box.fieldId]);assert.ok(p.value<low||p.value>high);}}
  const trace=[];
  for (const fid of s.fields) {
    const r=records.get(result(a,'mean',fid).validRecordIds[0]); const ref=r.provenance[fid][0];
    const source=s.bundle.sources.find(src=>src.sourceId===ref.sourceId); const raw=source.rawRecords[ref.recordIndex-1][ref.columnIndex];
    close(Number(raw.trim().replace(/%$/,'')),r.values[fid]);
    trace.push({fieldId:fid,recordId:r.recordId,sourceId:source.sourceId,sha256:source.sha256,fileName:source.originalFileName,recordIndex:ref.recordIndex,columnIndex:ref.columnIndex,raw,value:r.values[fid]});
  }
  const summary={domain:s.name,datasetId:s.bundle.datasetId,datasetVersion:s.bundle.datasetVersion,analysisId:a.analysisId,scopeRecordCount:a.scope.recordIds.length,results:a.results.map(r=>({resultId:r.resultId,metric:r.metric,fieldIds:r.fieldIds,value:r.value,validCount:r.validRecordIds.length})),trace};
  out.domains.push(summary); return {analysisId:a.analysisId,scopeRecords:a.scope.recordIds.length};
});
if(d2) await check('D2:null-industry-filter-keeps-unknown-record',()=>{
  const a=analyze(d2,request(d2,['revenue','net_profit'],[{fieldId:'report_period',operator:'eq',values:['FY2025']},{fieldId:'industry',operator:'eq',values:[null]}]));
  assert.equal(a.scope.recordIds.length,1,'FY2025 has one actual unknown-industry record');
});

if (appRoot && analyses.length === 3) {
  const storage=await load(appRoot,'src/storage/index.ts'); const graph=await load(appRoot,'src/graph/index.ts');
  const state=await load(appRoot,'src/app/state.ts');
  const now=new Date().toISOString(); const project={schemaVersion:1,projectId:'audit-closeout-three-domains',createdAt:now,savedAt:now,datasets:specs.map(s=>s.bundle),analyses,insights,selection:{datasetId:analyses[2].datasetId,analysisId:analyses[2].analysisId,measureFieldIds:analyses[2].request.measureFieldIds,nodeId:`finding:${insights.at(-1).insightId}`}};
  for (const a of analyses) await check(`${a.request.filters[0].fieldId}:core-getEvidence`,()=>{
    const e=graph.getEvidence(project,a.results[0].resultId); assert.equal(e.analysisId,a.analysisId); assert.equal(e.validCount,a.results[0].validRecordIds.length); return {validCount:e.validCount};
  });
  const a=analyses[0],r=a.results[0];
  const simulated={insightId:'audit-simulated-insight',analysisId:a.analysisId,kind:'interpretation',origin:'live_ai',textTemplate:`参考 {{result:${r.resultId}}}；相关不等于因果。`,resultRefs:[r.resultId],generatedAt:now,model:'audit-simulated-model',status:'valid'};
  const synthetic={analysisId:a.analysisId,requestId:'audit-simulated-request',insights:[simulated],graph:graph.buildInsightGraph([simulated],[a]),model:simulated.model,generatedAt:now};
  await check('SIMULATED:unknown-reference-rejected',()=>{
    assert.throws(()=>graph.validateInsight({...simulated,resultRefs:[a.analysisId+':unknown'],textTemplate:`{{result:${a.analysisId}:unknown}}`},a));
  });
  await check('SIMULATED:foreign-analysis-reference-rejected',()=>{
    assert.throws(()=>graph.validateInsight({...simulated,resultRefs:[analyses[1].results[0].resultId],textTemplate:`{{result:${analyses[1].results[0].resultId}}}`},a));
  });
  await check('SIMULATED:stale-response-keeps-current-state',()=>{
    assert.equal(state.applyInsightResponse(project,synthetic),project);
  });
  for (const a of analyses) await check(`${a.request.filters[0].fieldId}:single-domain-export`,async()=>{
    const ownInsights=insights.filter(i=>i.analysisId===a.analysisId);
    const own={...project,datasets:project.datasets.filter(b=>b.datasetId===a.datasetId),analyses:[a],insights:ownInsights,selection:{datasetId:a.datasetId,analysisId:a.analysisId,measureFieldIds:a.request.measureFieldIds,nodeId:`finding:${ownInsights[0].insightId}`}};
    const json=await storage.exportProject(own); assert.deepEqual(await storage.importProject(json),own); return {bytes:Buffer.byteLength(json)};
  });
  await check('SAVE:three-domain-core-roundtrip',async()=>{
    const json=await storage.exportProject(project); const restored=await storage.importProject(json); assert.deepEqual(restored,project);
    assert.ok(!/DEEPSEEK_API_KEY|Authorization|"apiKey"/.test(json));
    assert.ok(graph.rebuildGraph(restored).nodes.some(n=>n.id===project.selection.nodeId));
    const bad=JSON.parse(json); bad.datasets[0].sources[0].rawRecords[0][1]='CACHE_TAMPERED'; await assert.rejects(storage.importProject(JSON.stringify(bad)));
    return {jsonBytes:Buffer.byteLength(json),restoredDatasets:restored.datasets.length,restoredAnalysisIds:restored.analyses.map(a=>a.analysisId),tamperedCacheRejected:true,liveAiRecords:0};
  });
  const api=await load(appRoot,'src/app/api.ts');
  const {createInsightsServer}=await load(analysisRoot,'server/insights.mjs');
  const realFetch=globalThis.fetch;
  const server=createInsightsServer({env:{},logger:{info(){},warn(){},error(){}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  globalThis.fetch=(url,init)=>realFetch(typeof url==='string'&&url.startsWith('/api/')?base+url:url,init);
  try {
    for (const a of analyses) await check(`${a.request.filters[0].fieldId}:real-local-HTTP-analyze`,async()=>{
      const b=project.datasets.find(b=>b.datasetId===a.datasetId);
      const r=await api.requestAnalysis(b,a.request,new AbortController().signal);
      assert.deepEqual(r.analysis,a); assert.ok(r.facts.insights.length>0); return {analysisId:r.analysis.analysisId,status:200};
    });
    await check('HTTP:version-mismatch-rejected',async()=>{
      const a=analyses[0],b=project.datasets[0];
      const res=await realFetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bundle:b,request:{...a.request,datasetVersion:'wrong-version'}})});
      const body=await res.json(); assert.equal(res.status,400); assert.equal(body.error.code,'dataset_version_mismatch');
    });
    await check('HTTP:missing-key-explicit-error',async()=>{
      await assert.rejects(api.requestInsights(project.datasets[0],analyses[0],new AbortController().signal),/DEEPSEEK_API_KEY/);
    });
  } finally { globalThis.fetch=realFetch; await new Promise(resolve=>server.close(resolve)); }
  let mockContent={insights:[{textTemplate:simulated.textTemplate,resultRefs:simulated.resultRefs}]};
  const fake=createInsightsServer({env:{DEEPSEEK_API_KEY:'audit-simulated-placeholder',DEEPSEEK_MODEL:'audit-simulated-model'},logger:{info(){},warn(){},error(){}},fetchImpl:async()=>Response.json({model:'audit-simulated-model',choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockContent)}}]})});
  await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
  const fakeBase=`http://127.0.0.1:${fake.address().port}`;
  globalThis.fetch=(url,init)=>realFetch(typeof url==='string'&&url.startsWith('/api/')?fakeBase+url:url,init);
  try {
    await check('SIMULATED:valid-provider-shape-keeps-source-identity',async()=>{
      const response=await api.requestInsights(project.datasets[0],a,new AbortController().signal); assert.equal(response.insights[0].origin,'live_ai'); assert.equal(response.insights[0].model,'audit-simulated-model');
    });
    await check('SIMULATED:upstream-unknown-reference-is-HTTP-error',async()=>{
      mockContent={insights:[{textTemplate:`{{result:${a.analysisId}:unknown}}`,resultRefs:[a.analysisId+':unknown']}]};
      await assert.rejects(api.requestInsights(project.datasets[0],a,new AbortController().signal));
    });
    await check('SIMULATED:literal-fabricated-number-must-not-be-valid',async()=>{
      mockContent={insights:[{textTemplate:`均值是999999999，依据{{result:${r.resultId}}}。`,resultRefs:[r.resultId]}]};
      let response; try { response=await api.requestInsights(project.datasets[0],a,new AbortController().signal); } catch { return; }
      assert.fail(`raw fabricated numeric literal accepted as ${response.insights[0].status}; actual deterministic value=${r.value}`);
    });
  } finally { globalThis.fetch=realFetch; await new Promise(resolve=>fake.close(resolve)); }
  if(process.env.AUDIT_LIVE_BASE) {
    const liveBase=process.env.AUDIT_LIVE_BASE;
    assert.match(liveBase,/^http:\/\/127\.0\.0\.1:\d+$/);
    const health=await realFetch(liveBase+'/api/health').then(r=>r.json());
    out.liveServiceHealth={ok:health.ok,model:health.model,baseUrlHost:health.baseUrlHost,keyConfigured:health.keyConfigured};
    out.liveAi=[]; const liveInsights=[]; let localInsightCalls=0;
    globalThis.fetch=(url,init)=>{
      if(typeof url==='string'&&url.startsWith('/api/')) { if(url==='/api/insights')localInsightCalls++; return realFetch(liveBase+url,init); }
      return realFetch(url,init);
    };
    try {
      for(const current of analyses) await check(`${current.request.filters[0].fieldId}:REAL-AI-client-service-not-page`,async()=>{
        const bundle=project.datasets.find(b=>b.datasetId===current.datasetId);
        const response=await api.requestInsights(bundle,current,new AbortController().signal);
        assert.equal(response.analysisId,current.analysisId);
        for(const insight of response.insights) graph.validateInsight(insight,current);
        liveInsights.push(...response.insights);
        const record={domain:bundle.domain,requestId:response.requestId,analysisId:response.analysisId,model:response.model,generatedAt:response.generatedAt,status:200,resultRefs:response.insights.map(i=>i.resultRefs),insights:response.insights};
        out.liveAi.push(record); return {analysisId:response.analysisId,requestId:response.requestId,model:response.model,generatedAt:response.generatedAt,insights:response.insights.length};
      });
      if(out.liveAi.length===3) await check('SAVE:real-AI-history-roundtrip-without-model-repeat',async()=>{
        const withAi={...project,insights:[...project.insights,...liveInsights],selection:{...project.selection,nodeId:`finding:${liveInsights.at(-1).insightId}`}};
        const before=localInsightCalls; const json=await storage.exportProject(withAi); const restored=await storage.importProject(json);
        assert.deepEqual(restored,withAi); assert.equal(localInsightCalls,before); assert.ok(graph.rebuildGraph(restored).nodes.some(n=>n.id===withAi.selection.nodeId));
        const bad=JSON.parse(json);bad.datasets[0].sources[0].rawRecords[0][1]='CACHE_TAMPERED';await assert.rejects(storage.importProject(JSON.stringify(bad)));
        return {jsonBytes:Buffer.byteLength(json),actualLiveInsightCount:liveInsights.length,localModelRequests:before,requestsDuringRestore:localInsightCalls-before,selectedFinding:withAi.selection.nodeId};
      });
    } finally {globalThis.fetch=realFetch;}
  }
  if(process.env.AUDIT_REUSE_LIVE_EVIDENCE) {
    const old=JSON.parse(fs.readFileSync(path.resolve(process.env.AUDIT_REUSE_LIVE_EVIDENCE),'utf8'));
    for(const record of old.liveAi??[]) await check(`${record.domain}:historical-AI-number-and-finding-core-evidence`,()=>{
      const a=analyses.find(a=>a.analysisId===record.analysisId);assert.ok(a,'分析身份已改变，需要新证据');
      const owned={...project,insights:[...project.insights,...record.insights],selection:{datasetId:a.datasetId,analysisId:a.analysisId,measureFieldIds:a.request.measureFieldIds,nodeId:`finding:${record.insights[0].insightId}`}};
      const network=graph.currentGraph(owned,a.analysisId);
      assert.ok(network.nodes.some(n=>n.id===owned.selection.nodeId));
      assert.ok(network.nodes.filter(n=>n.type==='calculation').every(n=>n.ref.startsWith(a.analysisId+':')));
      for(const insight of record.insights)for(const ref of insight.resultRefs) {const e=graph.getEvidence(owned,ref);assert.equal(e.analysisId,a.analysisId);assert.ok(e.validCount>0);assert.ok(network.edges.some(edge=>edge.id===`cites:${insight.insightId}:${ref}`));}
      return {sourceEvidenceFile:path.basename(process.env.AUDIT_REUSE_LIVE_EVIDENCE),historicalGeneratedAt:record.generatedAt,analysisId:a.analysisId,currentNetworkNodes:network.nodes.length,newModelRequests:0};
    });
  }
}
out.summary={passed:out.checks.filter(c=>c.status==='passed').length,failed:out.checks.filter(c=>c.status==='failed').length};
fs.writeFileSync(path.join(reportDir,`2026-10-25_product-${tag}.json`),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({commits:out.commits,summary:out.summary,checks:out.checks},null,2));
process.exitCode=out.summary.failed?1:0;
