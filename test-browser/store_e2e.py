"""End-to-end test of Admit (the demo ticket platform) against a real Aevify app and a local chain.

Prerequisites (see test-browser/README.md):
  - a Hardhat node on RPC_URL with Aevify's contracts deployed and test wallets funded
  - Aevify's web app in memory test mode on AEVIFY_URL
This script sets up the Admit merchant in Aevify's dashboard, funds the agent, starts the
store, then buys tickets as a customer (through the @aevify/react modal) and as the AI agent.
"""
import json, os, re, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

expect.set_options(timeout=30000)
AEVIFY = os.environ.get("AEVIFY_URL", "http://localhost:3600")
STORE = os.environ.get("STORE_URL", "http://localhost:3001")
RPC = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
CHECKOUT = os.environ.get("CHECKOUT_ADDRESS", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
OUT = os.environ.get("SCREENSHOTS_DIR", "test-browser/screenshots")
os.makedirs(OUT, exist_ok=True)

PAYOUT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"     # Hardhat #1
FUNDER = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"     # Hardhat #4 (funded with tUSD8)
CUSTOMER = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"   # Hardhat #5 (funded with tUSD8)
AGENT = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"      # Hardhat #7
AGENT_KEY = "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"

WALLET_JS = """
(() => {
  const cfg = %s;
  const provider = {
    isMetaMask: true,
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [cfg.account];
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      const res = await fetch(cfg.rpc, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
      const j = await res.json();
      if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
      return j.result;
    },
    on() {}, removeListener() {},
  };
  window.ethereum = provider;
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
    info: { uuid: 'test-wallet', name: 'Test Wallet', rdns: 'dev.aevify.testwallet', icon: '' }, provider } }));
  window.addEventListener('eip6963:requestProvider', announce);
})();
"""

results = []
def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name, flush=True)

def rpc(method, params):
    req = urllib.request.Request(RPC, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        body = json.loads(r.read())
    if "error" in body:
        raise RuntimeError(body["error"])
    return body["result"]

def http_json(url, method="GET", body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def fund_agent(amount_units):
    token = "0x" + rpc("eth_call", [{"to": CHECKOUT, "data": "0xfc0c546a"}, "latest"])[-40:]  # token()
    data = "0xa9059cbb" + AGENT[2:].lower().rjust(64, "0") + hex(amount_units)[2:].rjust(64, "0")  # transfer()
    tx = rpc("eth_sendTransaction", [{"from": FUNDER, "to": token, "data": data}])
    for _ in range(50):
        if rpc("eth_getTransactionReceipt", [tx]):
            return
        time.sleep(0.2)

def wait_for(url, seconds=120):
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=5)
            return True
        except Exception:
            time.sleep(1)
    return False

store_proc = None
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------------- Aevify: set up the Admit merchant ----------------
        m = browser.new_context(viewport={"width": 1280, "height": 860})
        m.add_init_script(WALLET_JS % json.dumps({"account": PAYOUT, "rpc": RPC}))
        m.add_cookies([{"name": "aevify_test_user", "value": "owner@admit.example", "url": AEVIFY}])
        page = m.new_page(); page.set_default_timeout(60000)
        page.goto(AEVIFY + "/dashboard")
        page.get_by_placeholder("Demo Store").fill("Admit")
        page.get_by_role("button", name="Continue").click()
        expect(page.get_by_role("heading", name="Overview")).to_be_visible()
        page.get_by_role("link", name="Settings").first.click()
        page.get_by_role("button", name="Connect wallet").click()
        if page.get_by_test_id("wallet-picker").count():
            page.get_by_role("button", name="Test Wallet").click()
        expect(page.get_by_text("Verified on Aevum")).to_be_visible()
        page.get_by_role("link", name="Developers").first.click()
        page.get_by_role("button", name="Create secret key").click()
        secret = page.get_by_test_id("new-secret-key").inner_text().strip()
        keys = page.evaluate("fetch('/api/merchant/keys').then(r => r.json())")
        pk = next(k["key"] for k in keys["data"] if k["kind"] == "publishable")
        merchant = page.evaluate("fetch('/api/merchant').then(r => r.json())")
        whsec = (merchant.get("merchant") or merchant)["webhookSecret"]
        check("Aevify merchant ready (keys + verified payout wallet)", secret.startswith("sk_test_") and pk.startswith("pk_test_") and whsec.startswith("whsec_"))

        fund_agent(50_000_000)  # 50 tUSD8

        # ---------------- Start the store with those keys ----------------
        env = dict(os.environ,
                   STORE_TEST_MODE="memory", AEVIFY_BASE_URL=AEVIFY, AEVIFY_SECRET_KEY=secret, AEVIFY_PUBLISHABLE_KEY=pk,
                   AEVIFY_WEBHOOK_SECRET=whsec, STORE_URL=STORE, AGENT_PRIVATE_KEY=AGENT_KEY, AGENT_EXPECTED_CHAIN_ID="31337",
                   AGENT_RPC_URL=RPC, ORDER_SYNC_AFTER_SECONDS="3", NEXT_TELEMETRY_DISABLED="1")
        store_proc = subprocess.Popen(["npx", "next", "dev", "-p", STORE.rsplit(":", 1)[1]], env=env,
                                      stdout=open("/tmp/store-e2e.log", "w"), stderr=subprocess.STDOUT)
        check("store starts", wait_for(STORE + "/api/tickets"))
        health = http_json(STORE + "/api/health")
        check("store health is ok", health["status"] == "ok" and health["aevify"] == "ok")

        # ---------------- Customer: pick tickets, pay in the @aevify/react modal ----------------
        c = browser.new_context(viewport={"width": 1280, "height": 900})
        c.add_init_script(WALLET_JS % json.dumps({"account": CUSTOMER, "rpc": RPC}))
        s = c.new_page(); s.set_default_timeout(60000)
        s.goto(STORE)
        expect(s.get_by_role("heading", name=re.compile("Tickets"))).to_be_visible()
        s.wait_for_timeout(800)
        s.screenshot(path=f"{OUT}/01-home.png")
        s.get_by_role("link", name="Eko Night Sessions").click()
        expect(s.get_by_role("heading", name="Eko Night Sessions")).to_be_visible()
        s.get_by_role("radio", name=re.compile("Floor")).click()
        s.get_by_role("button", name="One more ticket").click()
        expect(s.get_by_test_id("total")).to_contain_text("12.00")
        check("2 floor tickets total 12.00", "12.00" in s.get_by_test_id("total").inner_text())
        s.screenshot(path=f"{OUT}/02-event.png")
        s.get_by_role("button", name="Pay 12.00 tUSD8").click()
        frame = s.frame_locator("iframe").first
        frame.get_by_role("button", name=re.compile("Connect wallet to pay|Pay with Test Wallet")).click()
        expect(frame.get_by_role("button", name="Pay 12.00 tUSD8")).to_be_visible()
        s.screenshot(path=f"{OUT}/03-aevify-modal.png")
        frame.get_by_role("button", name="Pay 12.00 tUSD8").click()
        s.wait_for_url(re.compile(r"/orders/ord_"), timeout=90000)
        expect(s.get_by_test_id("order-headline")).to_contain_text("You're in", timeout=60000)
        check("customer order is paid and tickets issued", "You're in" in s.get_by_test_id("order-headline").inner_text())
        check("two ticket stubs issued", s.get_by_test_id("tickets").locator("li").count() == 2 and s.get_by_text("Admit one").count() == 2)
        s.screenshot(path=f"{OUT}/04-tickets.png", full_page=True)
        order_id = s.url.rsplit("/", 1)[1]
        order = http_json(f"{STORE}/api/orders/{order_id}")["order"]
        check("order paid by the customer's wallet, 12.00 tUSD8", order["paidBy"].lower() == CUSTOMER.lower() and order["total"] == "12.00")

        # ---------------- AI agent ----------------
        s.goto(STORE + "/agent")
        expect(s.get_by_test_id("agent-address")).to_contain_text(AGENT[:6])
        expect(s.get_by_test_id("agent-balance")).to_have_text("50.00")
        s.get_by_role("button", name=re.compile("Book 1 pass")).click()
        expect(s.get_by_test_id("agent-result")).to_be_visible(timeout=90000)
        result = s.get_by_test_id("agent-result").inner_text()
        check("agent pays for one pass", "paid" in result and "9.00" in result)
        steps = s.get_by_test_id("agent-steps").inner_text()
        check("agent verified the checkout before paying", all(x in steps for x in ["Merchant is verified on Aevum", "Only my wallet can pay it", "Amount matches the listed price"]))
        s.screenshot(path=f"{OUT}/05-agent-paid.png", full_page=True)

        s.get_by_role("button", name=re.compile("Book 3 passes")).click()
        expect(s.get_by_test_id("agent-result")).to_contain_text("Needs human approval", timeout=60000)
        check("agent asks a human above its per-order limit", "per-order limit" in s.get_by_test_id("agent-result").inner_text())
        s.screenshot(path=f"{OUT}/06-agent-needs-approval.png", full_page=True)

        s.get_by_role("button", name=re.compile("Book 1 pass")).click()
        expect(s.get_by_test_id("agent-result")).to_contain_text("paid", timeout=90000)
        expect(s.get_by_test_id("agent-spent")).to_contain_text("18.00 of 25.00")
        s.get_by_role("button", name=re.compile("Book 1 pass")).click()
        expect(s.get_by_test_id("agent-result")).to_contain_text("daily budget", timeout=60000)
        check("agent stops at its daily budget (18 + 9 > 25)", "daily budget" in s.get_by_test_id("agent-result").inner_text())

        # ---------------- Live sales feed ----------------
        s.goto(STORE + "/orders")
        expect(s.get_by_test_id("orders-feed")).to_be_visible()
        feed = s.get_by_test_id("orders-feed").inner_text().lower()
        check("feed shows customer and agent orders, all paid", feed.count("ai agent") == 2 and "customer" in feed and "awaiting payment" not in feed)
        s.screenshot(path=f"{OUT}/07-orders-feed.png", full_page=True)

        # ---------------- Signed webhooks from Aevify ----------------
        body = json.dumps({"id": "evt_forged", "object": "event", "type": "payment.paid", "data": {"object": {"orderId": order_id}}})
        ts = str(int(time.time()))
        bad = urllib.request.Request(STORE + "/api/aevify/webhook", method="POST", data=body.encode(),
                                     headers={"content-type": "application/json", "aevify-signature": f"t={ts},v1=deadbeef"})
        try:
            urllib.request.urlopen(bad); check("webhook with a bad signature is rejected", False)
        except urllib.error.HTTPError as e:
            check("webhook with a bad signature is rejected", e.code == 400)

        # ---------------- Phones ----------------
        mobile = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
        mp = mobile.new_page()
        widths = {}
        for path in ["/", "/events/lagos-tech-summit", "/events/eko-night-sessions", f"/orders/{order_id}", "/orders", "/agent"]:
            mp.goto(STORE + path, wait_until="networkidle"); mp.wait_for_timeout(400)
            widths[path] = mp.evaluate("document.documentElement.scrollWidth")
        mp.goto(STORE); mp.wait_for_timeout(500); mp.screenshot(path=f"{OUT}/08-mobile-home.png")
        check(f"every page fits a 375px phone {widths}", all(w <= 375 for w in widths.values()))
        browser.close()
finally:
    if store_proc:
        store_proc.terminate()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
