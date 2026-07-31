from fastapi import APIRouter, HTTPException
from ..repositories import approval_repo

router = APIRouter(prefix="/api/approvals", tags=["审批管理"])


@router.get("/flows")
async def list_flows():
    return approval_repo.list_flows()


@router.post("/flows", status_code=201)
async def save_flow(data: dict):
    return approval_repo.save_flow(
        biz_type=data.get("bizType", ""),
        nodes=data.get("nodes", []),
    )


@router.get("")
async def list_requests(bizType: str = None, status: str = None, applicant: str = None):
    requests = approval_repo.list_requests(biz_type=bizType, status=status, applicant=applicant)
    result = []
    for r in requests:
        records = approval_repo.get_records(r["id"])
        result.append({**r, "records": records})
    return result


@router.get("/{request_id}")
async def get_request(request_id: int):
    request = approval_repo.get_request(request_id)
    if not request:
        raise HTTPException(404, "审批单不存在")
    records = approval_repo.get_records(request_id)
    return {**request, "records": records}


@router.post("", status_code=201)
async def create_request(data: dict):
    return approval_repo.create_request(data)


@router.post("/{request_id}/act")
async def act_on_request(request_id: int, data: dict):
    action = data.get("action")
    approver = data.get("approver")
    if not action or not approver:
        raise HTTPException(400, "action 和 approver 必填")

    result = approval_repo.act_on_request(
        request_id=request_id,
        action=action,
        approver=approver,
        comment=data.get("comment"),
    )
    if not result:
        raise HTTPException(404, "审批单不存在")
    return result


@router.get("/stats/overview")
async def get_stats():
    return approval_repo.get_stats()
