# Bramley CI — Configuration Reference

**Audience:** Beta testers and administrators  
**Last updated:** June 2026

This document describes every setting in the **Admin → Config** panel. All values can be edited live; changes take effect immediately without redeploying the app.

---

## 1. Scoring Weights

These seven weights determine how the AI scores each submission. They should sum to 1.0. Adjusting them shifts which types of improvement tend to rank highest.

| Config Key | Default | Description |
|---|---|---|
| `WEIGHT_MEMBER_IMPACT` | 0.25 | How many members are affected. Highest weighting — breadth of benefit matters most. |
| `WEIGHT_STRATEGIC` | 0.20 | Alignment with the club's strategic goals (e.g. course quality, member retention). |
| `WEIGHT_FEASIBILITY` | 0.20 | How practical the idea is to implement given club resources and constraints. |
| `WEIGHT_COST_BENEFIT` | 0.15 | Return on investment — low-cost, high-impact ideas score better here. |
| `WEIGHT_NOVELTY` | 0.10 | Whether the idea is fresh or has been raised before. |
| `WEIGHT_EXPERIENCE_DELTA` | 0.10 | How much the improvement would lift the day-to-day member experience. |

**How to use:** If the board wants to prioritise cost-efficiency, increase `WEIGHT_COST_BENEFIT` and reduce another weight to compensate. Weights are read each time the overnight scoring cron runs.

---

## 2. Score Multipliers

Multipliers are applied on top of the base score for submissions that meet certain conditions. A value of `1.2` means the score is multiplied by 1.2 (i.e. boosted by 20%).

| Config Key | Default | Description |
|---|---|---|
| `MULT_HS` | 1.5 | Health & Safety flag. H&S submissions are boosted significantly and always appear at the top of the triage list regardless of score. |
| `MULT_BUDGET_YEAR` | 1.2 | Submission aligns with the current budget year's priorities. |
| `MULT_MULTI_CATEGORY` | 1.1 | Submission spans multiple categories (e.g. course and clubhouse). |

---

## 3. Score Band Thresholds

Submissions are grouped into named bands based on their final score (0–10). The triage dashboard uses these bands as column headers or filters.

| Config Key | Default | Meaning |
|---|---|---|
| `BAND_PRIORITY` | 8.0 | Score ≥ 8.0 → **Priority** band. Act on these first. |
| `BAND_ACTIVE` | 6.0 | Score ≥ 6.0 → **Active Queue** band. |
| `BAND_HOLDING` | 4.0 | Score ≥ 4.0 → **Holding** band. Worth keeping an eye on. |
| `BAND_LOW` | 2.0 | Score ≥ 2.0 → **Low Priority** band. |

Submissions below `BAND_LOW` are scored but treated as background noise.

---

## 4. Category Impact Ceilings

Each category has a maximum possible impact contribution to its score. This reflects the realistic reach of improvements in that area — a course improvement can affect all members, whereas a pro shop change affects fewer.

| Config Key | Default | Category |
|---|---|---|
| `CEILING_COURSE` | 10 | Course |
| `CEILING_COMPETITIONS` | 7 | Competitions & Matches |
| `CEILING_CLUBHOUSE` | 8 | Clubhouse |
| `CEILING_GROUNDS` | 6 | Grounds (non-course) |
| `CEILING_REFRESHMENTS` | 4 | On-course Refreshments |
| `CEILING_RESTAURANT` | 5 | Restaurant / Catering |
| `CEILING_BAR` | 6 | Bar |
| `CEILING_PRO_SHOP` | 3 | Pro Shop |

**How to use:** If the board decides the bar has become more strategically important, increase `CEILING_BAR`. This will allow bar-related submissions to score higher relative to other categories.

---

## 5. Consensus (Cluster) Bonuses

When multiple members independently submit the same idea, the system groups them into a cluster. A bonus is added to the score to reflect the strength of consensus.

| Config Key | Default | Applies when |
|---|---|---|
| `CLUSTER_BONUS_2` | 0.5 | 2 submissions in a cluster |
| `CLUSTER_BONUS_3` | 1.0 | 3 submissions |
| `CLUSTER_BONUS_4` | 1.5 | 4 submissions |
| `CLUSTER_BONUS_5` | 2.0 | 5 or more submissions |

---

## 6. Cost Thresholds

These thresholds affect how a submission is automatically flagged during scoring.

| Config Key | Default | Description |
|---|---|---|
| `COST_THRESHOLD_COMMITTEE` | £5,000 | Estimated costs above this value trigger a flag recommending full committee review before approval. |
| `COST_THRESHOLD_QUICKWIN` | £500 | Estimated costs below this value, combined with short implementation time, flag the submission as a **Quick Win**. |
| `IMPL_QUICKWIN_WEEKS` | 4 | Implementation time at or below this number of weeks also contributes to the Quick Win flag. |

---

## 7. Director Spend Signoff Limits

These limits control at which point in the ratification chain a decision is considered **final**. When a director saves a decision with a confirmed cost, the system checks whether that cost falls within the deciding authority's spend limit. If it does, the decision is finalised immediately and the ratification chain stops. If not, it continues up the chain.

| Config Key | Default | Authority level |
|---|---|---|
| `SPEND_LIMIT_DIRECTOR` | £0 | Director (Golf, Estate, F&B, Commercial, Captains, Finance). Default of £0 means all director decisions are referred up. |
| `SPEND_LIMIT_OPERATIONS_MANAGER` | £2,500 | Operations Manager. Can finalise decisions up to £2,500. |
| `SPEND_LIMIT_CLUB_MANAGER` | £10,000 | Club Manager. Can finalise decisions up to £10,000. |
| `SPEND_LIMIT_CHAIRMAN` | £999,999 | Chair of the Board. Effectively unlimited — all decisions finalise here. |

**How it works in practice:**

- A Golf Director approves a £800 improvement. £800 > £0 (director limit), so the decision is flagged for ratification and the Operations Manager is notified.
- The Operations Manager reviews and confirms. £800 ≤ £2,500 (ops manager limit), so the decision is **finalised** — no email goes to the Club Manager.
- If the cost were £3,000, the Operations Manager's decision would itself be referred up to the Club Manager.

**Important:** If no confirmed cost is set on a submission, the decision is treated as finalised at whatever level acts on it — cost is only checked when a £ figure is entered.

---

## 8. Triage Scheduling

| Config Key | Default | Description |
|---|---|---|
| `TRIAGE_INTERVAL_DAYS` | 7 | Minimum number of days between overnight scoring runs. Prevents the same submissions being re-scored too frequently. |
| `TRIAGE_LOCK` | false | Internal flag set to `true` while a scoring run is in progress to prevent overlapping jobs. Should always read `false` when the system is idle — if it reads `true` and no run is active, reset it manually. |

---

## 9. Member Communications

These settings control the tone and sign-off used in automated emails sent to members when their submission status changes.

| Config Key | Default | Description |
|---|---|---|
| `COMMS_TONE` | friendly | Writing tone for AI-generated member emails. Valid values: `friendly` or `formal`. |
| `COMMS_SIGNOFF` | The Improvement Committee, Bramley Golf Club | The sign-off line that appears at the end of every member email. |

---

*All config changes are applied immediately. No redeployment is required.*
