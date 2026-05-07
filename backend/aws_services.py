"""
AWS integrations for ZonePact:
  - Amazon Bedrock  : Claude inference (primary AI backend)
  - Amazon S3       : Verified land-record report storage
  - Amazon SNS      : Parcel-watch email alerts
"""
import os
import json
import boto3
from datetime import datetime, timezone
from typing import Optional

AWS_REGION            = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
S3_BUCKET             = os.getenv("S3_BUCKET", "zonepact-reports")
SNS_TOPIC_ARN         = os.getenv("SNS_TOPIC_ARN", "")

_aws_kwargs = dict(
    region_name          = AWS_REGION,
    aws_access_key_id    = AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key= AWS_SECRET_ACCESS_KEY or None,
)

# ── Shared boto3 session (lazy, reused) ───────────────────────────────────────

_session: Optional[boto3.Session] = None

def _get_session() -> boto3.Session:
    global _session
    if _session is None:
        _session = boto3.Session(**{k: v for k, v in _aws_kwargs.items() if v})
    return _session


# ── S3: store verified land record ───────────────────────────────────────────

def upload_verification_report(
    petition_number: str,
    parcel: dict,
    onchain: dict,
    county_id: str,
) -> Optional[str]:
    """
    Build a structured verification report and upload to S3.
    Returns a public (or pre-signed) URL, or None if S3 not configured.
    """
    if not AWS_ACCESS_KEY_ID:
        return None
    try:
        report = {
            "generated_at":    datetime.now(timezone.utc).isoformat(),
            "service":         "ZonePact Intelligence",
            "county":          county_id,
            "petition_number": petition_number,
            "parcel": {
                "pin":          parcel.get("arcgis_pin", ""),
                "address":      parcel.get("site_address", ""),
                "owner":        parcel.get("owner", ""),
                "land_use":     parcel.get("type_and_use", ""),
                "area_acres":   parcel.get("area_acres", ""),
                "assessed_value": parcel.get("total_value_assd", ""),
            },
            "rezoning": {
                "present_zoning":  onchain.get("present_zoning", ""),
                "proposed_zoning": onchain.get("proposed_zoning", ""),
                "status":          onchain.get("status", ""),
                "vote_result":     onchain.get("vote_result", ""),
                "meeting_date":    onchain.get("meeting_date", ""),
            },
            "blockchain_proof": {
                "network":   "Base Sepolia (chain 84532)",
                "contract":  onchain.get("contract", ""),
                "basescan":  onchain.get("basescan", ""),
                "recorded_at": onchain.get("recorded_at_iso", ""),
            },
        }

        key  = f"reports/{county_id}/{petition_number}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
        body = json.dumps(report, indent=2)

        s3 = _get_session().client("s3")
        s3.put_object(
            Bucket      = S3_BUCKET,
            Key         = key,
            Body        = body.encode(),
            ContentType = "application/json",
        )
        # Return a 7-day pre-signed URL
        url = s3.generate_presigned_url(
            "get_object",
            Params    = {"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn = 604800,
        )
        return url
    except Exception as e:
        print(f"[aws/s3] upload failed: {e}")
        return None


# ── SNS: subscribe email to parcel watch ─────────────────────────────────────

def subscribe_parcel_watch(email: str, pin: str, address: str) -> dict:
    """
    Subscribe an email address to SNS alerts for a specific parcel PIN.
    Returns {"ok": True, "message": "..."} or {"ok": False, "error": "..."}
    """
    if not SNS_TOPIC_ARN or not AWS_ACCESS_KEY_ID:
        return {"ok": False, "error": "SNS not configured (set SNS_TOPIC_ARN and AWS credentials)"}
    try:
        sns = _get_session().client("sns")
        sns.subscribe(
            TopicArn  = SNS_TOPIC_ARN,
            Protocol  = "email",
            Endpoint  = email,
            Attributes= {
                "FilterPolicy": json.dumps({"pin": [pin]}),
            },
        )
        return {
            "ok":      True,
            "message": f"Confirmation email sent to {email}. Once confirmed, you'll receive alerts for parcel {pin} ({address}).",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def publish_rezoning_alert(pin: str, address: str, petition_number: str,
                           present_zoning: str, proposed_zoning: str) -> bool:
    """Publish a rezoning alert to the SNS topic (called by scraper/cron when new petition detected)."""
    if not SNS_TOPIC_ARN or not AWS_ACCESS_KEY_ID:
        return False
    try:
        sns = _get_session().client("sns")
        sns.publish(
            TopicArn          = SNS_TOPIC_ARN,
            Subject           = f"ZonePact Alert: Rezoning petition filed for {address}",
            Message           = (
                f"A new rezoning petition has been filed for your watched parcel.\n\n"
                f"Address:   {address}\n"
                f"PIN:       {pin}\n"
                f"Case:      {petition_number}\n"
                f"Change:    {present_zoning} → {proposed_zoning}\n\n"
                f"View on ZonePact Intelligence for full blockchain-verified details."
            ),
            MessageAttributes = {
                "pin": {"DataType": "String", "StringValue": pin},
            },
        )
        return True
    except Exception as e:
        print(f"[aws/sns] publish failed: {e}")
        return False
