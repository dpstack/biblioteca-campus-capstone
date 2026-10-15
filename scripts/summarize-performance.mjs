import fs from "node:fs";
const directory = new URL("../docs/performance/", import.meta.url);
const samples = fs
  .readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    ...JSON.parse(fs.readFileSync(new URL(name, directory), "utf8")),
  }));
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rows = [];
const fence = String.fromCharCode(96).repeat(3);
for (const project of ["desktop", "mobile"])
  for (const route of ["home", "catalog"]) {
    const before = samples.find(
      (item) =>
        item.name.startsWith("baseline-") &&
        item.project === project &&
        item.route === route,
    );
    const final = samples.filter(
      (item) =>
        item.name.startsWith("final-") &&
        item.project === project &&
        item.route === route,
    );
    if (
      !before ||
      final.length !== 3 ||
      final.some((item) => !item.deploymentId)
    )
      throw new Error(`Missing complete samples for ${project}/${route}`);
    const sec = (value) => (value / 1000).toFixed(2);
    rows.push(
      `| ${project} / ${route} | ${sec(before.lcp)} | ${sec(median(final.map((item) => item.lcp)))} | ${before.cls.toFixed(3)} | ${median(final.map((item) => item.cls)).toFixed(3)} | ${sec(median(final.map((item) => item.fcp)))} | ${median(final.map((item) => item.longTasks)).toFixed(0)} |`,
    );
  }
const text = `# Production performance — October 9, 2026

## Method

Public URL: https://biblioteca-campus-capstone-dpstacks-projects.vercel.app/. Installed Chrome with Playwright, one worker, foreground page, fresh context per sample. Home and Tolkien catalog were observed until ten seconds after the first card appeared. Desktop: 1440×900 without artificial throttling. Mobile: Pixel 7, 150 ms latency, 1.6 Mbps download, 0.75 Mbps upload, and 4× CPU slowdown through CDP.

There is one baseline sample and three final samples per combination; the table reports final medians. External APIs, network caches, browser state, and computer load vary. These are indicative synthetic measurements, not a controlled statistical study, Lighthouse score, or real-user data.

Final sample provenance: ${["home", "catalog"].map((route) => `${route}: ${[...new Set(samples.filter((item) => item.name.startsWith("final-") && item.route === route).map((item) => item.deploymentId))].join(", ")}`).join("; ")}. The final catalog revision separates inventory loading; home preserves the earlier measured implementation.

## Results

LCP and FCP are seconds. CLS sums shifts without recent input during observation; it does not implement full-visit session windows. Blocking sums long-task time exceeding 50 ms during observation and is not Lighthouse TBT.

| Screen | Baseline LCP (1 sample) | Final LCP (median of 3) | Baseline CLS | Final CLS | Final FCP | Final blocking (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join("\n")}

The field reference targets are LCP ≤2.5 s and CLS ≤0.1 at the 75th percentile: [LCP](https://web.dev/articles/lcp), [CLS](https://web.dev/articles/cls). Three synthetic samples cannot certify that percentile or measure real INP. Mobile LCP exceeds 2.5 s under this throttling configuration.

## Changes measured

- Deferred Supabase SDK and session restoration; protected routes wait for restoration. Entry plus static dependency: 281.48 KB (91.26 KB gzip), previously 494.37 KB (145.15 KB gzip). The deferred SDK adds 214.34 KB (55.09 KB gzip); its download is deferred, not eliminated.
- Decorative M-size covers replace L-size covers, with hero preload, cover-host preconnect, and lazy card images.
- Optional font display retains Georgia/Arial on an initially slow connection, avoiding late font swaps and geometry changes.
- Persistent header and minimum content space prevent the footer from shifting after a route loads.
- Search excludes unused subjects; book details still request subjects.
- Catalog metadata renders independently of SDK and inventory loading.

## Reproduction

After npm ci, with Chrome installed, use PowerShell. Replace the deployment identifier with the deployment actually being measured; the example identifies the historical final catalog sample.

${fence}powershell
$env:BASE_URL='https://biblioteca-campus-capstone-dpstacks-projects.vercel.app'
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PERFORMANCE_AUDIT='1'
$env:AUDIT_LABEL='final'
$env:AUDIT_DEPLOYMENT_ID='dpl_X4KDw8b3XgBxNjw9RpVxwufVM2Y5'
npm run test:e2e
node scripts/summarize-performance.mjs
${fence}

Remove PERFORMANCE_AUDIT to restore functional testing. Do not run competing suites during measurement. Raw JSON files in docs/performance preserve timings, LCP sources, shifts, and deployment identifiers. Baseline, intermediate, and final prefixes distinguish the measured stages. Historical audit screenshots retain the interface present on their measurement date.

## Later releases

These measurements were not repeated for the administrative panel (dpl_FooN13uYrhrTWeggFN2sooYksVVc), borrowing filter (dpl_5hhddB1eeyBUoiEEgVDfKb1STFo6), themes (dpl_2yMCjieS34XUoddoghNDuYMRAJzx), typography (dpl_hfWaQYMm9DKE2WHpVno5HFseeSJ2), final polish (dpl_8XRfswk3na5NnVvnk64ttrb1HcBV), or the English release. Current functional test results do not replace these dated performance measurements.
`;
fs.writeFileSync(new URL("../docs/PERFORMANCE.md", import.meta.url), text);
process.stdout.write(rows.join("\n") + "\n");
