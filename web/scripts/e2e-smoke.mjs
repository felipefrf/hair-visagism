// E2E smoke test: real photo through the full wizard in headless Chromium.
// Usage: node scripts/e2e-smoke.mjs <portrait.jpg> [screenshot-dir]
// Requires `npm run dev` on :3000 (or set BASE_URL).

import { chromium } from "playwright";

const photo = process.argv[2];
const outDir = process.argv[3] ?? ".";
const base = process.env.BASE_URL ?? "http://localhost:3000";
if (!photo) {
  console.error("usage: node scripts/e2e-smoke.mjs <portrait.jpg> [out-dir]");
  process.exit(1);
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {}
);
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto(`${base}/analise`);

const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: "Tirar ou escolher foto" }).click(),
]);
await chooser.setFiles(photo);
await page
  .getByRole("heading", { name: "Seu cabelo" })
  .waitFor({ timeout: 45000 });

await page.getByRole("button", { name: "2A · ondulado leve" }).click();
await page.getByRole("button", { name: "Médio", exact: true }).click();
await page.getByRole("button", { name: "Curto", exact: true }).click();
await page.getByRole("button", { name: "Não", exact: true }).click();
await page.getByRole("button", { name: "Com entradas" }).click();
await page.getByRole("button", { name: "Prefiro disfarçar" }).click();
await page.getByRole("button", { name: /Só algo leve/ }).click();
await page.getByRole("button", { name: "Até 5 min/dia" }).click();
await page.getByRole("button", { name: "Masculina" }).click();
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("button", { name: /Ousadia/ }).click();
await page.getByRole("button", { name: "Ver recomendações" }).click();
await page.getByText("Sua análise").waitFor({ timeout: 10000 });

const heading = await page.locator("h2").first().textContent();
console.log("RESULTADO:", heading?.trim());
const names = await page.locator("ol h3").allTextContents();
console.log("TOP:", names.map((n) => n.replace(/^\d+/, "").trim()).join(" · "));

await page.getByText("Como chegamos nesse resultado").click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/e2e-medidas.png` });
await browser.close();
console.log("ok");
