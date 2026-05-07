#!/usr/bin/env python3
"""
build_merkle.py — Hash all petition datasets into a Merkle tree and write the
root + dataHash to a JSON artifact for on-chain submission to ZonePactOracle.sol.

Usage:
    python3 scripts/build_merkle.py [--dry-run]

Output:
    scripts/merkle_artifact.json
"""
import json
import hashlib
import argparse
import os
import sys
from datetime import datetime, timezone

DATA_DIR     = os.path.join(os.path.dirname(__file__), '..', 'data')
ARTIFACT_OUT = os.path.join(os.path.dirname(__file__), 'merkle_artifact.json')


# ── Keccak-256 via SHA3-256 shim (standard library only) ─────────────────────
# For production: pip install pysha3 and use sha3_256, or pip install eth-hash[pycryptodome]

_sha256_warned = False

def keccak256(data: bytes) -> bytes:
    """keccak256 using the Ethereum-compatible implementation."""
    global _sha256_warned
    try:
        import sha3  # pysha3
        k = sha3.keccak_256()
        k.update(data)
        return k.digest()
    except ImportError:
        pass
    try:
        from Crypto.Hash import keccak
        k = keccak.new(digest_bits=256)
        k.update(data)
        return k.digest()
    except ImportError:
        pass
    # Fallback: SHA-256 (NOT keccak — warn once)
    if not _sha256_warned:
        print("WARNING: pysha3 / pycryptodome not found — using SHA-256 (not keccak-256).")
        print("         For correct on-chain verification: pip install pysha3")
        _sha256_warned = True
    return hashlib.sha256(data).digest()


def hash_petition(petition: dict) -> str:
    """Return hex hash of a single petition's canonical JSON."""
    canonical = json.dumps(petition, sort_keys=True, separators=(',', ':'))
    return '0x' + keccak256(canonical.encode('utf-8')).hex()


def build_tree(leaves: list[bytes]) -> tuple[list[list[bytes]], bytes]:
    """
    Build a Merkle tree (sortPairs=True to match solidity-merkle-tree / MerkleTree.js).
    Returns (levels, root).
    """
    if not leaves:
        return [[b'\x00' * 32]], b'\x00' * 32
    if len(leaves) == 1:
        return [leaves], leaves[0]

    levels = [leaves[:]]
    while len(levels[-1]) > 1:
        prev = levels[-1]
        if len(prev) % 2 == 1:
            prev = prev + [prev[-1]]   # duplicate last leaf if odd
        next_level = []
        for i in range(0, len(prev), 2):
            a, b = prev[i], prev[i + 1]
            # sortPairs: always hash smaller first
            pair = keccak256((min(a, b) + max(a, b)))
            next_level.append(pair)
        levels.append(next_level)

    return levels, levels[-1][0]


def load_petitions(path: str) -> list:
    with open(path) as f:
        d = json.load(f)
    return d.get('petitions', d) if isinstance(d, dict) else d


def main():
    parser = argparse.ArgumentParser(description='Build Merkle tree for petition data')
    parser.add_argument('--dry-run', action='store_true', help='Print result without writing artifact')
    args = parser.parse_args()

    datasets = {
        'arlington_va': os.path.join(DATA_DIR, 'petitions.json'),
        'raleigh_nc':   os.path.join(DATA_DIR, 'raleigh_petitions.json'),
    }

    all_petitions = []
    leaves_hex    = []
    dataset_hashes = {}

    for county_id, path in datasets.items():
        if not os.path.exists(path):
            print(f"  skip {county_id} — {path} not found")
            continue
        petitions = load_petitions(path)
        print(f"  {county_id}: {len(petitions)} petitions")
        for p in petitions:
            leaf_hex = hash_petition(p)
            leaves_hex.append(leaf_hex)
            all_petitions.append({'county': county_id, **p})
        # Per-county hash
        county_canonical = json.dumps(petitions, sort_keys=True, separators=(',', ':'))
        dataset_hashes[county_id] = '0x' + keccak256(county_canonical.encode()).hex()

    if not leaves_hex:
        print("No petitions found. Exiting.")
        sys.exit(1)

    # Build tree
    leaf_bytes = [bytes.fromhex(h[2:]) for h in leaves_hex]
    levels, root_bytes = build_tree(leaf_bytes)
    merkle_root = '0x' + root_bytes.hex()

    # Hash of combined dataset
    combined = json.dumps(all_petitions, sort_keys=True, separators=(',', ':'))
    data_hash = '0x' + keccak256(combined.encode()).hex()

    artifact = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'total_petitions': len(all_petitions),
        'merkle_root': merkle_root,
        'data_hash': data_hash,
        'dataset_hashes': dataset_hashes,
        'leaf_count': len(leaves_hex),
        'tree_depth': len(levels),
        'leaves': leaves_hex,  # keep for proof generation
        'note': 'Submit merkle_root + data_hash to ZonePactOracle.sol on Base Sepolia',
    }

    print(f"\nMerkle Root : {merkle_root}")
    print(f"Data Hash   : {data_hash}")
    print(f"Petitions   : {len(all_petitions)}")
    print(f"Tree depth  : {len(levels)}")

    if not args.dry_run:
        with open(ARTIFACT_OUT, 'w') as f:
            json.dump(artifact, f, indent=2)
        print(f"\nArtifact written to {ARTIFACT_OUT}")


if __name__ == '__main__':
    main()
