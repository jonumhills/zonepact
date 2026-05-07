// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ZonePactOracle
 * @notice Stores Merkle roots and data hashes for ZonePact petition datasets,
 *         providing tamper-proof provenance for rezoning data scraped from county records.
 *
 * Deployment target: Base Sepolia (chain ID 84532)
 *
 * Usage:
 *   1. Run `python3 scripts/build_merkle.py` to generate merkle_artifact.json
 *   2. Call `updateDataset(merkleRoot, dataHash, totalPetitions, "arlington_va+raleigh_nc")`
 *   3. Anyone can call `verifyDataset(merkleRoot, dataHash)` to confirm the data
 */
contract ZonePactOracle {

    // ── Events ────────────────────────────────────────────────────────────────

    event DatasetUpdated(
        uint256 indexed updateId,
        bytes32 merkleRoot,
        bytes32 dataHash,
        uint256 totalPetitions,
        string  countyIds,
        uint256 timestamp
    );

    event LeafVerified(bytes32 indexed merkleRoot, bytes32 leaf, bool valid);

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;

    struct DatasetRecord {
        bytes32 merkleRoot;
        bytes32 dataHash;
        uint256 totalPetitions;
        string  countyIds;
        uint256 timestamp;
        address submittedBy;
    }

    DatasetRecord[] public records;

    // Latest record for quick lookup
    DatasetRecord public latest;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ZonePactOracle: not owner");
        _;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * @notice Update the on-chain dataset commitment.
     * @param merkleRoot  Root of the Merkle tree (keccak256, sortPairs=true)
     * @param dataHash    keccak256 of the full serialised petition JSON
     * @param totalPetitions  Number of petitions included in this snapshot
     * @param countyIds   Comma-separated county identifiers (e.g. "arlington_va,raleigh_nc")
     */
    function updateDataset(
        bytes32 merkleRoot,
        bytes32 dataHash,
        uint256 totalPetitions,
        string calldata countyIds
    ) external onlyOwner {
        DatasetRecord memory rec = DatasetRecord({
            merkleRoot:      merkleRoot,
            dataHash:        dataHash,
            totalPetitions:  totalPetitions,
            countyIds:       countyIds,
            timestamp:       block.timestamp,
            submittedBy:     msg.sender,
        });

        records.push(rec);
        latest = rec;

        emit DatasetUpdated(
            records.length - 1,
            merkleRoot,
            dataHash,
            totalPetitions,
            countyIds,
            block.timestamp
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * @notice Verify that a given merkleRoot + dataHash pair matches the latest record.
     */
    function verifyDataset(bytes32 merkleRoot, bytes32 dataHash) external view returns (bool) {
        return latest.merkleRoot == merkleRoot && latest.dataHash == dataHash;
    }

    /**
     * @notice Verify a single leaf is part of the latest Merkle tree using an inclusion proof.
     * @param leaf   keccak256 of a single serialised petition JSON
     * @param proof  Merkle proof (array of sibling hashes)
     */
    function verifyLeaf(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            // sortPairs: always hash (min, max)
            if (computed <= sibling) {
                computed = keccak256(abi.encodePacked(computed, sibling));
            } else {
                computed = keccak256(abi.encodePacked(sibling, computed));
            }
        }
        return computed == latest.merkleRoot;
    }

    /**
     * @notice Number of dataset snapshots committed on-chain.
     */
    function recordCount() external view returns (uint256) {
        return records.length;
    }

    /**
     * @notice Retrieve a historical record by index.
     */
    function getRecord(uint256 index) external view returns (DatasetRecord memory) {
        require(index < records.length, "ZonePactOracle: index out of range");
        return records[index];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZonePactOracle: zero address");
        owner = newOwner;
    }
}
