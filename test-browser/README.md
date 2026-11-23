# Browser end-to-end test

Runs Admit against a real Aevify app and a local Hardhat chain. You need the
Aevify repo next to this one, Python 3 and Playwright
(`pip install playwright && playwright install chromium`).

```bash
# 1. In the Aevify repo: a local chain with the contracts deployed and test wallets funded
docker compose up chain
docker compose run --rm contracts npm run deploy:local
docker compose run --rm contracts npx hardhat run scripts/fund-test-wallets.ts --network localhost

# 2. In the Aevify repo: the web app in memory test mode on :3600
AEVIFY_TEST_MODE=memory AEVUM_RPC_URL=http://127.0.0.1:8545 AEVUM_PUBLIC_RPC_URL=http://127.0.0.1:8545 \
AEVUM_CHAIN_ID=31337 AEVIFY_CHECKOUT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
AEVIFY_SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
AEVIFY_OPERATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
npx next dev -p 3600            # from apps/web

# 3. Here: the test starts the store itself on :3001
python3 test-browser/store_e2e.py
```

The keys above are Hardhat's public development accounts, for the local chain only.
Screenshots land in `test-browser/screenshots/`.
