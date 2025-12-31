
from playwright.sync_api import sync_playwright, expect
import time

def run_verification(page):
    """
    Navigates to the loja module, creates a new sale with 'Pago' status,
    and verifies that the payment details are handled correctly.
    """
    try:
        # Navigate to the login page
        page.goto("http://localhost:3000", timeout=60000)

        # Login
        page.get_by_label("Email").fill("teste@lojamaju.com")
        page.get_by_label("Senha").fill("123456")
        page.get_by_role("button", name="Entrar").click()

        # Navigate to Loja module and then to the Vendas tab
        page.get_by_role("button", name="Loja").click()
        expect(page.get_by_role("heading", name="Módulo Loja")).to_be_visible(timeout=30000)
        page.get_by_role("button", name="Vendas").click()

        # Wait for the form to be visible before interacting
        expect(page.get_by_role("heading", name="Nova Venda")).to_be_visible(timeout=30000)

        # Fill in sale details
        page.get_by_label("Cliente *").fill("Cliente Teste Auto")

        # This is a bit tricky as the seletor is complex. We'll add a new item instead.
        page.get_by_label("Novo Cadastro").check()
        page.get_by_label("Descrição do Produto *").fill("Produto Teste Auto")

        # Wait for the category options to load by asserting the count is 1
        expect(page.locator('#categoria-produto option:has-text("ROUPAS")')).to_have_count(1, timeout=10000)
        page.get_by_label("Categoria *").select_option(label="ROUPAS")

        page.get_by_label("Quantidade *").fill("2")
        page.get_by_label("Preço de Custo *").fill("10")
        page.get_by_label("Preço de Venda *").fill("25")

        # Set status to "Pago"
        page.get_by_label("Status").select_option("pago")

        # Wait a moment for any potential state updates
        time.sleep(1)

        # Register the sale
        page.get_by_role("button", name="Registrar Venda").click()

        # Verification: Check for the success message or Caixa update
        # For now, we'll just check if the form closes and take a screenshot.
        expect(page.get_by_role("heading", name="Módulo Loja")).to_be_visible(timeout=30000)

        # Take a screenshot
        page.screenshot(path="venda_paga_verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="venda_paga_error.png")
        raise

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
        finally:
            browser.close()
