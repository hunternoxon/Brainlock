#!/usr/bin/env python3
"""Verify original uploads and dataset schema. This does NOT test game functionality."""
import csv,json,zipfile,hashlib,collections,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
S=ROOT/'source-archive'
NAMES=['brainlock_trick_system_deep_spec.docx','Brainlock_Overview_Rules.docx','brainlock-pwa-v4-5-2.zip','index.zip','goskateboard_tricks_extracted.csv','goskateboard_tricks_extracted.jsonl','trickgen_from_dataset.py']
for name in NAMES:
 p=S/name
 if not p.is_file():raise SystemExit('Missing '+str(p))
 print('OK %-44s %9d bytes %s'%(name,p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest()[:16]))
for name in ['brainlock-pwa-v4-5-2.zip','index.zip']:
 with zipfile.ZipFile(S/name) as z:
  bad=z.testzip()
  if bad:raise SystemExit('Corrupt ZIP '+bad)
  print(name,'entries:',len([m for m in z.infolist() if not m.is_dir()]))
with (S/'goskateboard_tricks_extracted.csv').open(encoding='utf-8',newline='') as f:
 rows=list(csv.DictReader(f))
assert len(rows)==35741, f'Expected 35741 rows, got {len(rows)}'
assert len({x['trick_name'].casefold().strip() for x in rows})==len(rows),'Duplicate names'
req={'trick_name','type_variables','stance_variables','level_variables'}
assert req.issubset(set(rows[0])),'CSV headers mismatch'
with (S/'goskateboard_tricks_extracted.jsonl').open(encoding='utf-8') as f:
 for n,(row,line) in enumerate(zip(rows,f),start=1):
  item=json.loads(line)
  assert all(row[k]==item[k] for k in req), f'CSV/JSONL mismatch at {n}'
 with (S/'goskateboard_tricks_extracted.jsonl').open(encoding='utf-8') as f2:
  assert sum(1 for _ in f2)==len(rows), 'Different JSONL row count'
print('Verified dataset rows:',len(rows))
print('Tiers:',dict(collections.Counter(x['level_variables'] for x in rows)))
print('Data audit PASS. WARNING: does not verify legality, scoring, runtime JavaScript, or UI.')
