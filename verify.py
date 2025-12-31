from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    """
    Navigates to the login page, fills in credentials, logs in,
    waits for the data to load, and then takes a screenshot of the dashboard.
    """
    try:
        # Navigate to the login page
        page.goto("http://localhost:3000", timeout=60000)

        # Fill in the email and password
        page.get_by_label("Email").fill("teste@lojamaju.com")
        page.get_by_label("Senha").fill("123456")

        # Click the login button
        page.get_by_role("button", name="Entrar").click()

        # Wait for the main heading to be visible
        heading = page.get_by_role("heading", name="Módulo Casa")
        expect(heading).to_be_visible(timeout=30000)

        # Wait for the loading indicators to disappear
        expect(page.get_by_text("Carregando...")).to_be_hidden(timeout=30000)
        expect(page.get_by_text("Carregando lançamentos...")).to_be_hidden(timeout=30000)

        # Take a screenshot
        page.screenshot(path="/home/jules/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="/home/jules/verification/error_screenshot.png")
        raise

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
        finally:
            browser.close()
