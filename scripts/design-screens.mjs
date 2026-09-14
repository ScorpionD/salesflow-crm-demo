// Editable vector design assets imported into Figma before React implementation.
import fs from 'node:fs/promises';
const out = new URL('../design/screens/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const C = {
  bg: '#F7F8FA',
  white: '#FFFFFF',
  ink: '#172033',
  muted: '#64748B',
  line: '#E2E8F0',
  primary: '#4F46E5',
  soft: '#EEF2FF',
  nav: '#111827',
  green: '#059669',
  amber: '#D97706',
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r = (x, y, w, h, fill = C.white, rad = 12, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${fill}" stroke="${stroke}"/>`;
const t = (x, y, s, size = 14, fill = C.ink, weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(s)}</text>`;
const line = (x, y, w) => `<path d="M${x} ${y}h${w}" stroke="${C.line}"/>`;
const btn = (x, y, label, w = 142, primary = true) =>
  `<g id="Button-${esc(label)}">${r(x, y, w, 40, primary ? C.primary : C.white, 8, primary ? 'none' : C.line)}${t(x + 16, y + 25, label, 13, primary ? C.white : C.ink, 600)}</g>`;
const badge = (x, y, s, color = C.primary) =>
  r(
    x,
    y,
    s.length * 7 + 20,
    24,
    color === C.green ? '#ECFDF5' : color === C.amber ? '#FFFBEB' : C.soft,
    6,
  ) + t(x + 10, y + 16, s, 11, color, 600);
const nav = [
  'Dashboard',
  'Contacts',
  'Companies',
  'Pipeline',
  'Tasks',
  'Reports',
  'Activity',
  'Team & settings',
];
function shell(title, sub, active = title) {
  let s =
    r(0, 0, 1440, 1050, C.bg, 0) +
    r(0, 0, 224, 1050, C.nav, 0) +
    r(224, 0, 1216, 72, C.white, 0) +
    r(24, 24, 32, 32, C.primary, 8) +
    t(34, 46, 'S', 20, C.white, 700) +
    t(66, 47, 'SalesFlow', 22, C.white, 700) +
    t(24, 108, 'NORTHLINE WORKSPACE', 10, '#94A3B8', 600);
  nav.forEach((n, i) => {
    if (n === active) s += r(12, 128 + i * 48, 200, 42, '#283044', 8);
    s +=
      t(
        30,
        154 + i * 48,
        ['◈', '○', '▤', '▥', '✓', '▥', '◷', '⚙'][i],
        17,
        n === active ? '#A5B4FC' : '#94A3B8',
      ) + t(60, 154 + i * 48, n, 13, n === active ? C.white : '#CBD5E1', n === active ? 600 : 400);
  });
  s +=
    r(16, 958, 192, 70, '#1E293B', 10) +
    t(30, 984, 'MC', 13, '#C7D2FE', 700) +
    t(65, 984, 'Maya Chen', 13, C.white, 600) +
    t(65, 1004, 'Sales Manager', 11, '#94A3B8') +
    t(256, 43, 'Workspace / ' + title, 13, C.muted) +
    badge(1130, 24, 'Live updates', C.green) +
    t(1327, 46, 'MC', 14, C.primary, 700) +
    t(256, 127, title, 30, C.ink, 700) +
    t(256, 154, sub, 14, C.muted);
  return s;
}
const card = (x, y, w, h) => r(x, y, w, h, C.white, 12, C.line);
const heading = (x, y, h, sub) =>
  t(x, y, h, 17, C.ink, 600) + (sub ? t(x, y + 24, sub, 12, C.muted) : '');
const field = (x, y, label, value, w = 260) =>
  t(x, y, label, 12, C.muted, 500) +
  r(x, y + 12, w, 42, C.white, 8, C.line) +
  t(x + 12, y + 39, value, 14);
const names = [
  'Riley Park',
  'Taylor Brooks',
  'Casey Rivera',
  'Morgan Blake',
  'Jamie Ellis',
  'Avery Quinn',
];
const companies = [
  'Alder Studio',
  'Harbor Logistics',
  'Maple Consulting',
  'Summit Labs',
  'Cedar Works',
  'Northstar Media',
];
const cols = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
async function save(name, body, w = 1440, h = 1050) {
  await fs.writeFile(
    new URL(name + '.svg', out),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${name}</title>${body}</svg>`,
  );
}
let s =
  r(0, 0, 1440, 1050, C.bg, 0) +
  r(72, 60, 36, 36, C.primary, 8) +
  t(83, 85, 'S', 22, C.white, 700) +
  t(120, 86, 'SalesFlow', 24, C.ink, 700) +
  badge(1110, 64, 'WORKING CRM DEMO');
s +=
  t(110, 198, 'Better sales conversations.', 44, C.ink, 700) +
  t(110, 250, 'A clearer path to won.', 44, C.primary, 700) +
  t(
    110,
    290,
    'Contacts, deals and next actions — connected in one focused workspace.',
    18,
    C.muted,
  ) +
  t(
    110,
    322,
    'Choose a role. Explore a private, fictional sales dataset. No sign-up needed.',
    15,
    C.muted,
  );
['Sales Manager', 'Sales Representative', 'Viewer'].forEach((role, i) => {
  const x = 110 + i * 414;
  s +=
    card(x, 380, 390, 268) +
    badge(x + 24, 405, ['FULL WORKSPACE', 'YOUR OPPORTUNITIES', 'READ ONLY'][i]) +
    t(x + 24, 476, role, 23, C.ink, 600) +
    t(
      x + 24,
      515,
      [
        'Manage deals, assignments and reports.',
        'Work your deals, tasks and follow-ups.',
        'Explore pipeline and team activity.',
      ][i],
      14,
      C.muted,
    ) +
    t(
      x + 24,
      541,
      [
        'Review the team and Won automation.',
        'Update stages and add useful notes.',
        'All changes are blocked on the server.',
      ][i],
      13,
      C.muted,
    ) +
    btn(x + 24, 574, 'Enter as ' + ['Manager', 'Representative', 'Viewer'][i], 342);
});
s +=
  t(110, 705, 'Private demo workspace · 24-hour retention · Synthetic data only', 13, C.muted) +
  heading(
    110,
    780,
    'What this demo solves',
    'Contact management · Sales pipeline · Tasks · Team visibility · Reports · Automation',
  ) +
  heading(
    110,
    863,
    'Designed and built end to end',
    'Business process → UX → Figma → Design system → React → API → PostgreSQL → Deployment',
  ) +
  t(
    110,
    950,
    'Production-style demo. Future CRM/channel integrations are customization options.',
    13,
    C.muted,
  );
await save('01-demo-access', s);
for (const kind of ['Contacts', 'Companies']) {
  s = shell(
    kind,
    kind === 'Contacts'
      ? 'The people behind your next opportunity.'
      : 'Account context, connected contacts and active opportunities.',
  );
  s +=
    btn(1234, 111, '+ Add ' + (kind === 'Contacts' ? 'contact' : 'company'), 174) +
    card(256, 190, 1152, 690) +
    field(280, 220, 'Search ' + kind.toLowerCase(), 'Search name…', 380) +
    field(680, 220, kind === 'Contacts' ? 'Status' : 'Industry', 'All', 200) +
    field(900, 220, 'Owner', 'All team members', 220) +
    t(280, 319, kind === 'Contacts' ? 'NAME / EMAIL' : 'COMPANY / WEBSITE', 11, C.muted, 600) +
    t(680, 319, kind === 'Contacts' ? 'COMPANY' : 'INDUSTRY', 11, C.muted, 600) +
    t(930, 319, 'OWNER', 11, C.muted, 600) +
    t(1190, 319, kind === 'Contacts' ? 'STATUS' : 'SIZE', 11, C.muted, 600) +
    line(280, 337, 1104);
  for (let i = 0; i < 6; i++) {
    const y = 375 + i * 72;
    s +=
      r(280, y - 16, 36, 36, C.soft, 18) +
      t(
        289,
        y + 7,
        (kind === 'Contacts' ? names[i] : companies[i])
          .split(' ')
          .map((x) => x[0])
          .join(''),
        12,
        C.primary,
        600,
      ) +
      t(332, y, kind === 'Contacts' ? names[i] : companies[i], 14, C.ink, 600) +
      t(
        332,
        y + 21,
        kind === 'Contacts' ? 'contact' + (i + 1) + '@example.com' : 'example.com',
        12,
        C.muted,
      ) +
      t(
        680,
        y,
        kind === 'Contacts'
          ? companies[i]
          : ['Design', 'Logistics', 'Consulting', 'Technology', 'Manufacturing', 'Media'][i],
        14,
      ) +
      t(930, y, i % 2 ? 'Alex Morgan' : 'Maya Chen', 13, C.muted) +
      badge(1190, y - 15, kind === 'Contacts' ? (i > 3 ? 'Customer' : 'Lead') : '11–50') +
      line(280, y + 43, 1104);
  }
  s +=
    t(280, 847, 'Showing 1–6 of 6 ' + kind.toLowerCase(), 12, C.muted) +
    btn(1240, 822, '1 of 1', 138, false);
  await save(kind === 'Contacts' ? '03-contacts' : '04-companies', s);
}
s =
  shell('Pipeline', 'Every opportunity. One clear next step.', 'Pipeline') +
  btn(1250, 111, '+ Add deal', 158) +
  badge(256, 185, '18 deals') +
  t(380, 202, '$84,500 open pipeline', 14, C.muted) +
  field(1020, 195, 'Owner', 'All team members', 220);
for (let i = 0; i < 6; i++) {
  const x = 256 + i * 194;
  s +=
    r(x, 270, 180, 682, '#EDF0F5', 10) +
    t(x + 12, 301, cols[i], 14, C.ink, 600) +
    badge(x + 133, 283, [3, 4, 3, 2, 4, 2][i].toString()) +
    t(
      x + 12,
      326,
      ['$21,000', '$18,500', '$21,500', '$23,500', '$22,500', '$11,000'][i],
      12,
      C.muted,
    );
  for (let j = 0; j < (i === 0 || i === 1 ? 3 : 2); j++) {
    let y = 348 + j * 170;
    s +=
      card(x + 8, y, 164, 154) +
      t(
        x + 18,
        y + 27,
        j === 0
          ? [
              'Summit rollout',
              'Maple retainer',
              'Alder CRM rollout',
              'Harbor expansion',
              'Alder website care',
              'Cedar migration',
            ][i]
          : ['Next opportunity', 'Service package'][j - 1],
        12,
        C.ink,
        600,
      ) +
      t(x + 18, y + 49, companies[(i + j) % 6], 11, C.muted) +
      t(
        x + 18,
        y + 82,
        j === 0 ? ['$15,000', '$9,000', '$12,000', '$18,500', '$6,000', '$8,000'][i] : '$2,500',
        20,
        C.ink,
        600,
      ) +
      badge(
        x + 18,
        y + 96,
        i < 4 ? 'High' : i === 4 ? 'Won' : 'Lost',
        i === 4 ? C.green : i < 4 ? C.amber : C.primary,
      ) +
      t(x + 18, y + 138, 'AM  ·  Oct 01', 11, C.muted);
  }
}
await save('05-pipeline', s);
s =
  shell('Alder CRM rollout', 'Alder Studio · Riley Park', 'Pipeline') +
  btn(1070, 111, 'Edit deal', 130, false) +
  btn(1212, 111, 'Change stage', 196) +
  card(256, 192, 756, 228) +
  badge(280, 216, 'Proposal') +
  badge(374, 216, 'High priority', C.amber) +
  t(280, 298, '$12,000', 40, C.ink, 700) +
  field(530, 265, 'Owner', 'Alex Morgan', 210) +
  t(780, 265, 'Expected close', 12, C.muted) +
  t(780, 295, 'Oct 01, 2026', 15, C.ink, 600) +
  line(280, 333, 708) +
  t(280, 366, 'NEXT ACTION', 10, C.muted, 600) +
  t(280, 393, 'Confirm proposal scope with Riley', 15, C.ink, 500) +
  card(256, 444, 756, 204) +
  heading(280, 480, 'Deal notes') +
  t(280, 518, 'CRM rollout for a growing B2B team. Confirm the final scope', 14, C.muted) +
  t(280, 544, 'and implementation timeline before negotiation.', 14, C.muted) +
  field(280, 580, 'Add a note', 'Write a useful update…', 708) +
  card(256, 672, 756, 240) +
  heading(280, 710, 'Related tasks') +
  btn(831, 690, '+ Add task', 152, false) +
  r(280, 740, 20, 20, C.white, 5, C.line) +
  t(314, 756, 'Follow up on Alder proposal', 14, C.ink, 500) +
  badge(803, 738, 'Overdue', C.amber) +
  t(314, 781, 'Alex Morgan · High priority · Open', 12, C.muted) +
  line(280, 805, 708) +
  t(280, 850, 'Changes are validated and logged on the server.', 12, C.muted) +
  card(1036, 192, 372, 720) +
  heading(1060, 232, 'Activity timeline', 'Updates appear live across tabs');
['Proposal stage selected', 'Follow-up task created', 'Note added', 'Deal created'].forEach(
  (v, i) => {
    let y = 309 + i * 130;
    s +=
      r(1060, y - 12, 10, 10, C.primary, 5) +
      t(1088, y, v, 14, C.ink, 600) +
      t(1088, y + 26, 'Alex Morgan', 12, C.muted) +
      t(1088, y + 50, i + 1 + ' hours ago', 11, C.muted);
  },
);
await save('06-deal-detail', s);
s =
  shell('Tasks', 'Keep the next conversation moving.') +
  btn(1250, 111, '+ Add task', 158) +
  card(256, 194, 1152, 674) +
  badge(280, 219, 'All tasks') +
  t(402, 237, 'My tasks', 13, C.muted) +
  t(510, 237, 'Overdue', 13, C.amber) +
  field(890, 220, 'Status', 'All statuses', 240);
for (let i = 0; i < 6; i++) {
  let y = 327 + i * 79;
  s +=
    r(280, y - 15, 20, 20, C.white, 5, C.line) +
    t(
      320,
      y,
      [
        'Follow up on Alder proposal',
        'Confirm Harbor decision date',
        'Send Maple scope summary',
        'Prepare Summit discovery call',
        'Review Cedar requirements',
        'Share Northstar next steps',
      ][i],
      15,
      C.ink,
      500,
    ) +
    t(320, y + 25, companies[i] + ' · ' + (i % 2 ? 'Maya Chen' : 'Alex Morgan'), 12, C.muted) +
    badge(938, y - 17, i < 3 ? 'Overdue' : 'Upcoming', i < 3 ? C.amber : C.primary) +
    badge(1095, y - 17, i === 4 ? 'In Progress' : 'Open') +
    line(280, y + 51, 1104);
}
s += t(
  280,
  840,
  '6 tasks · 3 overdue · Due dates are evaluated from current workspace data.',
  12,
  C.muted,
);
await save('07-tasks', s);
s = shell('Reports', 'Real workspace data. Useful sales signals.');
[
  ['Open pipeline', '$84,500'],
  ['Won revenue', '$22,500'],
  ['Closed-deal conversion', '67%'],
  ['Won / Lost', '4 / 2'],
].forEach(([a, b], i) => {
  let x = 256 + i * 292;
  s += card(x, 194, 276, 124) + t(x + 20, 229, a, 12, C.muted) + t(x + 20, 276, b, 32, C.ink, 700);
});
s +=
  card(256, 344, 664, 520) +
  heading(280, 383, 'Pipeline by stage', 'Open and closed opportunity values');
cols.forEach((a, i) => {
  let y = 447 + i * 61;
  s +=
    t(280, y, a, 13) +
    r(400, y - 15, 290, 14, '#EEF2F6', 7) +
    r(400, y - 15, [210, 185, 215, 235, 225, 110][i], 14, i === 4 ? C.green : C.primary, 7) +
    t(713, y, ['$21,000', '$18,500', '$21,500', '$23,500', '$22,500', '$11,000'][i], 13, C.muted);
});
s +=
  card(944, 344, 464, 520) +
  heading(968, 383, 'Sales by owner', 'Won revenue, not speculative forecasts') +
  t(968, 463, 'Maya Chen', 15, C.ink, 600) +
  t(1210, 463, '$13,000', 24, C.ink, 600) +
  line(968, 491, 416) +
  t(968, 540, 'Alex Morgan', 15, C.ink, 600) +
  t(1210, 540, '$9,500', 24, C.ink, 600) +
  t(968, 651, 'Conversion = Won / (Won + Lost)', 13, C.muted) +
  t(968, 680, 'Open deals are excluded from the denominator.', 12, C.muted) +
  t(968, 751, 'Metrics update after committed CRM changes.', 12, C.muted);
await save('08-reports', s);
s =
  shell('Activity', 'A trustworthy history of sales work.') +
  card(256, 194, 1152, 716) +
  field(280, 222, 'Activity', 'All workspace activity', 340);
[
  'Alder CRM rollout moved to Proposal',
  'Follow up on Alder proposal created',
  'Riley Park contact updated',
  'Harbor Logistics company created',
  'Maple discovery assigned to Alex Morgan',
  'Note added to Summit implementation',
  'Alder website care marked Won',
  'Private demo workspace prepared',
].forEach((v, i) => {
  let y = 329 + i * 65;
  s +=
    r(283, y - 9, 10, 10, i === 6 ? C.green : C.primary, 5) +
    t(319, y, v, 15, C.ink, 500) +
    t(
      319,
      y + 25,
      (i % 2 ? 'Maya Chen' : 'Alex Morgan') + ' · ' + (i + 1) + ' hours ago',
      12,
      C.muted,
    ) +
    line(319, y + 41, 1065);
});
await save('09-activity', s);
s =
  shell('Team & settings', 'A small team. Clear permissions.', 'Team & settings') +
  card(256, 194, 1152, 290) +
  heading(280, 234, 'Demo team', 'Fictional members; no invitations or emails are sent');
[
  ['Maya Chen', 'Sales Manager', 'All records, assignments and reports'],
  ['Alex Morgan', 'Sales Representative', 'Own records, tasks and stage changes'],
  ['Jordan Lee', 'Viewer', 'Read-only workspace access'],
].forEach(([n, role, rights], i) => {
  let y = 311 + i * 65;
  s +=
    t(280, y, n, 15, C.ink, 600) +
    badge(515, y - 18, role) +
    t(765, y, rights, 13, C.muted) +
    badge(1260, y - 18, 'Active', C.green);
});
s +=
  card(256, 508, 560, 284) +
  heading(280, 548, 'Won deal automation', 'One useful workflow, with duplicate protection') +
  t(280, 603, 'Deal Won → PostgreSQL → n8n → Telegram', 14, C.ink, 600) +
  badge(280, 633, 'Workflow connected', C.green) +
  t(280, 692, 'Delivery status appears in the workspace history.', 13, C.muted) +
  t(280, 721, 'A repeated event is not sent twice.', 13, C.muted) +
  card(840, 508, 568, 284) +
  heading(864, 548, 'Private demo session', 'Temporary fictional data for this visitor') +
  t(864, 605, 'Data expires after 24 hours.', 15) +
  t(864, 635, 'Other visitors receive separate workspaces.', 13, C.muted) +
  badge(864, 669, 'SSE · Live updates', C.green) +
  btn(864, 719, 'Switch demo role', 250, false) +
  card(256, 818, 1152, 155) +
  heading(
    280,
    857,
    'Built for customization',
    'Sales teams · B2B services · Agencies · Account management · Customer success',
  ) +
  t(
    280,
    922,
    'Future options: HubSpot, Salesforce, Gmail, Outlook, Slack, WhatsApp, calendars, Stripe and custom APIs.',
    12,
    C.muted,
  );
await save('10-team-settings', s);
// Compact mobile frames use readable cards and a stage selector instead of a shrunken desktop grid.
for (const page of ['Dashboard', 'Contacts', 'Pipeline', 'Deal detail', 'Tasks']) {
  let m =
    r(0, 0, 390, 1100, C.bg, 0) +
    r(0, 0, 390, 64, C.white, 0) +
    t(20, 41, '☰', 20, C.ink) +
    t(58, 42, 'SalesFlow', 21, C.ink, 700) +
    badge(282, 23, 'Live', C.green) +
    t(20, 111, page, 29, C.ink, 700) +
    t(20, 139, 'Northline workspace · Sales Manager', 12, C.muted);
  if (page === 'Dashboard') {
    [
      ['Open pipeline', '$84,500'],
      ['Open deals', '12'],
      ['Won deals', '4'],
      ['Conversion', '67%'],
    ].forEach(([a, b], i) => {
      let x = 20 + (i % 2) * 179,
        y = 169 + Math.floor(i / 2) * 120;
      m +=
        card(x, y, 171, 105) +
        t(x + 16, y + 30, a, 12, C.muted) +
        t(x + 16, y + 74, b, 27, C.ink, 700);
    });
    m += card(20, 428, 350, 235) + heading(36, 463, 'Pipeline overview');
    ['New', 'Qualified', 'Proposal', 'Negotiation'].forEach(
      (a, i) =>
        (m +=
          t(36, 507 + i * 37, a, 12) +
          r(137, 495 + i * 37, 175, 12, C.soft, 6) +
          r(137, 495 + i * 37, 120 + i * 12, 12, C.primary, 6)),
    );
    m +=
      card(20, 685, 350, 230) +
      heading(36, 723, 'Next actions') +
      badge(36, 748, '3 overdue', C.amber) +
      t(36, 808, 'Follow up on Alder proposal', 14, C.ink, 600) +
      t(36, 832, 'Alex Morgan · High priority', 12, C.muted) +
      btn(36, 855, 'View all tasks', 318, false);
  } else if (page === 'Pipeline') {
    m +=
      field(20, 178, 'Pipeline stage', 'Proposal · 3 deals', 350) +
      t(20, 267, '$21,500 in this stage', 13, C.muted);
    ['Alder CRM rollout', 'Cedar annual support', 'Harbor analytics'].forEach((n, i) => {
      let y = 294 + i * 220;
      m +=
        card(20, y, 350, 196) +
        t(40, y + 37, n, 18, C.ink, 600) +
        t(40, y + 67, companies[i], 13, C.muted) +
        t(40, y + 111, ['$12,000', '$6,500', '$3,000'][i], 30, C.ink, 700) +
        badge(40, y + 133, 'High priority', C.amber) +
        t(225, y + 153, 'Alex · Oct 01', 12, C.muted);
    });
  } else if (page === 'Deal detail') {
    m +=
      card(20, 170, 350, 248) +
      badge(40, 195, 'Proposal') +
      t(40, 257, 'Alder CRM rollout', 23, C.ink, 600) +
      t(40, 286, 'Alder Studio · Riley Park', 13, C.muted) +
      t(40, 340, '$12,000', 35, C.ink, 700) +
      t(40, 379, 'Alex Morgan · Expected close Oct 01', 12, C.muted) +
      btn(20, 439, 'Change stage', 350) +
      card(20, 503, 350, 157) +
      heading(40, 541, 'Next action') +
      t(40, 580, 'Confirm proposal scope with Riley', 14, C.muted) +
      btn(40, 597, 'Add a task', 310, false) +
      card(20, 684, 350, 268) +
      heading(40, 724, 'Activity timeline') +
      t(40, 778, 'Moved to Proposal', 14, C.ink, 600) +
      t(40, 805, 'Alex Morgan · 1 hour ago', 12, C.muted) +
      line(40, 828, 310) +
      t(40, 867, 'Follow-up task created', 14, C.ink, 600) +
      t(40, 894, 'Alex Morgan · 2 hours ago', 12, C.muted);
  } else {
    m +=
      field(20, 178, 'Search ' + page.toLowerCase(), 'Search…', 350) +
      btn(20, 249, '+ Add ' + (page === 'Contacts' ? 'contact' : 'task'), 350);
    for (let i = 0; i < 4; i++) {
      let y = 312 + i * 161;
      m +=
        card(20, y, 350, 143) +
        t(
          40,
          y + 34,
          page === 'Contacts'
            ? names[i]
            : [
                'Follow up on proposal',
                'Confirm decision date',
                'Send scope summary',
                'Prepare discovery call',
              ][i],
          16,
          C.ink,
          600,
        ) +
        t(40, y + 62, companies[i], 13, C.muted) +
        t(
          40,
          y + 88,
          page === 'Contacts'
            ? 'contact' + (i + 1) + '@example.com'
            : 'Alex Morgan · High priority',
          12,
          C.muted,
        ) +
        badge(
          40,
          y + 102,
          page === 'Contacts' ? 'Lead' : i < 3 ? 'Overdue' : 'Upcoming',
          page === 'Tasks' && i < 3 ? C.amber : C.primary,
        );
    }
  }
  m +=
    r(0, 1020, 390, 80, C.white, 0) +
    t(20, 1053, 'Dashboard', 12, C.primary, 600) +
    t(126, 1053, 'Pipeline', 12, C.muted) +
    t(221, 1053, 'Tasks', 12, C.muted) +
    t(311, 1053, 'Menu', 12, C.muted) +
    t(115, 1082, 'Private demo · 24 hours', 10, C.muted);
  await save('mobile-' + page.toLowerCase().replace(' ', '-'), m, 390, 1100);
}
await save(
  '11-stage-confirmation',
  r(0, 0, 1440, 1050, '#E7EAF0', 0) +
    card(470, 285, 500, 425) +
    heading(502, 336, 'Move deal to Won?', 'Alder CRM rollout · $12,000') +
    t(502, 419, 'This records the win and queues a manager notification.', 14, C.muted) +
    field(502, 458, 'Stage', 'Won', 436) +
    t(502, 561, 'A timeline event is saved in the same transaction.', 12, C.muted) +
    btn(502, 606, 'Cancel', 140, false) +
    btn(658, 606, 'Confirm Won', 280),
);
console.log('Created editable SVG design assets before frontend implementation.');
