/**
 * Bramley Golf Club CIP — Document Generator
 * ===========================================
 * Generates proper .docx files for member and committee guides.
 *
 * Usage (run from project root):
 *   node scripts/build-docs.js
 *
 * Prerequisites:
 *   npm install --save-dev docx
 *
 * Output:
 *   docs/member-guide.docx
 *   docs/committee-guide.docx
 *   docs/continuity-guide.docx
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  TableOfContents, StyleLevel, convertInchesToTwip, convertMillimetersToTwip,
  PageSize, PageOrientation, Header, Footer, PageNumber, NumberFormat,
  LevelFormat, UnderlineType,
} = require('docx')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const NAVY   = '1a3a5c'
const GREEN  = '1e8449'
const AMBER  = 'b7770d'
const RED    = 'c0392b'
const LGRAY  = 'f5f7fa'
const MGRAY  = 'cccccc'
const DGRAY  = '555555'
const WHITE  = 'FFFFFF'

// ---------------------------------------------------------------------------
// Reusable style helpers
// ---------------------------------------------------------------------------

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY } },
    children: [new TextRun({ text, color: NAVY, bold: true, size: 48 })],
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, color: NAVY, bold: true, size: 30 })],
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, color: NAVY, bold: true, size: 24 })],
  })
}

function h4(text) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, color: '333333' })],
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, color: opts.color ?? '222222', bold: opts.bold, italic: opts.italic })],
  })
}

function pRuns(runs) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: runs.map((r) =>
      typeof r === 'string'
        ? new TextRun({ text: r, size: 22 })
        : new TextRun({ text: r.text, size: 22, bold: r.bold, italic: r.italic, color: r.color })
    ),
  })
}

function bullet(text, opts = {}) {
  return new Paragraph({
    bullet: { level: opts.level ?? 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, bold: opts.bold })],
  })
}

function numbered(text, num) {
  return new Paragraph({
    numbering: { reference: 'numbered-list', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22 })],
  })
}

function gap(lines = 1) {
  return new Paragraph({ spacing: { before: 0, after: lines * 120 }, children: [] })
}

function hr() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'dddddd' } },
    children: [],
  })
}

function subtitle(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 28, color: DGRAY, bold: true })],
  })
}

function version(text) {
  return new Paragraph({
    spacing: { before: 20, after: 240 },
    children: [new TextRun({ text, size: 18, color: '888888', italics: true })],
  })
}

// Callout box: shaded paragraph with left border colour
function callout(label, text, color = NAVY, bg = 'e8f0f8') {
  const rows = []
  if (label) {
    rows.push(new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: bg },
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          left: { style: BorderStyle.SINGLE, size: 16, color },
        },
        margins: { top: 80, bottom: 20, left: 160, right: 160 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 20, color })],
        })],
      })],
    }))
  }
  rows.push(new TableRow({
    children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: bg },
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        left: { style: BorderStyle.SINGLE, size: 16, color },
      },
      margins: { top: label ? 20 : 80, bottom: 80, left: 160, right: 160 },
      children: [new Paragraph({
        children: [new TextRun({ text, size: 20, color: '333333' })],
      })],
    })],
  }))
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 160, bottom: 160 },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
    },
    rows,
  })
}

function tipBox(text)     { return callout('Tip', text, GREEN, 'eafaf1') }
function warnBox(text)    { return callout('Note', text, AMBER, 'fef9e7') }
function dangerBox(text)  { return callout('Caution', text, RED, 'fdf2f2') }
function infoBox(text)    { return callout(null, text, NAVY, 'e8f0f8') }

// Standard table
function stdTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 160, bottom: 160 },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: WHITE, size: 20 })] })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell) => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? 'FFFFFF' : LGRAY },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({
            children: typeof cell === 'string'
              ? [new TextRun({ text: cell, size: 20 })]
              : cell.map((c) => new TextRun({ text: c.text, size: 20, bold: c.bold, italics: c.italic })),
          })],
        })),
      })),
    ],
  })
}

// Page break
function pageBreak() {
  return new Paragraph({ pageBreakBefore: true, children: [] })
}

// ---------------------------------------------------------------------------
// Document settings (A4)
// ---------------------------------------------------------------------------
function docSettings(title, sections) {
  return new Document({
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: sections.map((s) => ({
      properties: {
        page: {
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
          margin: { top: convertMillimetersToTwip(25), bottom: convertMillimetersToTwip(25),
                    left: convertMillimetersToTwip(25), right: convertMillimetersToTwip(25) },
        },
      },
      children: s,
    })),
  })
}

// ---------------------------------------------------------------------------
// MEMBER GUIDE
// ---------------------------------------------------------------------------
function buildMemberGuide() {
  const children = [
    h1('Bramley Golf Club'),
    subtitle('Continuous Improvement Programme — Member Guide'),
    version('Version 1.0  ·  June 2026'),
    hr(),

    h2('1. What is the Continuous Improvement Programme?'),
    p('The CIP is a structured way for members to suggest improvements to any aspect of the club — the course, facilities, catering, events, and more. Every idea is reviewed by the committee using a consistent, fair scoring process.'),
    bullet('Any active member can submit ideas'),
    bullet('All ideas are treated equally regardless of who submits them'),
    bullet('Submissions are assessed by an impartial scoring process before committee review'),
    bullet('You can track the status of your ideas at any time'),
    bullet('You will receive email updates when the status of your idea changes'),
    gap(),

    h2('2. Signing in'),
    p('Before you can submit an idea or track your improvements, you need to sign in using your club membership credentials.'),
    h3('What you need'),
    bullet('Your Member ID (the number on your membership card)'),
    bullet('Your club website PIN (the same PIN you use to log in to the Bramley Golf Club website)'),
    bullet('Your email address'),
    gap(),
    pRuns([{ text: 'First-time sign-in: ', bold: true }, { text: 'Your email address will be registered against your member ID. On future visits you must use the same email address.' }]),
    gap(),
    tipBox('Your session stays active for 8 hours. After 10 minutes of inactivity you will see a warning, and after 20 minutes you will be signed out automatically for security.'),
    warnBox('Locked out? If you enter incorrect details 5 times, access is locked for 15 minutes. This is a security measure to protect your account.'),

    h2('3. Submitting an improvement idea'),
    p('Once signed in, click Submit an improvement to open the submission form.'),
    h3('Describe your improvement (required — up to 200 characters)'),
    p('Be specific. Describe exactly what you would like to see changed or introduced. The clearer and more specific your idea, the better it can be assessed.'),
    pRuns([{ text: 'Good example: ', bold: true, italic: true }, { text: '"Install a ball-washing station at the 10th tee, which currently has none."', italic: true }]),
    pRuns([{ text: 'Less useful: ', bold: true, italic: true }, { text: '"Improve the back nine."', italic: true }]),
    h3('How would this benefit members? (required — up to 500 characters)'),
    p('Explain the benefit to members and the club. Think about which members would benefit and how, whether it improves safety, enjoyment, revenue, or operations, and whether there is a specific problem it solves.'),
    h3('Category (required)'),
    p('Select the area of the club your idea relates to. See Section 4 for descriptions.'),
    h3('How many members does this affect? (required)'),
    p('Select the option that best describes how widely this improvement would be felt. See Section 5 for guidance.'),
    h3('Recognition (required)'),
    p('Choose whether you are happy to be named if your idea is implemented. See Section 6 for details.'),
    h3('Email updates'),
    p('By default, you will receive an email when your idea is assessed and when its status changes. Tick the opt-out box if you prefer not to receive these emails.'),
    h3('Submission tips'),
    bullet('Be specific: vague ideas are harder to assess and less likely to be progressed'),
    bullet('Focus on the improvement, not the complaint'),
    bullet('One idea per submission: if you have several ideas, submit them separately'),
    bullet('Check your previous submissions: duplicates will be flagged'),
    h3('What the moderation gate checks'),
    p('Every submission passes through an automated review checking for: offensive language, incoherent or unactionable content, duplicate submissions, personal complaints directed at named individuals, and content unrelated to the club. If your submission does not pass, you will receive an explanation and the opportunity to resubmit.'),

    h2('4. Categories'),
    stdTable(
      ['Category', 'Covers'],
      [
        [['Course'], ['Fairways, tees, greens, rough, bunkers, drainage, course layout, signage']],
        [['Competitions & Matches'], ['Competition formats, scheduling, handicaps, matchplay, visiting teams']],
        [['Clubhouse'], ['Building fabric, changing rooms, showers, lockers, car park, entrance']],
        [['Grounds (non-course)'], ['Gardens, paths, practice areas, driving range, car park landscaping']],
        [['On-course Refreshments'], ['Halfway house, on-course snack trolley, drink stations']],
        [['Restaurant / Catering'], ['Food menu, dining room, private dining, events catering']],
        [['Bar'], ['Bar service, drinks menu, social areas, terrace']],
        [['Pro Shop'], ['Equipment, clothing, club fitting, lessons, merchandise']],
        [['Other'], ["Anything that doesn't fit the above categories"]],
      ].map(([a, b]) => [
        [{ text: a[0], bold: true }],
        b,
      ])
    ),

    h2('5. Impact levels'),
    stdTable(
      ['Option', 'Use when…'],
      [
        ['Affects all or most members', 'The improvement would be noticed and used by the majority of the membership'],
        ['Affects regular golfers', 'The improvement mainly benefits members who play regularly'],
        ['Affects specific groups', 'Mainly benefits a particular group (seniors, juniors, ladies, visitors, etc.)'],
        ['Affects occasional or visiting users only', 'Mainly benefits people who visit occasionally or rarely'],
      ]
    ),

    h2('6. Recognition'),
    pRuns([{ text: 'Named recognition: ', bold: true }, { text: 'Your name will be recorded against the idea. If it is implemented, you will be eligible for recognition awards.' }]),
    pRuns([{ text: 'Anonymous: ', bold: true }, { text: 'Your idea will be assessed exactly the same way, but your name will not be associated with it. You will not be eligible for recognition awards.' }]),

    h2('7. What happens after you submit'),
    pRuns([{ text: 'Step 1 — Moderation (immediate): ', bold: true }, { text: 'Automated check against programme guidelines.' }]),
    pRuns([{ text: 'Step 2 — AI-assisted scoring (weekly, Monday mornings): ', bold: true }, { text: 'Each idea is assessed across six dimensions:' }]),
    bullet('Member impact — based on your self-assessed impact and category'),
    bullet('Strategic alignment — how well it fits the club\'s priorities'),
    bullet('Feasibility — how realistic it is to implement'),
    bullet('Cost vs benefit — likely cost compared to benefit delivered'),
    bullet('Novelty — whether this is a fresh idea or standard practice'),
    bullet('Member experience — the material improvement to day-to-day club life'),
    gap(),
    pRuns([{ text: 'Step 3 — Committee review: ', bold: true }, { text: 'Directors review scored submissions and make decisions.' }]),
    pRuns([{ text: 'Step 4 — You are notified: ', bold: true }, { text: 'When the status of your idea changes, you receive a personalised email update.' }]),
    h3('Score bands'),
    stdTable(
      ['Band', 'What it means'],
      [
        ['Priority', 'High score — passed to the relevant director for active consideration'],
        ['Active queue', 'Good score — will be reviewed at the next committee cycle'],
        ['Holding', 'Solid idea but longer timeframe — recorded for future consideration'],
        ['Low priority', 'Noted but unlikely to be progressed in the near term'],
        ['Not progressed', 'Score was below the threshold for active consideration'],
        ['Already in our plan', 'Great minds think alike — this is already being worked on'],
      ]
    ),
    tipBox('Quick win: If your idea can be implemented quickly at low cost, it may be flagged as a Quick Win and actioned ahead of the standard review cycle regardless of its score band.'),

    h2('8. Tracking your ideas — My Improvements'),
    p('Sign in and click My improvements to see all the ideas you have submitted and their current status. Each card shows the current status, submission date, score band, committee message, target date (if confirmed), and a full status history timeline.'),
    h3('Status meanings'),
    stdTable(
      ['Status', 'Meaning'],
      [
        ['Awaiting Decision', 'Submitted and assessed — awaiting committee decision'],
        ['Under Consideration', 'The committee is actively reviewing this'],
        ['In Plan', 'Included in the club\'s improvement plan'],
        ['Approved', 'Approved for implementation — pending action'],
        ['Implemented', 'Done! Your idea has been put into practice'],
        ['Not Progressed', 'The committee has decided not to progress this at this time'],
        ['Withdrawn', 'You chose to withdraw this submission'],
      ]
    ),

    h2('9. Email updates'),
    stdTable(
      ['Email', 'When sent'],
      [
        ['Assessment update', 'After the weekly scoring run — tells you your score band and committee message'],
        ['Status change', 'When a director changes the status of your idea'],
        ['Withdrawal confirmation', 'When you withdraw a submission'],
      ]
    ),
    pRuns([{ text: 'All emails are sent from ' }, { text: 'noreply@bramleygolfclub.co.uk', bold: true }, { text: '. Add this to your safe senders list to avoid emails going to spam.' }]),

    h2('10. Withdrawing a submission'),
    p('You can withdraw any submitted idea from the My Improvements page, provided it has not already been Implemented.'),
    numbered('Go to My Improvements'),
    numbered('Find the submission you want to withdraw'),
    numbered('Click Withdraw this idea at the bottom of the card'),
    numbered('Confirm when prompted'),
    gap(),
    warnBox('Withdrawal cannot be undone. If you change your mind, you can resubmit your idea as a new submission.'),

    h2('11. Privacy and data'),
    bullet('Your name and email address are stored securely against your member ID'),
    bullet('Your email is used only for programme communications — never shared with third parties'),
    bullet('If you choose anonymous recognition, your name is not displayed to committee members'),
    bullet('Data is stored on secure cloud infrastructure and backed up regularly'),
    bullet('You may request deletion of your submissions by contacting the Club Manager'),

    h2('12. Frequently asked questions'),
    pRuns([{ text: 'Can I submit more than one idea? ', bold: true }, { text: 'Yes. There is no limit. Each is assessed independently.' }]),
    gap(),
    pRuns([{ text: 'How long does assessment take? ', bold: true }, { text: 'Scoring runs every Monday morning. Submit on Tuesday and your idea will typically be assessed the following Monday.' }]),
    gap(),
    pRuns([{ text: 'Why was my submission rejected? ', bold: true }, { text: 'Most common reasons: too vague, duplicate of a previous submission, or content that doesn\'t meet guidelines. You will receive an explanation and, in most cases, the chance to resubmit.' }]),
    gap(),
    pRuns([{ text: 'Can I edit my submission after sending it? ', bold: true }, { text: 'No. Once submitted, ideas cannot be edited. Withdraw the submission and resubmit with corrected information.' }]),
    gap(),
    pRuns([{ text: 'My idea was not progressed — can I resubmit it? ', bold: true }, { text: 'Yes. If circumstances have changed, or if you have new information that strengthens the case, you are welcome to resubmit.' }]),
    gap(),
    pRuns([{ text: 'What does "Quick win" mean? ', bold: true }, { text: 'An idea that can be implemented within approximately 4 weeks at a cost under approximately £500. These may be actioned ahead of the standard review cycle.' }]),
    gap(),
    pRuns([{ text: 'I haven\'t received any emails — what should I do? ', bold: true }, { text: 'Check your spam folder for emails from noreply@bramleygolfclub.co.uk. If you cannot find them, contact the Club Manager.' }]),
    gap(),
    pRuns([{ text: 'How do I contact someone about my submission? ', bold: true }, { text: 'Contact the Club Manager directly.' }]),
    hr(),
    p('Bramley Golf Club — Continuous Improvement Programme  ·  Member Guide v1.0  ·  June 2026', { color: '888888' }),
    p('For assistance, contact the Club Manager', { color: '888888' }),
  ]
  return docSettings('Member Guide', [children])
}

// ---------------------------------------------------------------------------
// COMMITTEE GUIDE
// ---------------------------------------------------------------------------
function buildCommitteeGuide() {
  const children = [
    h1('Bramley Golf Club'),
    subtitle('Continuous Improvement Programme — Committee & Director Guide'),
    version('Version 1.0  ·  June 2026'),
    hr(),

    h2('1. Programme overview'),
    p('The CIP collects, scores, and prioritises member improvement ideas using an AI-assisted structured assessment process. The workflow is:'),
    numbered('Member submits an idea via the programme website'),
    numbered('Automated moderation checks the submission for appropriateness'),
    numbered('Weekly AI scoring assesses every unscored submission across six weighted dimensions, producing a score out of 10'),
    numbered('Triage report presents scored submissions to directors for decision'),
    numbered('Directors act — change statuses, assign owners, set target dates'),
    numbered('Members are notified automatically by email when the status of their idea changes'),
    gap(),

    h2('2. Roles and access levels'),
    stdTable(
      ['Role', 'Sees in triage', 'Can change status', 'Admin panel'],
      [
        ['Golf Director', 'Course, Competitions & Matches', 'No', 'No'],
        ['Estate Director', 'Clubhouse, Grounds, Refreshments', 'No', 'No'],
        ['F&B Director', 'Restaurant, Bar, Refreshments', 'No', 'No'],
        ['Commercial Director', 'Pro Shop', 'No', 'No'],
        ['Operations Manager', 'All categories', 'No', 'No'],
        ['Chairman / Chair', 'All categories', 'No', 'No'],
        ['Club Manager', 'All categories', 'Yes', 'Yes'],
        ['Super Admin', 'All categories', 'Yes', 'Yes (full)'],
      ]
    ),

    h2('3. Signing in'),
    p('Directors sign in using a 6-digit PIN assigned by the Club Manager.'),
    numbered('Go to the programme website'),
    numbered('Click Committee / Directors'),
    numbered('Enter your PIN and click Sign in'),
    gap(),
    infoBox('Forgotten your PIN? Contact the Club Manager, who can reset your PIN from the Admin panel. A new PIN will be generated and communicated to you securely.'),
    warnBox('Locked out? After 5 failed attempts, access is locked for 15 minutes.'),
    tipBox('Sessions last 8 hours. In the triage report, an inactivity warning appears after 110 minutes and you are signed out automatically at 120 minutes.'),

    h2('4. The triage report'),
    p('After signing in, you are taken directly to the Triage Report — the main working view for directors.'),
    h3('Ordering'),
    p('Submissions are ordered by: (1) Health & Safety flagged items first; (2) Score, highest first; (3) Date submitted, most recent first for equal scores.'),
    h3('Summary bar'),
    p('At the top of the report, a summary bar shows submission counts by status. Click any status chip to filter.'),
    h3('Flags'),
    stdTable(
      ['Flag', 'Meaning'],
      [
        ['⚠ H&S', 'Health & Safety dimension — requires attention'],
        ['⚡ Quick win', 'Low cost, fast to implement — may be actioned ahead of schedule'],
        ['💰 Revenue', 'Potential to generate new income for the club'],
        ['🔄 Recurring', 'This theme has appeared in previous triage runs'],
        ['⬆ High cost', 'Estimated cost exceeds the committee escalation threshold'],
        ['👤 Owner', 'Suggested owner role assigned'],
      ]
    ),

    h2('5. Understanding scores and bands'),
    h3('Score dimensions'),
    stdTable(
      ['Dimension', 'Weight', 'What it measures'],
      [
        ['Member impact', '25%', 'How many members benefit, scaled by category ceiling'],
        ['Strategic alignment', '20%', 'Fit with the club\'s strategic priorities'],
        ['Feasibility', '20%', 'Realistic to implement at a private members club'],
        ['Cost vs benefit', '15%', 'Estimated cost against benefit delivered'],
        ['Novelty', '10%', 'Fresh idea vs standard practice already in place'],
        ['Member experience delta', '10%', 'Material improvement to day-to-day experience'],
      ]
    ),
    h3('Multipliers'),
    stdTable(
      ['Multiplier', 'Factor', 'Applies when'],
      [
        ['H&S dimension', '×1.5', 'Submission has a safety or compliance aspect'],
        ['Budget year alignment', '×1.2', 'Implementable in the current financial year'],
        ['Cross-category', '×1.1', 'Benefits span multiple categories'],
      ]
    ),
    h3('Cluster consensus bonus'),
    p('When multiple submissions address the same specific issue, each receives an additive bonus: 2 in cluster +0.5; 3 in cluster +1.0; 4 in cluster +1.5; 5 or more +2.0.'),
    h3('Score bands'),
    stdTable(
      ['Band', 'Score range'],
      [
        ['Priority', '≥ 8.0'],
        ['Active queue', '≥ 6.0'],
        ['Holding', '≥ 4.0'],
        ['Low priority', '≥ 2.0'],
        ['Not progressed', '< 2.0'],
      ]
    ),
    tipBox('All thresholds, weights, and multipliers are configurable by the Club Manager in Admin → Scoring Config.'),

    h2('6. Views — Card view and Spreadsheet view'),
    pRuns([{ text: 'Card view: ', bold: true }, { text: 'Each submission shown as a detailed card. Best for reviewing individual submissions in depth.' }]),
    pRuns([{ text: 'Spreadsheet view: ', bold: true }, { text: 'Compact table, one row per submission. Click any row to open a side panel with full detail. Best for getting an overview quickly.' }]),
    p('Toggle between views using the buttons in the top right. Your preference is saved automatically.'),

    h2('7. Filters and search'),
    bullet('Search: filter by description, benefit, AI summary, or member name'),
    bullet('Status filter: click any status chip in the summary bar'),
    bullet('Flag filter: filter by Quick wins, H&S, Revenue, Recurring, In Plan, or High cost'),
    bullet('Owner filter: show only submissions assigned to a particular director role'),
    bullet('Category filter: available to Club Manager / Super Admin who see all categories'),
    bullet('Show withdrawn: withdrawn submissions are hidden by default — tick to include them'),

    h2('8. Managing submissions'),
    infoBox('Only the Club Manager and Super Admin can perform the actions in this section.'),
    h3('Changing status'),
    stdTable(
      ['Status', 'Use when'],
      [
        ['Awaiting Decision', 'Default — no decision made yet'],
        ['Under Consideration', 'Actively being reviewed by the committee'],
        ['In Plan', 'Included in the club improvement plan'],
        ['Approved', 'Approved for implementation'],
        ['Implemented', 'Completed'],
        ['Not Progressed', 'Will not be taken forward at this time'],
      ]
    ),
    tipBox('When you change status to Under Consideration, Approved, or In Plan, you will be prompted to enter a target date. The AI\'s suggested date is pre-filled for convenience.'),
    infoBox('Member notification: When you change a submission\'s status, the member automatically receives a personalised AI-generated email. Director notes are never included in member emails.'),
    h3('Deleting a submission'),
    p('The Delete option soft-deletes a submission — it disappears from all views. Submissions with status Approved or Implemented cannot be deleted.'),
    h3('Changing category'),
    p('Use the Category dropdown to reassign a submission to a different category. This also changes which director sees it.'),

    h2('9. Target dates'),
    pRuns([{ text: 'AI suggested date: ', bold: true }, { text: 'Calculated from the implementation time estimate; shown as a reference.' }]),
    pRuns([{ text: 'Confirmed target date: ', bold: true }, { text: 'Set by the Club Manager when changing status, shown with a ✓ confirmed indicator. Visible to the member in their My Improvements page.' }]),

    h2('10. Director notes'),
    p('Each submission has a Notes field visible only to directors — never to members. Use this to record context from committee discussions, budget considerations, dependencies, or decisions. Notes are saved automatically.'),

    h2('11. Score override'),
    p('The Club Manager can override the AI-generated score if the committee believes the automated assessment does not reflect the full picture.'),
    numbered('Open the submission detail panel'),
    numbered('Find the Score override section'),
    numbered('Enter the override score (0–10) and a reason'),
    numbered('Click Apply'),
    gap(),
    p('The override score replaces the AI score for display and filtering. The original AI score is preserved. All overrides are logged in the audit trail with the director\'s name, new score, and reason.'),

    h2('12. Audit trail'),
    p('Every submission has a complete audit trail recording every status change and score override. Open a submission and scroll to the Audit trail section. Each entry shows: previous status, new status, who made the change, when, and any note. The audit trail cannot be edited or deleted.'),

    h2('13. Owner assignment'),
    p('The AI recommends a suggested owner role for each submission. The Club Manager can assign or change the owner using the Owner dropdown.'),
    p('Available owner roles: Golf Director, Estate Director, F&B Director, Commercial Director, Club Manager, Chairman.'),

    h2('14. Tracking approved improvements'),
    stdTable(
      ['Field', 'Purpose'],
      [
        ['Target date', 'Committee-confirmed implementation date'],
        ['Responsible person', 'Named individual leading the work'],
        ['Budget year', 'Financial year in which cost falls'],
        ['Actual cost', 'Recorded once implementation is complete'],
        ['Tracking notes', 'Free-text progress updates'],
      ]
    ),

    h2('15. Email reports'),
    pRuns([{ text: 'Weekly triage report: ', bold: true }, { text: 'After each scoring run (Monday mornings), every director with email reports enabled receives a report covering their categories. H&S items appear first.' }]),
    pRuns([{ text: 'Immediate high-score alert: ', bold: true }, { text: 'If any submission scores 9.0 or above, the relevant director receives an immediate email alert.' }]),
    pRuns([{ text: 'H&S alert: ', bold: true }, { text: 'If any submission has a Health & Safety dimension, an urgent alert is sent immediately to the Club Manager.' }]),
    p('Email reports can be toggled per director in Admin → Directors.'),

    h2('16. My Improvements — the member view'),
    pRuns([{ text: 'Members do not see: ', bold: true }, { text: 'numerical score, director notes.' }]),
    pRuns([{ text: 'Members do see: ', bold: true }, { text: 'score band label, committee message, confirmed target date, full status history.' }]),

    h2('17. Session security'),
    bullet('Director sessions last 8 hours from sign-in'),
    bullet('Inactivity warning appears after 110 minutes'),
    bullet('Session ends automatically after 120 minutes of inactivity'),
    bullet('Any mouse movement, keystroke, click, or scroll resets the inactivity timer'),

    pageBreak(),
    h2('18. Super Admin — Admin panel'),
    infoBox('Access: Club Manager and Super Admin only. Reach the Admin panel via the Admin link in the triage report header.'),

    h3('18.1 Scoring Config tab'),
    p('Controls all AI scoring parameters. Changes take effect at the next triage run.'),
    bullet('Triage schedule: TRIAGE_INTERVAL_DAYS — days between scoring runs (default: 7)'),
    bullet('Scoring weights: six dimension weights, should sum to 1.0'),
    bullet('Score multipliers: H&S, Budget year, Multi-category'),
    bullet('Score band thresholds: minimum score for Priority, Active, Holding, Low'),
    bullet('Category impact ceilings: maximum member impact score per category'),
    bullet('Cluster consensus bonuses: additive bonuses for cluster sizes 2, 3, 4, 5+'),
    bullet('Cost & implementation thresholds: committee escalation threshold, quick win cost threshold, quick win implementation weeks'),
    gap(),

    h3('18.2 Communications tab'),
    pRuns([{ text: 'Communication tone: ', bold: true }, { text: 'Friendly (warm, personal) or Formal (professional, official)' }]),
    pRuns([{ text: 'Email sign-off: ', bold: true }, { text: 'The name used to sign off all member emails' }]),

    h3('18.3 Directors tab'),
    h4('Adding a director'),
    numbered('Enter the director\'s full name, email address, and role'),
    numbered('Click Add director'),
    numbered('A secure 6-digit PIN is generated automatically and shown once in an amber banner'),
    numbered('Note the PIN and communicate it to the director securely — it cannot be retrieved again'),
    gap(),
    h4('Editing a director'),
    p('Click Edit on any director to change their name, email, or role. Click Reset PIN to generate a new PIN shown once.'),
    h4('Removing a director'),
    p('Click Remove to permanently delete the director record. Alternatively, toggle Active/Inactive to block sign-in while preserving the audit trail record.'),
    gap(),
    infoBox('Security: PINs are never stored in plain text — only a cryptographic hash is stored. If a PIN is lost, use Reset PIN to generate a new one.'),

    h3('18.4 Dashboard tab'),
    p('A read-only programme overview. Click Refresh to update.'),
    bullet('Summary statistics: total scored, average score, quick wins, in-plan + approved count'),
    bullet('Submissions by status (table)'),
    bullet('Submissions by category with average score (table)'),
    bullet('Score band distribution (table)'),

    h3('18.5 Setup tab'),
    h4('Initialise database'),
    p('Run after every deployment that includes database changes. Safe to run repeatedly — existing data is never deleted, only missing tables and columns are added.'),
    warnBox('Always run this after a major update before using the system.'),
    h4('Run triage now'),
    p('Manually triggers the AI scoring batch. Allow 30–90 seconds. Do not navigate away during the run.'),
    h4('Backup & restore'),
    bullet('Export CSV: downloads submissions as CSV, suitable for Excel or submission-only restore'),
    bullet('Full backup (JSON): complete snapshot of all tables — store securely for disaster recovery'),
    bullet('Restore from CSV: upload a previously exported CSV to restore submission records — upserts only, no deletions'),
    gap(),
    infoBox('Full JSON restore: if the app itself is down, use the standalone restore script: node scripts/restore.js <backup-file.json> from your computer. See the continuity guide for details.'),
    h4('Test data'),
    bullet('Seed test data: inserts 12 pre-written test submissions covering all scenarios'),
    bullet('Clear test data: removes all test submissions and cleans up orphaned clusters'),
    h4('Reset scores for re-triage'),
    bullet('Reset test data only: resets scores for test submissions only'),
    bullet('Reset all submissions: resets every submission — use if you have changed scoring weights and want to re-score everything'),
    gap(),
    dangerBox('Caution: "Reset all submissions" affects every record including real member data. Confirm carefully before proceeding.'),

    h2('19. Frequently asked questions'),
    pRuns([{ text: 'A member says they never received an email — what should I check? ', bold: true }, { text: 'Ask them to check spam for emails from noreply@bramleygolfclub.co.uk. If they opted out at submission time, they won\'t receive updates for that submission.' }]),
    gap(),
    pRuns([{ text: 'Can I see who submitted an anonymous idea? ', bold: true }, { text: 'No. This is intentional and cannot be overridden.' }]),
    gap(),
    pRuns([{ text: 'A submission has been scored incorrectly — what can I do? ', bold: true }, { text: 'Use the Score override feature to set a corrected score and record your reason. All overrides are logged in the audit trail.' }]),
    gap(),
    pRuns([{ text: 'Can I move a submission to a different director\'s category? ', bold: true }, { text: 'Yes. Use the Category dropdown in the submission detail to reassign it.' }]),
    gap(),
    pRuns([{ text: 'A director has left — how do I remove their access? ', bold: true }, { text: 'Go to Admin → Directors, find their record, and click Remove. Alternatively, toggle to Inactive to block sign-in while preserving the audit trail.' }]),
    gap(),
    pRuns([{ text: 'The database seems to be missing columns after an update — what do I do? ', bold: true }, { text: 'Go to Admin → Setup → Initialise database. This adds any missing columns without affecting existing data.' }]),
    hr(),
    p('Bramley Golf Club — Continuous Improvement Programme  ·  Committee & Director Guide v1.0  ·  June 2026', { color: '888888' }),
    p('For technical support, contact the system administrator  ·  For programme queries, contact the Club Manager', { color: '888888' }),
  ]
  return docSettings('Committee & Director Guide', [children])
}

// ---------------------------------------------------------------------------
// CONTINUITY GUIDE
// ---------------------------------------------------------------------------
function buildContinuityGuide() {
  const children = [
    h1('Bramley Golf Club'),
    subtitle('Continuous Improvement Programme — System Continuity Guide'),
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: 'What to do if the developer is unavailable', size: 28, color: RED, bold: true })],
    }),
    version('Prepared by John de Wit  ·  June 2026  ·  For: Club Chairman and Club Manager'),
    hr(),

    callout(
      'Why this document exists',
      'The CIP system was built and is maintained by John de Wit, a club member. This document tells you everything you need to know to keep the system running, deal with problems, and — if necessary — hand it to someone else. You do not need a technical background to follow these instructions.\n\nKeep this document somewhere safe and accessible. It contains no passwords (for security reasons) but tells you exactly where everything lives and who to contact.',
      NAVY, 'e8f0f8'
    ),

    h2('1. What the system is and where it runs'),
    p('The CIP is a web application. It runs entirely in the cloud — there is no server in the clubhouse, no local computer involved, and nothing that needs to be switched on or maintained physically.'),
    stdTable(
      ['Component', 'What it is', 'Where it is'],
      [
        ['The application', 'The website members and directors use', 'Vercel (cloud hosting)'],
        ['The database', 'All submissions, scores, members, config', 'Neon (cloud database)'],
        ['The code', 'The source files that make the app work', 'GitHub (code repository)'],
        ['Email sending', 'Sends emails to members and directors', 'Resend (email service)'],
        ['AI scoring', 'The intelligence behind the scoring', 'Anthropic Claude API'],
      ]
    ),
    p('The website address is: https://bramley-bci.vercel.app'),
    p('The system runs two automatic tasks every week:'),
    bullet('Monday 07:00 — scores all new member submissions and emails directors'),
    bullet('Sunday 06:00 — emails a data backup to the Club Manager'),

    h2('2. The accounts you need access to'),
    p('Five online accounts keep the system alive. Credentials should be stored securely in the club\'s password manager or a sealed envelope kept by the Secretary.'),

    h3('GitHub — github.com'),
    p('Stores all the code and documentation. The repository is johnnydw-bit/BCI.'),
    pRuns([{ text: 'If lost: ', bold: true }, { text: 'A new developer can fork the code and continue independently.' }]),

    h3('Vercel — vercel.com'),
    p('Hosts the website and runs the automatic weekly tasks. The following secret values are stored here and are required for the app to function:'),
    bullet('DATABASE_URL — connects to the database'),
    bullet('ANTHROPIC_API_KEY — connects to the AI scoring service'),
    bullet('RESEND_API_KEY — connects to the email service'),
    bullet('MANAGER_EMAIL — the Club Manager\'s email for alerts and backups'),
    bullet('EMAIL_FROM — the sending email address'),
    bullet('NEXT_PUBLIC_APP_URL — the website address'),
    gap(),
    pRuns([{ text: 'If lost: ', bold: true }, { text: 'The app stops working. The database (Neon) is separate so data is safe, but the app needs to be redeployed with the correct values above.' }]),

    h3('Neon — neon.tech'),
    pRuns([{ text: 'This is where all the data lives. ', bold: true }, { text: 'Even if everything else fails, the data here is safe as long as this account is intact.' }]),
    pRuns([{ text: 'If lost: ', bold: true }, { text: 'A new database can be created and all data restored from a JSON backup file.' }]),

    h3('Resend — resend.com'),
    p('Sends all emails to members and directors.'),
    pRuns([{ text: 'If lost: ', bold: true }, { text: 'Emails stop sending. The app still works. A new Resend account can be set up quickly.' }]),

    h3('Anthropic — console.anthropic.com'),
    p('The AI that scores submissions and generates member emails.'),
    pRuns([{ text: 'If lost: ', bold: true }, { text: 'The scoring process stops working. The app\'s data and member portal still work. A new API key from a new account restores full function.' }]),

    gap(),
    callout(
      'Action recommended now — while John is available',
      'Ask John to add the Club Manager as a collaborator on the Vercel project and the GitHub repository. This costs nothing and means you have direct access without needing John\'s personal login credentials.',
      AMBER, 'fff3cd'
    ),

    h2('3. Day-to-day operation — what runs automatically'),
    stdTable(
      ['When', 'What happens automatically'],
      [
        ['Monday 07:00', 'New submissions are scored; directors receive email reports; high-scoring items (9+/10) trigger immediate alerts; H&S items are flagged to the Club Manager'],
        ['Sunday 06:00', 'A CSV data backup is emailed to the Club Manager'],
      ]
    ),
    p('The only regular human tasks are:'),
    bullet('Directors review the triage report at their convenience after Monday morning'),
    bullet('Club Manager acts on submissions — changing statuses, setting target dates, assigning owners'),
    bullet('Club Manager periodically downloads a full JSON backup (Admin → Setup → Full backup) and stores it somewhere safe'),

    h2('4. What the Club Manager can do without a developer'),
    stdTable(
      ['Task', 'Where in the app'],
      [
        ['Add or remove directors', 'Admin → Directors'],
        ['Reset a director\'s PIN', 'Admin → Directors → Edit → Reset PIN'],
        ['Change scoring weights and thresholds', 'Admin → Scoring Config'],
        ['Change email tone and sign-off name', 'Admin → Communications'],
        ['View dashboard statistics', 'Admin → Dashboard'],
        ['Download a full data backup', 'Admin → Setup → Full backup (JSON)'],
        ['Restore submissions from a CSV backup', 'Admin → Setup → Restore from CSV'],
        ['Run the triage scoring manually', 'Admin → Setup → Run triage now'],
        ['Add new database columns after an update', 'Admin → Setup → Initialise database'],
      ]
    ),

    h2('5. What requires a developer'),
    stdTable(
      ['Task', 'Difficulty'],
      [
        ['Adding a new feature to the app', 'Medium–High'],
        ['Changing which categories exist', 'Low — a code change and redeploy'],
        ['Adding a new director role', 'Low — a code change and redeploy'],
        ['Changing the AI scoring approach', 'Low — a code change and redeploy'],
        ['Fixing a bug or error', 'Low–Medium depending on the issue'],
        ['Setting up a custom domain name', 'Low'],
        ['Upgrading to a paid hosting tier', 'Low — account change only'],
        ['Restoring from a full JSON backup if the app is down', 'Low — run a script (see Section 7)'],
      ]
    ),

    h2('6. If the system stops working'),
    h3('The app shows a blank page or error'),
    numbered('Wait 5 minutes and try again — Vercel occasionally has brief hiccups'),
    numbered('If it persists, log in to Vercel (vercel.com) and check the deployment status and error logs'),
    numbered('If the errors mention "database" or "column does not exist" — run Admin → Setup → Initialise database'),
    numbered('If you cannot log in at all, try opening the browser console (press F12, click Console) and paste the init-db command — a developer can provide this'),
    h3('Emails have stopped arriving'),
    numbered('Check the Resend dashboard for delivery errors'),
    numbered('Check the RESEND_API_KEY in Vercel\'s environment variables is still valid'),
    numbered('Check the free tier limit hasn\'t been reached (100 emails/day on free tier)'),
    h3('The scoring (triage) is failing'),
    numbered('Check the Anthropic dashboard for API errors or billing issues'),
    numbered('Check the ANTHROPIC_API_KEY in Vercel\'s environment variables is still valid'),
    numbered('The AI has usage costs — check the account is funded'),

    h2('7. Emergency data recovery'),
    stdTable(
      ['Backup type', 'How often', 'Where'],
      [
        ['CSV backup', 'Automatically every Sunday', 'Emailed to Club Manager'],
        ['Full JSON backup', 'On demand — download from Admin → Setup', 'Wherever you saved it'],
      ]
    ),
    warnBox('Important: The JSON backup is far more complete than the CSV. Store JSON backups somewhere safe outside the app — email them to yourself, save to a USB drive, or upload to OneDrive or Google Drive.'),
    h3('If data is corrupted or accidentally deleted (app is still working)'),
    numbered('Go to Admin → Setup → Restore from CSV and upload the most recent CSV backup'),
    numbered('This restores submission records — it updates or inserts without deleting anything'),
    h3('If the database is lost or destroyed (full recovery)'),
    p('You need: a full JSON backup file, a computer with Node.js installed, and the DATABASE_URL from the Neon account.'),
    numbered('Create a new database in Neon if the old one is gone'),
    numbered('Open a terminal in the project folder'),
    numbered('Run: node scripts/restore.js path\\to\\your-backup.json'),
    numbered('The script reconnects all the data and prints a summary'),
    gap(),
    p('A developer can complete this in under 30 minutes with a recent backup.'),

    h2('8. Finding a replacement developer'),
    h3('What to tell a new developer'),
    bullet('Stack: Next.js 15, TypeScript, Tailwind CSS, hosted on Vercel'),
    bullet('Database: PostgreSQL via Neon (serverless)'),
    bullet('AI: Anthropic Claude (claude-sonnet for scoring, claude-haiku for emails)'),
    bullet('Email: Resend'),
    bullet('Repo: github.com/johnnydw-bit/BCI (private)'),
    bullet('Docs: full documentation in the docs/ folder of the repository'),
    h3('Cost of the system'),
    stdTable(
      ['Service', 'Current tier', 'Monthly cost'],
      [
        ['Vercel', 'Free (Hobby)', '£0'],
        ['Neon', 'Free', '£0'],
        ['Anthropic', 'Pay-per-use', '~£2–£10'],
        ['Resend', 'Free (3,000 emails/month)', '£0'],
        ['GitHub', 'Free', '£0'],
        ['Total', '', '~£2–£10/month'],
      ]
    ),
    h3('Where to find a developer'),
    bullet('First: ask among club members — there may be someone with relevant skills'),
    bullet('Local: a local web development agency or freelancer'),
    bullet('Online: Upwork, Toptal, or Codementor — search "Next.js developer"'),
    bullet('Estimated cost: £50–£150/hour; the system is well-documented and minimal time is needed for routine updates'),

    h2('9. Handing the system over'),
    h3('Step 1 — Transfer the code repository'),
    p('In GitHub: Settings → Danger Zone → Transfer ownership. Transfer BCI to the new developer\'s GitHub account, or to a club-owned GitHub organisation.'),
    h3('Step 2 — Transfer the Vercel project'),
    p('Add the new developer as a team member on Vercel, or redeploy under their account with the same environment variables.'),
    h3('Step 3 — Transfer the Neon database'),
    p('Add the new developer as a collaborator, or provide the DATABASE_URL connection string.'),
    h3('Step 4 — Transfer Resend and Anthropic accounts'),
    p('Add the new developer, or let them set up their own accounts and update the API keys in Vercel.'),
    h3('Step 5 — Test everything'),
    p('After transfer: run Initialise Database, seed test data, run a manual triage, verify emails are sending.'),

    pageBreak(),
    h2('10. Summary — the one-page version'),

    callout('The system runs itself', 'Triage happens every Monday. Backups are emailed every Sunday. Directors review the report and make decisions. The Club Manager acts through the Admin panel. No IT involvement needed for routine operation.', NAVY, 'e8f0f8'),

    h3('If something goes wrong — in order'),
    numbered('Wait a few minutes and try again'),
    numbered('Log in to Admin and run "Initialise database"'),
    numbered('Check the Vercel dashboard for error messages'),
    numbered('Check Anthropic and Resend accounts for billing or quota issues'),
    numbered('If data is lost — restore from the JSON backup using the restore script'),
    numbered('Call a developer'),

    h3('The essential checklist — do these now, while John is available'),
    bullet('Login credentials for Vercel, Neon, GitHub, Resend, and Anthropic stored securely'),
    bullet('Club Manager added as a Vercel collaborator'),
    bullet('Club Manager added as a GitHub collaborator'),
    bullet('A recent full JSON backup stored outside the app (email, USB, cloud storage)'),
    bullet('This document stored somewhere accessible to Chairman and Club Manager'),
    bullet('John\'s personal contact details recorded separately'),

    gap(),
    tipBox('Remember: even in an emergency, a quick call or message to John is almost always the fastest resolution. This document is for the scenario where that isn\'t possible.'),

    hr(),
    p('Bramley Golf Club — Continuous Improvement Programme  ·  System Continuity Guide v1.0  ·  June 2026', { color: '888888' }),
    p('Prepared by John de Wit  ·  Review annually or after any major system change', { color: '888888' }),
  ]
  return docSettings('System Continuity Guide', [children])
}

// ---------------------------------------------------------------------------
// Generate files
// ---------------------------------------------------------------------------
async function main() {
  const outDir = path.join(__dirname, '..', 'docs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  console.log('Building member-guide.docx...')
  const memberDoc = buildMemberGuide()
  const memberBuf = await Packer.toBuffer(memberDoc)
  fs.writeFileSync(path.join(outDir, 'member-guide.docx'), memberBuf)
  console.log('  ✓ docs/member-guide.docx')

  console.log('Building committee-guide.docx...')
  const committeeDoc = buildCommitteeGuide()
  const committeeBuf = await Packer.toBuffer(committeeDoc)
  fs.writeFileSync(path.join(outDir, 'committee-guide.docx'), committeeBuf)
  console.log('  ✓ docs/committee-guide.docx')

  console.log('Building continuity-guide.docx...')
  const continuityDoc = buildContinuityGuide()
  const continuityBuf = await Packer.toBuffer(continuityDoc)
  fs.writeFileSync(path.join(outDir, 'continuity-guide.docx'), continuityBuf)
  console.log('  ✓ docs/continuity-guide.docx')

  console.log('\nDone. Open the .docx files in Word or upload to Google Docs.')
}

main().catch((e) => { console.error(e); process.exit(1) })
