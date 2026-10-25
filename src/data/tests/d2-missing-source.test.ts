import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { importFiles } from '../importFiles.ts';

test('D2 688759 缺失营收保留真实空单元格来源，不为不存在的列造引用', async () => {
  const name = 'EM_yjbb_FY2025_20251231.csv';
  const bytes = new Uint8Array(readFileSync(resolve('data/raw/D2_企业财务_A股上市公司', name)));
  const [bundle] = await importFiles([{ name, bytes }]);
  const record = bundle.records.find((row) => row.values.code === '688759')!;
  assert.equal(record.values.revenue, null);
  assert.equal(record.recordId, 'rec:d2:FY2025:688759');
  assert.deepEqual(record.provenance.revenue, [{ sourceId: 'src:c519acb415f858731e5c', recordIndex: 2755, columnIndex: 4 }]);
  const source = bundle.sources[0];
  assert.equal(source.sha256, 'c519acb415f858731e5cda99f578b536acb5eb0b59d57963d871ed23223b43a6');
  assert.equal(source.rawRecords[2754][4], '');
  assert.equal(bundle.adapterVersion, '1.0.1');
  assert.notEqual(bundle.datasetVersion, 'v1:46858cc3a18ab72d174fdd0e');
  for (const csv of [
    '股票代码,股票简称\n688759,示例\n',
    `${source.headers.join(',')}\n1,688759,缺列\n`,
  ]) {
    const [missingColumn] = await importFiles([{ name, bytes: new TextEncoder().encode(csv) }]);
    assert.equal(missingColumn.records[0].values.revenue, null);
    assert.equal(missingColumn.records[0].provenance.revenue, undefined);
  }
});
