
import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Try port 3000 first, then 3001, 3003, etc.
        base_url = "http://localhost"
        ports_to_try = [3000, 3001, 3003, 3004, 3005]

        connected = False
        for port in ports_to_try:
            try:
                print(f"Attempting to connect to port {port}...")
                await page.goto(f"{base_url}:{port}/", timeout=5000)
                print(f"Successfully connected to port {port}")
                connected = True
                break
            except Exception as e:
                print(f"Could not connect to port {port}: {e}")

        if not connected:
            print("Failed to connect to the application on any expected port.")
            await browser.close()
            return

        print("Filling test data...")
        await page.get_by_role("button", name="Preencher Dados de Teste").click()

        print("Clicking login button (first time - sign up)...")
        login_button = page.get_by_role("button", name="Entrar / Cadastrar")

        # This is the sign-up attempt
        try:
            async with page.expect_response("**/auth/v1/token**", timeout=15000) as response_info:
                await login_button.click(force=True)
            response = await response_info.value
            print(f"Sign-up response status: {response.status}")
        except Exception as e:
            print(f"Timeout waiting for sign-up response: {e}")
            await page.screenshot(path="verification/login_failure_signup.png")
            await browser.close()
            return

        print("Clicking login button (second time - sign in)...")
        # After the first click (sign-up), the button might be stale. Re-locate it.
        login_button = page.get_by_role("button", name="Entrar / Cadastrar")

        # This is the sign-in attempt
        try:
            async with page.expect_response("**/auth/v1/token**", timeout=15000) as response_info:
                await login_button.click(force=True)
            response = await response_info.value
            print(f"Sign-in response status: {response.status}")
        except Exception as e:
            print(f"Timeout waiting for sign-in response: {e}")
            await page.screenshot(path="verification/login_failure_signin.png")
            await browser.close()
            return

        print("Waiting for navigation to dashboard...")
        try:
            await page.wait_for_url("**/dashboard", timeout=10000)
            print("Successfully navigated to dashboard.")
            await page.screenshot(path="verification/dashboard_final.png")
        except Exception as e:
            print(f"Failed to navigate to dashboard: {e}")
            await page.screenshot(path="verification/dashboard_navigation_failure.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
