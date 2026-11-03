// Optional asset maintenance. The generated JPEG is committed; builds do not require Chromium.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 690 },
  });
  const svg = await readFile(
    new URL("../public/wisdom-logo.svg", import.meta.url),
  );
  await page.setContent(
    `<body style="margin:0;background:white"><img width="1080" height="690" src="data:image/svg+xml;base64,${svg.toString("base64")}"></body>`,
  );
  await page.locator("img").evaluate((image) => image.decode());
  await page
    .locator("img")
    .screenshot({
      path: new URL("../public/wisdom-logo.jpg", import.meta.url).pathname,
      type: "jpeg",
      quality: 95,
    });
} finally {
  await browser.close();
}
