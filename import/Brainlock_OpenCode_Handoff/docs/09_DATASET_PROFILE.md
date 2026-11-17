# Dataset inventory — source-derived counts

CSV + JSONL are alternate encodings of the same **35,741** records (verified row-by-row during package preparation). Columns: `trick_name`, `type_variables`, `stance_variables`, `level_variables`.

## Level tier counts

| Raw tier | Records |
|---|---:|
| Noob | 156 |
| Beginner | 741 |
| Amateur | 5,896 |
| Pro | 7,660 |
| Sponsd | 21,288 |
| **Total** | **35,741** |

## Stances

| Raw stance | Records |
|---|---:|
| Normal | 9,107 |
| Switch | 9,055 |
| Fakie | 8,791 |
| Nollie | 8,788 |

## Major type tags (not mutually exclusive categories)

| Exact stored tag string | Records |
|---|---:|
| Grind\|Combo | 30,367 |
| Manual\|Combo | 3,776 |
| Flip | 404 |
| Stall\|Combo | 326 |
| Flip\|Combo | 288 |
| Grind | 156 |

16 exact tag combinations exist. There are 35,741 distinct normalized trick names and no empty required fields in the CSV. This does **not** verify physical legality, obstacle suitability, or the stored difficulty tier's fit for fingerboarding.

## Python generator nature

`trickgen_from_dataset.py` filters by `level_variables` five-tier cap; maps tier to approximate ratings {Noob:2, Beginner:4, Amateur:6, Pro:8, Sponsd:10}; gates obstacles through broad category tags; biases quotas and easy/mid/hard session distribution; deduplicates names within a generated session. Its default settings permit freestyle/air/stall; do **not** copy these defaults to v1. It creates session **lists** rather than handling player attempts/outcomes.

## Recommended use

Keep dataset in `source-archive/`; run curation/legality audit later. Main v1 generator operates on source-verified procedural components, not a direct random row from the raw dataset. If useful, sample the dataset offline to discover desirable candidate patterns or user-friendly naming, then explicitly validate each addition before shipping.
