// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZonePactRegistry
 * @notice On-chain registry of rezoning petitions for Wake County (Raleigh, NC).
 *         Stores complete zoning history per parcel PIN — enabling DeFi protocols
 *         to verify land status without $5-8k third-party consultants.
 *
 * Deployment: Base Sepolia (chain ID 84532)
 *
 * Key lookups:
 *   getHistory(pin)            → list of petition numbers ever filed on this parcel
 *   getPetition(petitionNumber) → full zoning record for that case
 *   totalPetitions             → how many cases are on-chain
 */
contract ZonePactRegistry {

    // ── Types ─────────────────────────────────────────────────────────────────

    struct PetitionRecord {
        string petitionNumber;   // e.g. "Z-36-2023"
        string pin;              // Wake County parcel PIN
        string petitioner;       // applicant name
        string presentZoning;    // zoning before change
        string proposedZoning;   // requested zoning
        string status;           // pending | approved | denied | deferred
        string voteResult;       // e.g. "Approved 6-1"
        string meetingDate;      // ISO date string
        string county;           // "raleigh_nc"
        uint256 recordedAt;      // block timestamp when stored
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public admin;
    uint256 public totalPetitions;

    // petitionNumber → full record
    mapping(string => PetitionRecord) private _petitions;

    // PIN → ordered list of petitionNumbers (full history)
    mapping(string => string[]) private _history;

    // ── Events ────────────────────────────────────────────────────────────────

    event PetitionRecorded(
        string  indexed pin,
        string  petitionNumber,
        string  presentZoning,
        string  proposedZoning,
        string  status,
        string  voteResult,
        uint256 timestamp
    );

    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ZonePact: not admin");
        _;
    }

    // ── Write (admin only) ────────────────────────────────────────────────────

    /**
     * @notice Batch-record petitions. All arrays must be the same length.
     *         Called by the admin upload script — up to 25 petitions per tx.
     */
    function batchRecord(
        string[] calldata pins,
        string[] calldata petitionNumbers,
        string[] calldata petitioners,
        string[] calldata presentZonings,
        string[] calldata proposedZonings,
        string[] calldata statuses,
        string[] calldata voteResults,
        string[] calldata meetingDates
    ) external onlyAdmin {
        uint256 len = pins.length;
        require(len > 0,                      "ZonePact: empty batch");
        require(len == petitionNumbers.length, "ZonePact: length mismatch");
        require(len <= 25,                     "ZonePact: max 25 per batch");

        for (uint256 i = 0; i < len; i++) {
            string memory pNum = petitionNumbers[i];
            string memory pin  = pins[i];

            _petitions[pNum] = PetitionRecord({
                petitionNumber: pNum,
                pin:            pin,
                petitioner:     petitioners[i],
                presentZoning:  presentZonings[i],
                proposedZoning: proposedZonings[i],
                status:         statuses[i],
                voteResult:     voteResults[i],
                meetingDate:    meetingDates[i],
                county:         "raleigh_nc",
                recordedAt:     block.timestamp
            });

            _history[pin].push(pNum);
            totalPetitions++;

            emit PetitionRecorded(
                pin,
                pNum,
                presentZonings[i],
                proposedZonings[i],
                statuses[i],
                voteResults[i],
                block.timestamp
            );
        }
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "ZonePact: zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /// @notice Returns all petition numbers ever filed against a parcel PIN.
    function getHistory(string calldata pin)
        external view returns (string[] memory)
    {
        return _history[pin];
    }

    /// @notice Returns the full zoning record for a petition number.
    function getPetition(string calldata petitionNumber)
        external view returns (PetitionRecord memory)
    {
        return _petitions[petitionNumber];
    }

    /// @notice Returns full records for every petition in a PIN's history.
    function getFullHistory(string calldata pin)
        external view returns (PetitionRecord[] memory)
    {
        string[] storage nums = _history[pin];
        PetitionRecord[] memory records = new PetitionRecord[](nums.length);
        for (uint256 i = 0; i < nums.length; i++) {
            records[i] = _petitions[nums[i]];
        }
        return records;
    }
}
