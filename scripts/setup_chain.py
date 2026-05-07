"""
setup_chain.py

All-in-one script for the ZonePact Base Sepolia setup:

  Step 1 — Generate admin wallet (run once)
  Step 2 — Deploy ZonePactRegistry contract
  Step 3 — Fetch real Raleigh petitions from Supabase
  Step 4 — Batch upload all petitions on-chain

Usage:
  pip install web3 py-solc-x supabase python-dotenv
  python3 scripts/setup_chain.py --step wallet     # generate wallet
  python3 scripts/setup_chain.py --step deploy     # deploy contract
  python3 scripts/setup_chain.py --step upload     # fetch + upload petitions
  python3 scripts/setup_chain.py --step all        # deploy + upload in one go
"""

import os, sys, json, time, argparse
from pathlib import Path
from datetime import datetime

# ── Load .env ─────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
BASE_SEPOLIA_RPC = "https://sepolia.base.org"
BASE_SEPOLIA_CHAIN_ID = 84532
CONTRACT_PATH    = ROOT / "contracts" / "ZonePactRegistry.sol"
ENV_PATH         = ROOT / ".env"

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dhdqxsrgdurcuadmbypj.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZHF4c3JnZHVyY3VhZG1ieXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDA3NDUsImV4cCI6MjA4NTg3Njc0NX0.QxhgRS33CTDWWZvzmZ2Nv16mkLIPa4slPJ3_ZTcu3mU"
)

BATCH_SIZE = 20   # petitions per transaction (safe for Base Sepolia gas limit)

# ── Step 1: Generate admin wallet ─────────────────────────────────────────────

def step_wallet():
    from eth_account import Account
    import secrets

    existing_key = os.getenv("ADMIN_PRIVATE_KEY")
    if existing_key and existing_key.startswith("0x") and len(existing_key) == 66:
        acct = Account.from_key(existing_key)
        print(f"[wallet] Already configured — {acct.address}")
        return acct.address, existing_key

    private_key = "0x" + secrets.token_hex(32)
    acct = Account.from_key(private_key)

    # Append to .env
    with open(ENV_PATH, "a") as f:
        f.write(f"\n# Admin wallet — Base Sepolia (generated {datetime.utcnow().isoformat()}Z)\n")
        f.write(f"ADMIN_PRIVATE_KEY={private_key}\n")
        f.write(f"ADMIN_ADDRESS={acct.address}\n")

    print()
    print("=" * 60)
    print("  NEW ADMIN WALLET GENERATED")
    print("=" * 60)
    print(f"  Address:     {acct.address}")
    print(f"  Private key: {private_key}")
    print()
    print("  ACTION REQUIRED — fund this address with Base Sepolia ETH:")
    print("  https://www.coinbase.com/faucets/base-ethereum-goerli-faucet")
    print("  (or: https://faucet.quicknode.com/base/sepolia)")
    print()
    print("  Saved to .env — do NOT commit private key to git")
    print("=" * 60)

    return acct.address, private_key


# ── Step 2: Deploy contract ───────────────────────────────────────────────────

def _compile_contract():
    """Compile via Node.js solc package (ARM64 compatible). Returns (abi, bytecode)."""
    import subprocess

    scripts_dir  = ROOT / "scripts"
    compiled_out = scripts_dir / "compiled.json"

    # Install solc npm package if needed
    if not (scripts_dir / "node_modules" / "solc").exists():
        print("[deploy] Installing solc npm package ...")
        r = subprocess.run(["npm", "install"], cwd=str(scripts_dir),
                           capture_output=True, text=True)
        if r.returncode != 0:
            print("[deploy] npm install failed:", r.stderr)
            sys.exit(1)

    # Compile
    r = subprocess.run(["node", "compile.js"], cwd=str(scripts_dir),
                       capture_output=True, text=True)
    if r.returncode != 0:
        print("[deploy] Compilation failed:", r.stderr or r.stdout)
        sys.exit(1)
    print(f"[deploy] {r.stdout.strip()}")

    result = json.loads(compiled_out.read_text())
    return result["abi"], result["bytecode"]


def step_deploy():
    from web3 import Web3
    from eth_account import Account

    private_key = os.getenv("ADMIN_PRIVATE_KEY")
    if not private_key:
        print("[deploy] ERROR: ADMIN_PRIVATE_KEY not set. Run --step wallet first.")
        sys.exit(1)

    acct = Account.from_key(private_key)
    w3   = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print("[deploy] ERROR: Cannot connect to Base Sepolia RPC.")
        sys.exit(1)

    balance = w3.eth.get_balance(acct.address)
    print(f"[deploy] Admin: {acct.address}")
    print(f"[deploy] Balance: {w3.from_wei(balance, 'ether'):.6f} ETH")
    if balance < w3.to_wei(0.001, "ether"):
        print("[deploy] ERROR: Insufficient balance. Fund the wallet first.")
        sys.exit(1)

    # Compile using Node.js (ARM64 safe)
    print("[deploy] Compiling ZonePactRegistry.sol ...")
    abi, bytecode = _compile_contract()

    # Deploy
    print("[deploy] Deploying to Base Sepolia ...")
    Contract  = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce     = w3.eth.get_transaction_count(acct.address)
    gas_price = w3.eth.gas_price

    tx = Contract.constructor().build_transaction({
        "chainId":  BASE_SEPOLIA_CHAIN_ID,
        "from":     acct.address,
        "nonce":    nonce,
        "gasPrice": gas_price,
    })
    tx["gas"] = w3.eth.estimate_gas(tx)

    signed   = acct.sign_transaction(tx)
    tx_hash  = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"[deploy] Tx sent: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        print("[deploy] ERROR: Deployment tx reverted.")
        sys.exit(1)

    contract_address = receipt.contractAddress
    print(f"[deploy] Contract deployed: {contract_address}")
    print(f"[deploy] View on BaseScan: https://sepolia.basescan.org/address/{contract_address}")

    # Save ABI + address
    artifact = {
        "address":  contract_address,
        "abi":      abi,
        "network":  "baseSepolia",
        "chainId":  BASE_SEPOLIA_CHAIN_ID,
        "deployer": acct.address,
        "deployedAt": datetime.utcnow().isoformat() + "Z",
        "txHash":   tx_hash.hex(),
    }
    artifact_path = ROOT / "scripts" / "registry_artifact.json"
    artifact_path.write_text(json.dumps(artifact, indent=2))
    print(f"[deploy] Artifact saved to scripts/registry_artifact.json")

    # Update .env
    _upsert_env("REGISTRY_ADDRESS", contract_address)
    _upsert_env("VITE_REGISTRY_ADDRESS", contract_address)

    return contract_address, abi


# ── Step 3: Fetch petitions from Supabase ─────────────────────────────────────

def step_fetch():
    from supabase import create_client

    print(f"[fetch] Connecting to Supabase ...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    all_petitions = []
    page_size     = 500
    offset        = 0

    while True:
        res = (
            sb.table("petitions")
            .select(
                "petition_number, petitioner, address, location, "
                "current_zoning, proposed_zoning, status, vote_result, meeting_date, pins"
            )
            .eq("county_id", "raleigh_nc")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        all_petitions.extend(batch)
        print(f"[fetch] Fetched {len(all_petitions)} petitions ...")
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"[fetch] Total: {len(all_petitions)} Raleigh petitions")
    return all_petitions


# ── Step 4: Batch upload to chain ─────────────────────────────────────────────

def step_upload(petitions=None):
    from web3 import Web3
    from eth_account import Account

    private_key = os.getenv("ADMIN_PRIVATE_KEY")
    if not private_key:
        print("[upload] ERROR: ADMIN_PRIVATE_KEY not set.")
        sys.exit(1)

    artifact_path = ROOT / "scripts" / "registry_artifact.json"
    if not artifact_path.exists():
        print("[upload] ERROR: registry_artifact.json not found. Run --step deploy first.")
        sys.exit(1)

    artifact         = json.loads(artifact_path.read_text())
    contract_address = artifact["address"]
    abi              = artifact["abi"]

    acct = Account.from_key(private_key)
    w3   = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
    if not w3.is_connected():
        print("[upload] ERROR: Cannot connect to Base Sepolia RPC.")
        sys.exit(1)

    contract = w3.eth.contract(address=contract_address, abi=abi)

    if petitions is None:
        petitions = step_fetch()

    # Build upload rows — extract first PIN from pins[] array if available
    rows = []
    for p in petitions:
        pins_raw = p.get("pins") or []
        if isinstance(pins_raw, str):
            import ast
            try: pins_raw = ast.literal_eval(pins_raw)
            except: pins_raw = [pins_raw]
        pin = (pins_raw[0] if pins_raw else "") or ""

        rows.append({
            "pin":             str(pin).strip(),
            "petition_number": str(p.get("petition_number") or "").strip(),
            "petitioner":      str(p.get("petitioner") or "").strip()[:128],
            "present_zoning":  str(p.get("current_zoning") or "").strip(),
            "proposed_zoning": str(p.get("proposed_zoning") or "").strip(),
            "status":          str(p.get("status") or "").strip().lower(),
            "vote_result":     str(p.get("vote_result") or "").strip()[:128],
            "meeting_date":    str(p.get("meeting_date") or "").strip()[:32],
        })

    # Filter out rows with no petition_number
    rows = [r for r in rows if r["petition_number"]]
    print(f"[upload] Uploading {len(rows)} petitions in batches of {BATCH_SIZE} ...")

    gas_price = w3.eth.gas_price
    nonce     = w3.eth.get_transaction_count(acct.address)
    ok = 0
    failed = []

    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE

        try:
            tx = contract.functions.batchRecord(
                [r["pin"]             for r in chunk],
                [r["petition_number"] for r in chunk],
                [r["petitioner"]      for r in chunk],
                [r["present_zoning"]  for r in chunk],
                [r["proposed_zoning"] for r in chunk],
                [r["status"]          for r in chunk],
                [r["vote_result"]     for r in chunk],
                [r["meeting_date"]    for r in chunk],
            ).build_transaction({
                "chainId":  BASE_SEPOLIA_CHAIN_ID,
                "from":     acct.address,
                "nonce":    nonce,
                "gasPrice": gas_price,
            })
            tx["gas"] = w3.eth.estimate_gas(tx)

            signed  = acct.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt.status == 1:
                ok += len(chunk)
                print(f"[upload] Batch {batch_num}/{total_batches} OK — {ok}/{len(rows)} | tx: {tx_hash.hex()[:16]}...")
            else:
                failed.extend(chunk)
                print(f"[upload] Batch {batch_num}/{total_batches} REVERTED")

            nonce += 1
            time.sleep(1)  # avoid nonce issues

        except Exception as e:
            print(f"[upload] Batch {batch_num} ERROR: {e}")
            failed.extend(chunk)
            nonce += 1

    print()
    print("=" * 60)
    print(f"  UPLOAD COMPLETE")
    print(f"  Uploaded: {ok} petitions")
    print(f"  Failed:   {len(failed)}")
    print(f"  Contract: {contract_address}")
    print(f"  View: https://sepolia.basescan.org/address/{contract_address}")
    print("=" * 60)

    # Save upload summary
    summary = {
        "contract":      contract_address,
        "total":         ok,
        "failed":        len(failed),
        "county":        "raleigh_nc",
        "uploadedAt":    datetime.utcnow().isoformat() + "Z",
    }
    (ROOT / "scripts" / "upload_summary.json").write_text(json.dumps(summary, indent=2))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _upsert_env(key: str, value: str):
    text = ENV_PATH.read_text() if ENV_PATH.exists() else ""
    import re
    if re.search(rf"^{key}=", text, re.MULTILINE):
        text = re.sub(rf"^{key}=.*$", f"{key}={value}", text, flags=re.MULTILINE)
    else:
        text += f"\n{key}={value}\n"
    ENV_PATH.write_text(text)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ZonePact Base Sepolia setup")
    parser.add_argument("--step", choices=["wallet", "deploy", "upload", "all"], required=True)
    args = parser.parse_args()

    if args.step == "wallet":
        step_wallet()

    elif args.step == "deploy":
        step_deploy()

    elif args.step == "upload":
        step_upload()

    elif args.step == "all":
        step_deploy()
        step_upload()


if __name__ == "__main__":
    main()
