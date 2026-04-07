from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from modules.whatsapp.service import send_test_message

router = APIRouter()


class TestMessageRequest(BaseModel):
    phone: str  # international format without +, e.g. "526621234567"


@router.post("/test")
async def test_whatsapp(body: TestMessageRequest):
    result = await send_test_message(body.phone)
    if result["status_code"] not in (200, 201):
        raise HTTPException(status_code=result["status_code"], detail=result["body"])
    return result["body"]
