
import asyncio
from playwright.async_api import async_playwright
import os

# --- Configuração ---
EMAIL = "teste@lojamaju.com"
SENHA = "123456" # Senha corrigida conforme o botão de teste no componente
URL_BASE = "http://localhost:3006"
SCREENSHOT_DIR = "verification_screenshots"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, slow_mo=50)
        page = await browser.new_page()

        try:
            print("--- Iniciando verificação ---")

            # 1. Login
            print("1. Acessando a página de login...")
            await page.goto(URL_BASE, timeout=60000)
            print("   Página carregada. Preenchendo formulário com IDs...")
            await page.fill('#email', EMAIL)
            await page.fill('#senha', SENHA)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/00_antes_do_login.png")

            print("   Clicando em '#submit-button'...")
            await page.click('#submit-button')

            print("   Aguardando redirecionamento para o dashboard...")
            await page.wait_for_url(f"{URL_BASE}/dashboard", timeout=15000)
            print("   Login bem-sucedido.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/01_login_success.png")

            # 2. Verificação do Módulo Loja
            print("\n2. Navegando para o Módulo Loja e verificando correções...")
            await page.click('button:has-text("Loja")')
            await page.wait_for_selector('h3:has-text("Próximos 30 Dias")')
            print("   Módulo Loja carregado.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/02_loja_tela_inicial.png")

            # 3. Verificação do Dashboard e Caixa Universal
            print("\n3. Navegando para o Dashboard para verificar o Caixa Universal...")
            await page.click('button:has-text("Dashboard")')
            await page.wait_for_selector('h2:has-text("Resumo dos Próximos 30 Dias")')
            print("   Dashboard carregado.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/03_dashboard_caixa_universal_padrao.png")

            print("   Clicando em 'Ver Tudo'...")
            await page.click('button:has-text("Ver Tudo")')
            await page.wait_for_selector('h2:has-text("Resumo de Todas as Transações Futuras")')
            print("   Visão 'Ver Tudo' carregada.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/04_dashboard_caixa_universal_ver_tudo.png")

            # 4. Verificação da Funcionalidade "Orçamento e Metas"
            print("\n4. Navegando para Configurações...")
            await page.click('button:has-text("Configurações")')
            await page.wait_for_selector('h1:has-text("Configurações do Sistema LUCIUS")')

            print("   Verificando Orçamento e Metas - Casa...")
            await page.click('button:has-text("Orçamento e Metas") >> nth=0')
            await page.wait_for_selector('h3:has-text("Orçamento Mensal (Despesas)")')
            print("   Tela de Orçamento da Casa carregada.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/05_config_orcamento_casa.png")

            print("   Verificando Orçamento e Metas - Loja...")
            await page.click('button:has-text("Orçamento e Metas") >> nth=1')
            await page.wait_for_selector('h3:has-text("Orçamento Estoque")')
            print("   Tela de Orçamento da Loja carregada.")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/06_config_orcamento_loja.png")

            print("\n--- Verificação concluída com sucesso! ---")

        except Exception as e:
            print(f"\n--- Ocorreu um erro durante a verificação: {e} ---")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error_geral.png")
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
