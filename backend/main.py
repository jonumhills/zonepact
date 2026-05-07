"""
ZonePact Backend — FastAPI + Claude/Bedrock agent + x402 Base Sepolia gate
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routes.chat import router as chat_router
from routes.parcels import router as parcels_router

# ── AWS service availability (no credentials = graceful no-op) ───────────────
_AWS_KEY    = bool(os.getenv("AWS_ACCESS_KEY_ID"))
_SNS_ARN    = bool(os.getenv("SNS_TOPIC_ARN"))
_S3_BUCKET  = os.getenv("S3_BUCKET", "zonepact-reports")
_AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

app = FastAPI(title="ZonePact API", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(parcels_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "zonepact-api"}


@app.get("/api/aws-status")
async def aws_status():
    """
    Reports which AWS services are wired into ZonePact.
    Returns configured=true/false for each service — no credentials needed to call this.
    """
    bedrock_active = _AWS_KEY and bool(os.getenv("AWS_SECRET_ACCESS_KEY"))
    return {
        "region": _AWS_REGION,
        "services": {
            "bedrock": {
                "description": "Amazon Bedrock — Claude inference (primary AI backend in production)",
                "model":       "anthropic.claude-opus-4-5",
                "configured":  bedrock_active,
                "active":      bedrock_active,
                "fallback":    "Anthropic direct API (local dev)",
            },
            "s3": {
                "description": "Amazon S3 — verified land-record report storage",
                "bucket":      _S3_BUCKET,
                "key_pattern": "reports/{county}/{petition}-{date}.json",
                "configured":  _AWS_KEY,
                "active":      _AWS_KEY,
                "fallback":    "report_url omitted from response",
            },
            "sns": {
                "description": "Amazon SNS — parcel-watch email alerts",
                "topic_arn":   os.getenv("SNS_TOPIC_ARN", "(not set)"),
                "configured":  _SNS_ARN,
                "active":      _AWS_KEY and _SNS_ARN,
                "fallback":    "POST /api/watch returns error (SNS not configured)",
            },
        },
        "note": (
            "All AWS integrations are coded and wired. "
            "Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to activate. "
            "Local demo runs on Anthropic direct API with graceful no-ops for S3/SNS."
        ),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
