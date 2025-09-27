import asyncio
from playwright.async_api import async_playwright, expect
import pathlib

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # --- 1. Verify Desktop View (index.html) ---
        page = await browser.new_page()
        base_url = "http://localhost:8000"
        desktop_url = f"{base_url}/index.html"
        await page.goto(desktop_url, wait_until="domcontentloaded")

        await page.wait_for_function("""
            () => document.querySelector('#event-date-selector').options.length > 1
        """, timeout=10000)

        await page.select_option("#event-date-selector", "2024-09-14")

        await page.locator(".event-card").first.click()

        # Scroll the system content container into view
        system_content_container = page.locator("#system-content-container")
        await system_content_container.scroll_into_view_if_needed()

        await expect(page.locator("#system-title")).to_contain_text("克蘇魯的呼喚")

        await expect(page.locator("#system-main-text")).to_contain_text("是一款基於H.P. 洛夫克拉夫特創造的克蘇魯神話體系")

        await page.screenshot(path="jules-scratch/verification/desktop_verification.png")
        print("Desktop verification screenshot captured.")
        await page.close()

        # --- 2. Verify Mobile View (index_mobile.html) ---
        mobile_page = await browser.new_page(viewport={"width": 375, "height": 667})
        mobile_url = f"{base_url}/index_mobile.html"
        await mobile_page.goto(mobile_url, wait_until="domcontentloaded")

        # Use a more specific locator to click the tab
        await mobile_page.locator('.tab[data-tab="event-details"]').click()

        await mobile_page.wait_for_function("""
            () => document.querySelector('#categories-container').querySelector('.tab') !== null
        """, timeout=10000)

        await mobile_page.get_by_text("2024-09-14").first.click()

        await mobile_page.locator(".event-link").first.click()

        # Scroll the content container into view
        content_container = mobile_page.locator("#content-container")
        await content_container.scroll_into_view_if_needed()

        await expect(mobile_page.locator("#event-title")).to_contain_text("克蘇魯的呼喚")

        await expect(mobile_page.locator("#event-main-text")).to_contain_text("是一款基於H.P. 洛夫克拉夫特創造的克蘇魯神話體系")

        await mobile_page.screenshot(path="jules-scratch/verification/mobile_verification.png")
        print("Mobile verification screenshot captured.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())