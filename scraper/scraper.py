#!/usr/bin/env python3
"""
Zonepact Scraper — Arlington County, Virginia
==============================================
Scrapes zoning petitions from Arlington County Board meetings
via the OnBase Agenda Online system (meetings.arlingtonva.us).

Flow:
  1. Fetch home page → extract all meeting IDs with types + dates
  2. Filter for Regular / Recessed meetings
  3. For each meeting, locate the Agenda Packet PDF
  4. Parse PDF to extract petition items (SP, Z, REZN, SPLA, UPER, FBCA...)
     and associated RPC numbers
  5. Determine status from whether meeting is past (has Minutes) or future
  6. Save structured JSON to ../data/petitions.json

Usage:
    cd scraper && python scraper.py
    python scraper.py --days 180          # last 6 months only
    python scraper.py --dry-run           # print without saving
    python scraper.py --max-meetings 5    # limit meetings to parse
"""

import argparse
import io
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("⚠️  pdfplumber not installed — run: pip3 install pdfplumber")

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL   = "https://meetings.arlingtonva.us/CountyBoard"
DATA_FILE  = Path(__file__).parent.parent / "data" / "petitions.json"
HEADERS    = {"User-Agent": "Mozilla/5.0 (compatible; Zonepact/1.0)"}
TIMEOUT    = 45

# Meeting types that contain land-use / zoning items
ZONING_MEETING_TYPES = {
    "county board regular meeting",
    "county board recessed meeting",
}

# ── Arlington County petition/case number patterns ────────────────────────────
# SP #360, SP#481              — Site Plan (legacy number)
# Z-2488, Z-2181               — Rezoning (legacy number)
# SPLA25-00039                 — Site Plan Amendment (year-case)
# SPNB25-00005                 — Site Plan New Building
# SPRC25-00012                 — Site Plan Review / Compliance
# REZN25-00001                 — Rezoning (new format)
# UPER25-00045                 — Use Permit Extension Review
# FBCA25-00008                 — Form-Based Code Amendment
# GLUP25-00001                 — General Land Use Plan amendment

CASE_PATTERNS = [
    r'(?:SP|Z|REZN|SPLA|SPNB|SPRC|UPER|FBCA|GLUP)\d{2}-\d{5}',  # new format
    r'SP\s*#\s*\d{3,4}',                                          # SP #360
    r'Z-\d{3,4}\b',                                               # Z-2488
]
COMBINED_CASE_RE = re.compile('|'.join(CASE_PATTERNS), re.IGNORECASE)

# RPC (Real Property Code): XX-XXX-XXX[X] where last group can contain letters
RPC_RE = re.compile(
    r'RPC[#\s]*:?\s*(\d{2}-\d{3}-[\w]+)',
    re.IGNORECASE,
)

# Case types that are specifically zoning / land-use related
ZONING_CASE_PREFIXES = {
    'SP', 'Z', 'REZN', 'SPLA', 'SPNB', 'SPRC', 'FBCA', 'GLUP',
}


def normalise_case(raw: str) -> str:
    """Normalise whitespace/punctuation in a case number."""
    return re.sub(r'\s+', '', raw).upper().replace('SP#', 'SP#').strip()


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get_html(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def get_pdf_bytes(url: str) -> Optional[bytes]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=90)
        ct = resp.headers.get("content-type", "")
        if "pdf" in ct or resp.content[:4] == b'%PDF':
            return resp.content
        return None
    except Exception as exc:
        print(f"      ⚠️  PDF download failed: {exc}")
        return None


# ── Meeting discovery ─────────────────────────────────────────────────────────

def fetch_meeting_list(days_back: int) -> List[Dict]:
    """
    Parse the home page to get meeting IDs, names, and dates.
    Returns list of {id, name, date, type, has_minutes, pdf_url}.
    """
    soup = get_html(BASE_URL)
    cutoff = datetime.now(tz=timezone.utc).timestamp() - days_back * 86400

    meetings: List[Dict] = []
    seen_ids: set = set()

    rows = soup.find_all('tr')
    for row in rows:
        links = row.find_all('a', href=True)
        id_links = [a for a in links if 'ViewMeeting?id=' in a['href']]
        if not id_links:
            continue

        # Extract meeting ID
        m = re.search(r'id=(\d+)', id_links[0]['href'])
        if not m:
            continue
        meeting_id = int(m.group(1))
        if meeting_id in seen_ids:
            continue
        seen_ids.add(meeting_id)

        # Collect all text in the row
        row_text = row.get_text(separator=' ', strip=True)

        # Find date from row text (e.g. "1/24/2026 9:30:00 AM")
        date_m = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', row_text)
        meeting_date: Optional[str] = None
        if date_m:
            try:
                dt = datetime.strptime(date_m.group(1), '%m/%d/%Y')
                meeting_date = dt.strftime('%Y-%m-%d')
                if dt.timestamp() < cutoff:
                    continue  # too old
            except ValueError:
                pass

        # Extract meeting name from the title <td> or similar
        name_cells = row.find_all('td')
        meeting_name = ''
        for td in name_cells:
            text = td.get_text(strip=True)
            if len(text) > 10 and 'County Board' in text and not re.search(r'^\d', text):
                meeting_name = text
                break
        if not meeting_name:
            meeting_name = f"County Board Meeting {meeting_id}"

        meeting_type = meeting_name.lower()

        # Check if minutes exist (past meeting had a vote)
        has_minutes = bool(row.find('a', string=re.compile('Minutes', re.I)))

        # Find agenda packet PDF link in this row
        pdf_url: Optional[str] = None
        for a in links:
            href = a.get('href', '')
            if 'DownloadFile' in href or 'DownloadFileBytes' in href:
                # Prefer "Agenda Packet" over plain "Agenda"
                a_text = a.get_text(strip=True).lower()
                full = urljoin("https://meetings.arlingtonva.us", href)
                # Prefer Agenda Packet
                if 'packet' in full.lower() or 'packet' in a_text:
                    pdf_url = full
                    break
                elif pdf_url is None:
                    pdf_url = full

        # Convert DownloadFile → DownloadFileBytes so we get the actual file
        if pdf_url and 'DownloadFileBytes' not in pdf_url:
            pdf_url = pdf_url.replace('DownloadFile', 'DownloadFileBytes')

        meetings.append({
            'id':          meeting_id,
            'name':        meeting_name,
            'date':        meeting_date,
            'type':        meeting_type,
            'has_minutes': has_minutes,
            'pdf_url':     pdf_url,
        })

    return meetings


def is_zoning_meeting(meeting: Dict) -> bool:
    t = meeting['type']
    return any(z in t for z in ZONING_MEETING_TYPES)


# ── PDF parsing ───────────────────────────────────────────────────────────────

class AgendaItem:
    def __init__(self):
        self.raw_text:    str            = ''
        self.case_number: Optional[str] = None
        self.case_type:   Optional[str] = None
        self.rpc:         Optional[str] = None
        self.address:     Optional[str] = None
        self.description: str            = ''
        self.petitioner:  Optional[str] = None
        self.present_zoning: Optional[str] = None
        self.proposed_zoning: Optional[str] = None
        self.recommendation: Optional[str] = None


def extract_items_from_pdf(pdf_bytes: bytes) -> List[AgendaItem]:
    if not HAS_PDF:
        return []

    items: List[AgendaItem] = []
    all_text = ''
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            # Only read first 30 pages (agenda overview section)
            for page in pdf.pages[:30]:
                all_text += (page.extract_text() or '') + '\n'
    except Exception as exc:
        print(f"      ⚠️  pdfplumber error: {exc}")
        return []

    # Split text into numbered agenda items
    # Pattern: line starting with a number followed by a period or ")"
    # e.g., "1. SP #360 Site Plan..."  or  "13. REZN25-00001 Rezoning at..."
    item_splits = re.split(r'\n(?=\d{1,2}\.\s+[A-Z])', all_text)

    for chunk in item_splits:
        chunk = chunk.strip()
        if len(chunk) < 20:
            continue

        # Check if this chunk mentions a zoning-related case
        case_matches = COMBINED_CASE_RE.findall(chunk)
        if not case_matches:
            continue

        item = AgendaItem()
        item.raw_text = chunk[:2000]  # cap storage size

        # Use the first case number mentioned
        raw_case = case_matches[0]
        item.case_number = normalise_case(raw_case)

        # Determine case prefix
        prefix_m = re.match(r'^([A-Z]+)', item.case_number.replace('#', '').replace(' ', ''))
        if prefix_m:
            item.case_type = prefix_m.group(1)

        # RPC
        rpc_m = RPC_RE.search(chunk)
        if rpc_m:
            item.rpc = rpc_m.group(1)

        # Address — look for numbered street addresses in Arlington
        addr_m = re.search(
            r'(?:located at|at)\s+(\d{3,5}[A-Z\s,.-]+(?:Blvd|Ave|St|Dr|Rd|Pike|Way|Pl|Ct|Ln|N\.|S\.|E\.|W\.)[^\n;.]{3,60})',
            chunk, re.IGNORECASE
        )
        if addr_m:
            item.address = addr_m.group(1).strip()

        # Description — first 250 chars after case number
        desc_start = chunk.find(raw_case)
        if desc_start >= 0:
            item.description = chunk[desc_start:desc_start + 300].strip()

        # CM Recommendation line
        rec_m = re.search(r'CM\s+Recommendation\s*:?\s*(.{20,200})', chunk, re.DOTALL)
        if rec_m:
            item.recommendation = re.sub(r'\s+', ' ', rec_m.group(1)).strip()[:200]

        # Zoning (present → proposed)
        pz_m = re.search(r'(?:from|present|current)\s+zoning[^\n]*?([\w-]+)\s+(?:to|proposed)\s+([\w-]+)', chunk, re.IGNORECASE)
        if pz_m:
            item.present_zoning  = pz_m.group(1).strip()
            item.proposed_zoning = pz_m.group(2).strip()

        items.append(item)

    return items


# ── Status determination ──────────────────────────────────────────────────────

def infer_status(meeting: Dict, recommendation: Optional[str]) -> str:
    """Status is pending if future; else look at recommendation or default to approved."""
    if not meeting['date']:
        return 'unknown'
    today = datetime.now().strftime('%Y-%m-%d')
    if meeting['date'] > today:
        return 'pending'
    # Past meeting
    if meeting['has_minutes']:
        rec = (recommendation or '').upper()
        if any(x in rec for x in ['DENY', 'DENIED', 'REJECT']):
            return 'denied'
        if any(x in rec for x in ['DEFER', 'POSTPONE', 'CONTINUE', 'TABLE']):
            return 'deferred'
        return 'approved'
    return 'pending'  # past but no minutes yet


# ── Main scraper ──────────────────────────────────────────────────────────────

def scrape(days_back: int = 365, max_meetings: int = 50) -> List[dict]:
    print(f"📋  Fetching meeting list from {BASE_URL} …")
    all_meetings = fetch_meeting_list(days_back)
    zoning_meetings = [m for m in all_meetings if is_zoning_meeting(m)]

    print(f"    {len(all_meetings)} total meetings found, "
          f"{len(zoning_meetings)} Regular/Recessed → processing up to {max_meetings}")

    petitions: List[dict] = []
    seen_cases: set = set()
    processed = 0

    for meeting in zoning_meetings[:max_meetings]:
        meeting_id   = meeting['id']
        meeting_date = meeting['date'] or 'unknown'
        print(f"\n📅  Meeting {meeting_id} — {meeting['name']} ({meeting_date})")

        if not meeting['pdf_url']:
            print(f"    ⚠️  No PDF link found — skipping")
            continue

        print(f"    📄 Downloading agenda packet …")
        pdf_bytes = get_pdf_bytes(meeting['pdf_url'])
        if not pdf_bytes:
            print(f"    ❌ PDF download failed")
            continue

        print(f"    🔍 Parsing {len(pdf_bytes)//1024} KB …")
        items = extract_items_from_pdf(pdf_bytes)
        print(f"    Found {len(items)} zoning item(s)")
        processed += 1

        for item in items:
            # De-duplicate by case number
            if item.case_number and item.case_number in seen_cases:
                continue
            if item.case_number:
                seen_cases.add(item.case_number)

            # Only include items whose prefix is zoning-related
            if item.case_type and item.case_type not in ZONING_CASE_PREFIXES:
                continue

            status = infer_status(meeting, item.recommendation)

            petition = {
                "id":               str(uuid.uuid4()),
                "petition_number":  item.case_number,
                "rpc":              item.rpc,
                "petitioner":       item.petitioner,
                "representative":   None,
                "address":          item.address,
                "present_zoning":   item.present_zoning,
                "proposed_zoning":  item.proposed_zoning,
                "lot_area":         None,
                "meeting_date":     meeting_date,
                "meeting_id":       meeting_id,
                "meeting_title":    meeting['name'],
                "status":           status,
                "vote_result":      None,
                "vote_tally":       None,
                "description":      item.description[:300] if item.description else None,
                "cm_recommendation": item.recommendation,
                "conditions":       [],
                "latitude":         None,
                "longitude":        None,
                "pdf_url":          meeting['pdf_url'],
                "agenda_url":       f"{BASE_URL}/Meetings/ViewMeeting?id={meeting_id}&doctype=1",
                "scraped_at":       datetime.utcnow().isoformat() + "Z",
            }
            petitions.append(petition)
            print(f"    ✅ {item.case_number}  RPC:{item.rpc or '?'}  status:{status}")

    print(f"\n📊  Processed {processed}/{len(zoning_meetings)} meetings, "
          f"extracted {len(petitions)} petition records")
    return petitions


def build_output(petitions: List[dict]) -> dict:
    status_counts: Dict[str, int] = {}
    for p in petitions:
        s = p.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "metadata": {
            "scraped_at":      datetime.utcnow().isoformat() + "Z",
            "source":          BASE_URL,
            "county":          "Arlington",
            "state":           "Virginia",
            "total_petitions": len(petitions),
            "status_counts":   status_counts,
        },
        "petitions": petitions,
    }


def main():
    parser = argparse.ArgumentParser(description="Zonepact Arlington County scraper")
    parser.add_argument("--days",         type=int, default=365, help="Look back N days (default 365)")
    parser.add_argument("--max-meetings", type=int, default=50,  help="Max meetings to parse PDFs for")
    parser.add_argument("--dry-run",      action="store_true",   help="Print results without saving")
    args = parser.parse_args()

    print("=" * 60)
    print("  ZonePact Scraper · Arlington County, VA")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    petitions = scrape(days_back=args.days, max_meetings=args.max_meetings)
    output    = build_output(petitions)

    summary = output['metadata']
    print(f"\n{'=' * 60}")
    print(f"  Petitions scraped : {summary['total_petitions']}")
    print(f"  Status breakdown  : {summary['status_counts']}")
    print(f"{'=' * 60}\n")

    if args.dry_run:
        preview = json.dumps(output, indent=2, default=str)
        print(preview[:3000])
        if len(preview) > 3000:
            print(f"… ({len(petitions)} total records, truncated)")
    else:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        DATA_FILE.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
        print(f"✅  Saved → {DATA_FILE.resolve()}")


if __name__ == "__main__":
    main()
