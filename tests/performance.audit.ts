import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

// Opt-in production measurement, not a claim about real-user Core Web Vitals.
for (const route of [
  { name: "home", path: "/" },
  { name: "catalog", path: "/catalogo?q=Tolkien" },
]) {
  for (
    let attempt = 1;
    attempt <= Number(process.env.AUDIT_SAMPLES || 3);
    attempt++
  ) {
    test(`${route.name} performance sample ${attempt}`, async ({
      page,
    }, info) => {
      test.setTimeout(75_000);
      if (info.project.name === "mobile") {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: 1_600_000 / 8,
          uploadThroughput: 750_000 / 8,
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      }
      await page.addInitScript(() => {
        const metrics = {
          lcp: 0,
          cls: 0,
          longTasks: 0,
          lcpSource: "",
          shifts: [] as unknown[],
        };
        (window as any).__auditMetrics = metrics;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any) {
            metrics.lcp = entry.startTime;
            metrics.lcpSource = `${entry.element?.tagName ?? ""}.${entry.element?.className ?? ""} ${entry.url ?? ""}`;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any)
            if (!entry.hadRecentInput) {
              metrics.cls += entry.value;
              metrics.shifts.push({
                value: entry.value,
                sources: entry.sources?.map((source: any) => ({
                  node: `${source.node?.tagName}.${source.node?.className}`,
                  previous: source.previousRect,
                  current: source.currentRect,
                })),
              });
            }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            metrics.longTasks += Math.max(0, entry.duration - 50);
        }).observe({ type: "longtask", buffered: true });
      });
      await page.bringToFront();
      await page.goto(route.path);
      await expect(page.locator(".book-grid article").first()).toBeVisible({
        timeout: 45_000,
      });
      await page.waitForTimeout(10_000);
      const sample = await page.evaluate(() => ({
        ...(window as any).__auditMetrics,
        fcp:
          performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime ?? null,
        navigation: (
          performance.getEntriesByType(
            "navigation",
          )[0] as PerformanceNavigationTiming
        ).toJSON(),
        resources: performance.getEntriesByType("resource").length,
      }));
      const result = {
        deploymentId: process.env.AUDIT_DEPLOYMENT_ID ?? null,
        url: await page.url(),
        measuredAt: new Date().toISOString(),
        project: info.project.name,
        route: route.name,
        attempt,
        methodology:
          info.project.name === "mobile"
            ? "Pixel 7; 150 ms latency; 1.6 Mbps download; CPU 4x; fresh browser context; sampled 10 s after first card"
            : "1440x900; no artificial throttling; fresh browser context; sampled 10 s after first card",
        ...sample,
      };
      await fs.mkdir("docs/performance", { recursive: true });
      const path = `docs/performance/${process.env.AUDIT_LABEL || "final"}-${info.project.name}-${route.name}-${attempt}.json`;
      await fs.writeFile(path, JSON.stringify(result, null, 2));
      await info.attach("measurement", {
        path,
        contentType: "application/json",
      });
      if (attempt === 1)
        await page.screenshot({
          path: `docs/screenshots/audit-${route.name}-${info.project.name}.png`,
        });
      expect(sample.fcp).toBeGreaterThan(0);
      expect(sample.lcp).toBeGreaterThan(0);
    });
  }
}
