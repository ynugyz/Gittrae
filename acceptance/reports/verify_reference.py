"""Independent, stdlib-only reference checks; never imports product code.

Run from repository root: py -3 acceptance/reports/verify_reference.py
Only writes its evidence JSON inside acceptance/reports/.
Passing these checks does not imply that any product feature passes.
"""
import bisect
import collections
import csv
import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import platform
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = "472d151b811cb9f4af0620c2bdc6bd8e78a09de7"
OUT = ROOT / "acceptance/reports/2026-10-25_472d151_reference.json"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_csv(path):
    data = (ROOT / path).read_bytes()
    return list(csv.reader(io.StringIO(data.decode("utf-8-sig"), newline="")))


def number(text):
    try:
        value = float(text.strip())
        return value if math.isfinite(value) else None
    except (ValueError, TypeError, AttributeError):
        return None


def quantile(values, p):
    h = (len(values) - 1) * p
    lo, hi = math.floor(h), math.ceil(h)
    return values[lo] + (values[hi] - values[lo]) * (h - lo)


def describe(pairs):
    valid = [(rid, x) for rid, x in pairs if x is not None]
    values = sorted(x for _, x in valid)
    n = len(values)
    result = {"count": n, "missing": len(pairs) - n,
              "validRecordIds": [rid for rid, _ in valid]}
    if not n:
        result.update({k: None for k in ("mean", "median", "std", "min", "q1", "q3", "max")})
        result.update(histogram={"edges": [], "counts": []}, reason="no_valid_values")
        return result
    mean = math.fsum(values) / n
    q1, median, q3 = (quantile(values, p) for p in (.25, .5, .75))
    iqr = q3 - q1
    fences = [q1 - 1.5 * iqr, q3 + 1.5 * iqr]
    inner = [x for x in values if fences[0] <= x <= fences[1]]
    lo, hi = (values[0], values[-1]) if values[0] != values[-1] else (values[0] - .5, values[0] + .5)
    edges = [lo + (hi - lo) * i / 10 for i in range(11)]
    counts = [0] * 10
    bins = [[] for _ in range(10)]
    for rid, x in valid:
        index = min(9, max(0, bisect.bisect_right(edges, x) - 1))
        counts[index] += 1
        bins[index].append(rid)
    result.update(mean=mean, median=median,
                  std=math.sqrt(math.fsum((x - mean) ** 2 for x in values) / (n - 1)) if n > 1 else None,
                  min=values[0], max=values[-1], q1=q1, q3=q3, iqr=iqr,
                  fences=fences, whiskers=[inner[0], inner[-1]],
                  outlierIds=[rid for rid, x in valid if x < fences[0] or x > fences[1]],
                  histogram={"edges": edges, "counts": counts, "binRecordIds": bins})
    if n < 2:
        result["stdReason"] = "insufficient_sample"
    return result


def correlation(rows, fields):
    pairs = [(r[0], number(r[1]), number(r[2])) for r in rows]
    good = [(rid, x, y) for rid, x, y in pairs if x is not None and y is not None]
    result = {"fields": fields, "pairCount": len(good), "value": None,
              "includedIds": [r[0] for r in good],
              "excludedIds": [rid for rid, x, y in pairs if x is None or y is None]}
    if len(good) < 2:
        result["reason"] = "insufficient_sample"
        return result
    mx = math.fsum(x for _, x, _ in good) / len(good)
    my = math.fsum(y for _, _, y in good) / len(good)
    xx = math.fsum((x - mx) ** 2 for _, x, _ in good)
    yy = math.fsum((y - my) ** 2 for _, _, y in good)
    if not xx or not yy:
        result["reason"] = "constant_field"
    else:
        result["value"] = math.fsum((x - mx) * (y - my) for _, x, y in good) / math.sqrt(xx * yy)
    return result


def main():
    failures = []
    comparisons = []

    def check(label, ok):
        comparisons.append({"check": label, "status": "passed" if ok else "failed"})
        if not ok:
            failures.append(label)

    def compare(actual, expected, label):
        if isinstance(expected, dict):
            for key, value in expected.items():
                if key not in actual:
                    check(label + "." + key, False)
                else:
                    compare(actual[key], value, label + "." + key)
        elif isinstance(expected, list):
            check(label + ".length", isinstance(actual, list) and len(actual) == len(expected))
            if isinstance(actual, list):
                for i, (a, e) in enumerate(zip(actual, expected)):
                    compare(a, e, label + "[" + str(i) + "]")
        elif isinstance(expected, float):
            check(label, isinstance(actual, (int, float)) and not isinstance(actual, bool)
                  and math.isfinite(actual) and abs(actual - expected) <= 1e-9)
        else:
            check(label, actual == expected and (expected is not None or actual is None))

    manifest_bytes = (ROOT / "data/manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    paths = git("ls-tree", "-rz", "--name-only", BASE).decode().rstrip("\0").split("\0")
    check("manifest_matches_baseline_blob", manifest_bytes == git("show", BASE + ":data/manifest.json"))
    records = []
    for f in manifest["files"]:
        data = (ROOT / f["relativePath"]).read_bytes()
        rows = read_csv(f["relativePath"])
        actual = {"sha256": sha(data), "bytes": len(data),
                  "parsedRecordCount": len(rows) - 1, "columns": rows[0]}
        ok = all(actual[k] == f[k] for k in actual)
        check("raw:" + f["relativePath"], ok)
        records.append({"path": f["relativePath"], "domain": f["domain"], **actual,
                        "status": "passed" if ok else "failed"})
    local_paths = {p.relative_to(ROOT).as_posix() for p in (ROOT / "data/raw").rglob("*.csv")}
    check("all_raw_paths_listed", local_paths == {f["relativePath"] for f in manifest["files"]})
    check("csv_count", len(records) == manifest["fileCount"] == 58)
    check("total_bytes", sum(f["bytes"] for f in records) == manifest["totalBytes"])
    check("total_records", sum(f["parsedRecordCount"] for f in records) == manifest["totalParsedRecordCount"])
    fingerprint = sha("\n".join(f["path"] + "\t" + f["sha256"] for f in sorted(records, key=lambda x: x["path"])).encode())
    check("package_fingerprint", fingerprint == manifest["packageFingerprintSha256"])
    roles = ["总控", "人员1_数据与来源", "人员2_统计与AI", "人员3_界面与集成", "人员4_独立审计"]
    for role in roles:
        for name in ("START_HERE", "TASK", "DELIVERABLES", "STATUS_TEMPLATE"):
            p = "handoff/" + role + "/" + name + ".md"
            check("role_file:" + p, p in paths and bool((ROOT / p).read_text(encoding="utf-8").strip()))

    expected_path = "acceptance/fixtures/expected.json"
    expected = json.loads((ROOT / expected_path).read_bytes())
    fixture_actual = {}
    fixture_inputs = []
    for name in ("basic.csv", "missing_constant.csv", "single.csv", "all_missing.csv"):
        p = "acceptance/fixtures/" + name
        rows = read_csv(p)
        actual = {"rawRecordCount": len(rows) - 1}
        for index, field in enumerate(rows[0][1:], 1):
            actual[field] = describe([(r[0], number(r[index])) for r in rows[1:]])
        if name in ("basic.csv", "single.csv"):
            actual["correlation"] = correlation(rows[1:], ["x", "y"])
        elif name == "missing_constant.csv":
            actual["correlations"] = [correlation(rows[1:], ["x", "y"]),
                                      correlation([[r[0], r[1], r[3]] for r in rows[1:]], ["x", "constant"])]
        compare(actual, expected[name], name)
        fixture_actual[name] = actual

    rows = read_csv("acceptance/fixtures/leading_zero.csv")
    leading = {"codeValues": [r[0] for r in rows[1:]], "amountValues": [number(r[1]) for r in rows[1:]]}
    compare(leading, {k: expected["leading_zero.csv"][k] for k in leading}, "leading_zero.csv")
    fixture_actual["leading_zero.csv"] = leading
    p = "acceptance/fixtures/csv_quoted.csv"
    reader = csv.reader(io.StringIO((ROOT / p).read_bytes().decode("utf-8-sig"), newline=""))
    next(reader)
    quoted = {"records": [], "emptyRecordIndices": []}
    for index, row in enumerate(reader, 1):
        if row:
            quoted["records"].append({"recordIndex": index, "values": row})
        else:
            quoted["emptyRecordIndices"].append(index)
    quoted.update(rawRecordCountIncludingEmpty=index, normalizedRecordCount=len(quoted["records"]))
    q_expected = expected["csv_quoted.csv"]
    compare(quoted, {k: q_expected[k] for k in quoted if k != "records"}, "csv_quoted.csv")
    compare(quoted["records"], [{k: r[k] for k in ("recordIndex", "values")} for r in q_expected["records"]], "csv_quoted.csv.records")
    fixture_actual["csv_quoted.csv"] = quoted
    left = read_csv("acceptance/fixtures/join_left_duplicate.csv")[1:]
    right = read_csv("acceptance/fixtures/join_right.csv")[1:]
    groups = collections.defaultdict(list)
    for i, r in enumerate(left, 1):
        groups[(r[0], r[1])].append(i)
    duplicates = [{"region": k[0], "year": k[1], "recordIndices": v} for k, v in groups.items() if len(v) > 1]
    compare(duplicates, expected["join_left_duplicate.csv+join_right.csv"]["duplicateLeftKeys"], "duplicate_join_keys")
    fixture_actual["join"] = {"duplicateLeftKeys": duplicates, "rightRows": len(right),
                             "referenceDecision": "reject_ambiguous_join" if duplicates else "unique_left_keys"}
    for path in sorted((ROOT / "acceptance/fixtures").glob("*")):
        if path.suffix in (".csv", ".json"):
            rel = path.relative_to(ROOT).as_posix()
            check("fixed_fixture_matches_baseline:" + rel, path.read_bytes() == git("show", BASE + ":" + rel))
            fixture_inputs.append({"path": rel, "sha256": sha(path.read_bytes())})

    real = {}
    selected = [f for f in manifest["files"] if any(s in f["relativePath"] for s in
                ("income__全体", "expend__全体", "FY2025", "GASGOO_rank_firm_202608", "GASGOO_rank_model_202608"))]
    d1_tables = {}
    for f in selected:
        rows = read_csv(f["relativePath"])
        headers, body = rows[0], rows[1:]
        if f["domain"] == "D1":
            j = headers.index("2024年")
            pairs = [(str(i), number(r[j])) for i, r in enumerate(body, 1)]
            d1_tables["income" if "income__" in f["relativePath"] else "expend"] = {r[0].strip(): (str(i), r[j]) for i, r in enumerate(body, 1)}
            scope = "2024年31省级地区，简单等权均值，非全国人口加权值"
            result = {"field": headers[j], "columnIndex": j, "unit": "元/人·年", "statistics": describe(pairs)}
        elif f["domain"] == "D2":
            j_code, j_ind = headers.index("股票代码"), headers.index("所处行业")
            subset = [(str(i), r) for i, r in enumerate(body, 1) if len(r[j_code]) == 6 and r[j_code].isdigit() and r[j_code].startswith(("60", "00", "30", "68"))]
            scope = "FY2025，6位代码60/00/30/68前缀教学子集，保留负利润与未知行业"
            fields = [headers.index("营业总收入-营业总收入"), headers.index("净利润-净利润")]
            result = {"inputRows": len(body), "includedRows": len(subset), "excludedRows": len(body) - len(subset),
                      "missingIndustry": sum(not r[j_ind].strip() for _, r in subset), "unit": "元",
                      "statistics": {headers[j]: describe([(rid, number(r[j])) for rid, r in subset]) for j in fields},
                      "correlation": correlation([[rid, r[fields[0]], r[fields[1]]] for rid, r in subset], [headers[j] for j in fields]),
                      "negativeProfitCount": sum(number(r[fields[1]]) is not None and number(r[fields[1]]) < 0 for _, r in subset)}
        else:
            j = headers.index("2026-8")
            pairs = [(str(i), number(r[j])) for i, r in enumerate(body, 1)]
            scope = "2026年8月Top50榜单，车企/车型分别统计，非全市场；不使用源环比列"
            result = {"field": headers[j], "columnIndex": j, "unit": "辆", "statistics": describe(pairs),
                      "top50Sum": math.fsum(x for _, x in pairs if x is not None)}
        real[f["relativePath"]] = {"inputSha256": f["sha256"], "scope": scope, **result}
    income, expend = d1_tables["income"], d1_tables["expend"]
    check("D1_region_keys_unique", len(income) == len(expend) == 31)
    check("D1_region_keys_align", income.keys() == expend.keys())
    real["D1_2024_income_expenditure_pair"] = {
        "joinKeys": ["trim(region)", "year=2024"],
        "scope": "全体居民，2024年31省级地区；独立参考，非应用AnalysisResult",
        "correlation": correlation([[k, income[k][1], expend[k][1]] for k in sorted(income)], ["income", "expend"])}
    evidence = {"kind": "independent_reference_not_product_acceptance_not_official_gold",
                "testedCommit": BASE, "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "environment": {"python": platform.python_version(), "platform": platform.system()},
                "scriptSha256": sha(Path(__file__).read_bytes()),
                "manifestSha256": sha(manifest_bytes), "dataVersion": manifest["dataVersion"],
                "packageFingerprintSha256": fingerprint,
                "summary": {"checks": len(comparisons), "failed": len(failures), "csvFiles": len(records),
                            "domains": dict(collections.Counter(f["domain"] for f in records)),
                            "totalBytes": sum(f["bytes"] for f in records),
                            "totalParsedRecords": sum(f["parsedRecordCount"] for f in records)},
                "failures": failures, "checks": comparisons, "rawFiles": records,
                "fixtureInputs": fixture_inputs, "fixtureReferenceResults": fixture_actual,
                "realDataReferences": real,
                "limitations": ["No product module, browser, graph, AI API or project restore was executed.",
                                "Source URLs and official statistical truth were not independently verified.",
                                "Financial reference has no industry filter; application needs separate industry cases.",
                                "Physical line ranges and UI policy enforcement remain product checks."]}
    OUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(evidence["summary"], ensure_ascii=False))
    print("Evidence: " + OUT.relative_to(ROOT).as_posix())
    if failures:
        print(json.dumps(failures, ensure_ascii=False))
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
