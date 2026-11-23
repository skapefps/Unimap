"""
varrer-telas.py — abre todas as telas, em cada perfil, e reporta o que quebra.

Por que existe: vários defeitos deste projeto não aparecem lendo o código
nem rodando os testes de API. Um CSP que bloqueia onclick, uma função que
o HTML chama e não existe, uma chamada sem cabeçalho de autorizacao que
desloga o usuário — nada disso gera erro no servidor. Só aparece quando um
navegador de verdade carrega a página e clica nas coisas.

Rodar ANTES de publicar:

    # 1. suba o backend apontando para um banco de desenvolvimento
    # 2. depois:
    python3 varrer-telas.py http://localhost:3000 <senha-do-admin>

Também serve para conferir produção depois do deploy:

    python3 varrer-telas.py https://seu-dominio <senha-do-admin>

Sai com código 1 se qualquer tela tiver problema, então dá para usar em CI.

Precisa de: pip install playwright && playwright install chromium
(ou apontar executable_path para um Chrome já instalado).

As contas de professor e aluno precisam existir no banco testado; ajuste
os emails e senhas em CONTAS conforme o ambiente.
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ADMIN_PWD = sys.argv[2] if len(sys.argv) > 2 else "Qn67TgzmqekSazuv"

CONTAS = [
    ("admin",     "admin@unipam.edu.br", ADMIN_PWD,
     ["admin.html","admin-usuarios.html","admin-cursos.html","admin-salas.html",
      "admin-turmas.html","admin-professores.html","admin-csv.html",
      "index.html","mapa.html","professores.html","calendario.html","perfil.html",
      "dashboard.html"]),
    ("professor", "prof@unipam.edu.br", "ProfTeste123",
     ["professor-dashboard.html","mapa.html","professores.html","calendario.html","perfil.html"]),
    ("aluno",     "aluno@unipam.edu.br", "ProfTeste123",
     ["index.html","mapa.html","professores.html","calendario.html","perfil.html"]),
]

async def main():
    falhas = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                    args=["--no-sandbox","--disable-dev-shm-usage"])
        for papel, email, senha, pags in CONTAS:
            ctx = await b.new_context(viewport={"width":1440,"height":1000})
            pg = await ctx.new_page()
            erros, redes = [], []
            pg.on("console", lambda m: erros.append(m.text[:130]) if m.type=="error" else None)
            pg.on("pageerror", lambda e: erros.append(f"JS: {str(e)[:130]}"))
            pg.on("response", lambda r: redes.append(f"{r.status} {r.url.replace(BASE,'')[:62]}") if r.status>=400 else None)

            await pg.goto(f"{BASE}/login.html", wait_until="load")
            await pg.fill("#emailDesktop", email)
            await pg.fill("#passwordDesktop", senha)
            await pg.click("#loginBtnDesktop"); await pg.wait_for_timeout(3500)
            pouso = pg.url.split("/")[-1]
            print(f"\n{'='*62}\n{papel.upper()}  login -> {pouso}")
            if pouso == "login.html":
                print("  !! LOGIN FALHOU"); falhas += 1
                await ctx.close(); continue

            for nome in pags:
                erros.clear(); redes.clear()
                try:
                    await pg.goto(f"{BASE}/{nome}", wait_until="load", timeout=30000)
                except Exception as e:
                    print(f"  {nome:<26} NAVEGACAO FALHOU: {e}"); falhas += 1; continue
                await pg.wait_for_timeout(2600)

                # clica em abas internas, se houver
                abas = await pg.query_selector_all(
                    ".tab, .tab-btn, [role='tab'], .nav-tab, .admin-tab")
                for aba in abas[:6]:
                    try:
                        await aba.click(); await pg.wait_for_timeout(700)
                    except Exception:
                        pass

                final = pg.url.split("/")[-1].split("?")[0]
                visivel = await pg.evaluate("""() => {
                    const m = document.body.innerText.match(
                        /[^\\n]*(rro ao|não foi possível|indisponível|falhou)[^\\n]*/gi);
                    return m ? [...new Set(m)].slice(0,3) : [];
                }""")
                mau = erros or redes or visivel or (final != nome)
                marca = "FALHA" if mau else "ok"
                print(f"  {nome:<26} {marca}" + (f"  (-> {final})" if final != nome else ""))
                if mau:
                    falhas += 1
                    for e in list(dict.fromkeys(erros))[:3]:   print(f"      JS   {e}")
                    for r in list(dict.fromkeys(redes))[:4]:   print(f"      HTTP {r}")
                    for v in visivel:                          print(f"      TELA {v.strip()[:95]}")
            await ctx.close()
        await b.close()
    print(f"\n{'='*62}\nTOTAL DE PAGINAS COM PROBLEMA: {falhas}")
    return falhas

sys.exit(0 if asyncio.run(main()) == 0 else 1)
