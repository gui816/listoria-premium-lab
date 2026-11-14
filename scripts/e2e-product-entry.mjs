import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const mockList = { id: "playwright-list", shareCode: "PWTEST01", name: "Lista Playwright" };

async function mockRpc(page) {
  let items = [];
  await page.route("**/rest/v1/rpc/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    let data = {};
    if (endpoint === "create_family_list") {
      data = { list: mockList, items: [], receipts: [] };
    } else if (endpoint === "register_family_member") {
      data = { success: true };
    } else if (endpoint === "get_family_list") {
      data = { list: mockList, items, receipts: [] };
    } else if (endpoint === "add_family_item") {
      const payload = route.request().postDataJSON();
      const item = {
        _id: `item-${items.length + 1}`,
        name: payload.p_name,
        quantity: payload.p_quantity || 1,
        category: payload.p_category || "outros",
        done: false
      };
      items = [...items, item];
      data = { items };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
}

async function exerciseViewport({ width, height, mobile }, screenshotPath) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 1 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "pt-PT"
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockRpc(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#member-name").waitFor({ state: "visible" });
  await page.locator("#member-name").fill("Teste Playwright");
  await page.locator("#list-name").fill("Lista Playwright");
  await page.locator("#create-list-card .create-form button[type=submit]").click();
  await page.locator(".product-entry-composer-classic").waitFor({ state: "visible", timeout: 15000 });
  const onboardingClose = page.locator(".onboarding-backdrop .modal-close");
  if (await onboardingClose.isVisible().catch(() => false)) await onboardingClose.click();

  const composer = page.locator(".product-entry-composer-classic");
  await assert.equal(await composer.locator(".product-entry-leading-add").isVisible(), true);
  await assert.equal(await composer.locator(".product-entry-inline-action.photo").isVisible(), true);
  await assert.equal(await composer.locator(".product-entry-inline-action.voice").isVisible(), true);
  const input = composer.locator('input[aria-label="Adicionar artigo"]');
  await input.fill("Leite");
  await composer.locator(".product-entry-leading-add").click();
  await page.getByText("Leite", { exact: true }).first().waitFor({ state: "visible" });

  await composer.locator(".quantity-picker-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Quantos precisas?" });
  await dialog.waitFor({ state: "visible" });
  const quantityInput = dialog.locator('input[aria-label="Quantidade"]');
  await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  assert.equal(await quantityInput.inputValue(), "2");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Adicionar artigo");

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    composerWidth: document.querySelector(".product-entry-composer-classic")?.getBoundingClientRect().width
  }));
  assert.ok(layout.documentWidth <= layout.viewportWidth + 1, `Horizontal overflow: ${JSON.stringify(layout)}`);
  assert.deepEqual(errors, [], `Browser errors: ${errors.join("; ")}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();
}

await exerciseViewport({ width: 393, height: 852, mobile: true }, "artifacts/listoria-mobile.png");
await exerciseViewport({ width: 1440, height: 900, mobile: false }, "artifacts/listoria-desktop.png");
console.log("Playwright product-entry checks passed at 393x852 and 1440x900.");
