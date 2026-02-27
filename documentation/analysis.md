# ISIS Dataset Analysis

## Overview

The dataset describes **456 occupations** (MASCO 4-digit codes) across four interlinked files, building a picture of the Mauritanian/African labour market's exposure to AI automation.

---

## 1. Dataset Structure

| File | Description | Records |
|---|---|---|
| `occupations_nodelist` | 456 occupations with AI exposure index, quartile, and wage | 456 rows |
| `occupations_edgelist` | Skill-based connections between occupations | 9,580 edges |
| `masco-4d with skills` | Occupation–skill mappings (basic + specific) | 3,659 pairs |
| `masco-4d with tasks and scores` | Occupation tasks scored for automation potential (GPT-4o) | 3,476 pairs |

---

## 2. AI Exposure Index

- **Range:** 0.0 → 1.0
- **Mean:** 0.463 (just below the midpoint — occupations skew toward moderate risk)
- **Quartile breakdown:**

| Quartile | Count | Share |
|---|---|---|
| Low | 126 | 27.6% |
| Medium-low | 94 | 20.6% |
| Medium-high | 118 | 25.9% |
| High | 118 | 25.9% |

> Nearly **52% of occupations** fall in the medium-high or high exposure quartiles, meaning more than half the workforce faces meaningful AI disruption risk.

### Highest AI Exposure Occupations (score = 1.0)
- Policy & Planning Managers
- Accountants & Auditors
- Financial Analysts & Investment Advisers
- Mathematicians, Actuaries & Statisticians
- Management & Organisation Analysts

### Lowest AI Exposure (score = 0.0)
- Civil Engineering & Construction Labourers
- Kitchen Helpers, Garbage Collectors, Sweepers
- Street Vendors, Messengers, Odd-Job Persons

> **Pattern:** High-exposure roles are cognitive/knowledge-intensive white-collar jobs. Low-exposure roles are physical, manual, or face-to-face jobs — consistent with global AI research.

---

## 3. Wages vs. AI Exposure

| Quartile | Avg Wage |
|---|---|
| High AI exposure | **4,058** |
| Medium-high | **4,397** |
| Medium-low | **3,517** |
| Low AI exposure | **1,970** |

> **Key insight:** Higher-paid jobs face greater AI exposure. Low-wage manual workers are *safer* from AI displacement in the short term, but they lack the wage buffer to adapt. This creates a **dual vulnerability**: high earners face disruption from above; low earners face disruption from automation of adjacent tasks with no financial cushion.

---

## 4. Skills Landscape

- **3,659 skill–occupation pairs** across 456 occupations
- **Average:** 8 skills per occupation
- **Split:** 55% basic skills / 45% specific/technical skills

### Top Basic Skills (cross-cutting)

| Skill | Occupations |
|---|---|
| Active Listening | 295 |
| Critical Thinking | 236 |
| Reading Comprehension | 227 |
| Speaking | 226 |
| Coordination | 122 |

### Top Specific/Technical Skills

| Skill | Occupations |
|---|---|
| Analysis | 62 |
| Microsoft Office | 59 |
| Work Safety | 47 |
| Administration Management | 41 |
| Machine Operation | 36 |

> **Key insight:** The most common skills (active listening, critical thinking, speaking) are exactly the ones AI struggles to replicate — yet they are broadly required, suggesting that human-AI complementarity rather than replacement is plausible for many roles. **Microsoft Office appearing in 59 occupations** is a direct AI vulnerability signal (Copilot/automation directly targets these tasks).

---

## 5. Task Automation Scores (GPT-4o)

Scores represent estimated AI automation potential per task (0 = not automatable, 1 = fully automatable).

- **Mean task score:** 0.351
- **Distribution:**

| Score Range | Tasks | Share |
|---|---|---|
| 0.0 — not automatable | 6 | 0.2% |
| 0.01–0.25 — low | 1,352 | 38.9% |
| 0.26–0.5 — medium | 1,406 | 40.4% |
| 0.51–0.75 — high | 631 | 18.1% |
| 0.76–1.0 — very high | 82 | 2.4% |

> **79% of tasks** sit in the low-to-medium range — AI poses a *partial* rather than total threat to most occupations. Very few tasks are both fully defined and fully automatable.

### Most Automatable Task Examples (score ≥ 0.85)

- **Typist:** Transcription, typing from dictation, checking grammar (0.95)
- **Data Professionals:** Data extraction from sources (0.85)
- **Medical Records:** Copying/compiling patient records (0.85)
- **Securities Dealers:** Recording buy/sell orders (0.85)
- **Authors/Writers:** Writing advertising copy (0.85)

---

## 6. Occupation Skill Network (Edgelist)

- **9,580 edges** connecting occupations that share specific skills
- **Edge weights:** 1–9 shared skills per connection (average: 1.3)
- **Most connected occupations** (highest number of skill-sharing peers):

| Code | Occupation | Connections |
|---|---|---|
| 3144 | Fishery Technicians | 141 |
| 3143 | Forestry Technicians | 140 |
| 2262 | Pharmacists | 138 |
| 2422 | Policy Administration Professionals | 138 |
| 2311 | University Teaching Professionals | 137 |

> **Key insight:** Highly connected occupations are strong candidates for **reskilling pivot points** — workers in adjacent occupations can transition to these with minimal retraining.

---

## 7. Summary of Actionable Insights

| Insight | Implication |
|---|---|
| 52% of occupations are high/medium-high AI exposure | Majority of the formal workforce needs proactive adaptation strategies |
| Higher wages correlate with higher AI exposure | Disruption is not confined to low-skill roles |
| Soft skills (listening, critical thinking) dominate | Human-complementary work is more resilient than task-substitution risk suggests |
| Microsoft Office in 59 occupations | Significant near-term displacement risk from productivity AI tools |
| 79% of tasks are low-to-medium automatable | Partial augmentation (AI as co-pilot) is more likely than full job elimination |
| Fishery/Forestry technicians are most network-connected | These roles are strong reskilling bridges in the occupation graph |
