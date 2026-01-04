import re
from playwright.sync_api import Page, expect

def test_renegotiation_flow(page: Page):
    page.goto("http://localhost:3000/")

    page.get_by_label("Email").fill("test@example.com")
    page.get_by_label("Senha").fill("password")
    page.get_by_role("button", name="Entrar / Cadastrar").click()

    page.wait_for_url("http://localhost:3000/dashboard")

    page.get_by_role("button", name="Loja").click()

    page.get_by_role("button", name="Selecionar para Renegociar").click()

    page.locator('input[type="checkbox"]').nth(1).check()
    page.locator('input[type="checkbox"]').nth(2).check()

    page.get_by_role("button", name="Renegociar").click()

    page.locator('input[type="number"]').first.fill("10")
    page.locator('input[type="number"]').nth(1).fill("5")
    page.locator('input[type="number"]').nth(2).fill("2")
    page.locator('input[type="date"]').fill("2025-01-01")
    page.locator("textarea").fill("Test observation")

    page.get_by_role("button", name="Confirmar Renegociação").click()

    expect(page.get_by_text("transação(ões) selecionada(s)")).not_to_be_visible()
