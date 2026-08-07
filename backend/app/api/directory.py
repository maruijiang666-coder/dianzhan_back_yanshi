from fastapi import APIRouter, HTTPException
from ..repositories import directory_repo

router = APIRouter(prefix="/api/directory", tags=["基础档案"])


# ─── 品牌方 ─────────────────────────────────────────────────

@router.get("/brands")
async def list_brands():
    return directory_repo.list_brands()


@router.post("/brands", status_code=201)
async def create_brand(data: dict):
    return directory_repo.create_brand(
        name=data.get("name", ""),
        contact=data.get("contact"),
        remark=data.get("remark"),
    )


@router.put("/brands/{brand_id}")
async def update_brand(brand_id: int, data: dict):
    result = directory_repo.update_brand(brand_id, **data)
    if not result:
        raise HTTPException(404, "品牌方不存在")
    return result


@router.delete("/brands/{brand_id}")
async def delete_brand(brand_id: int):
    try:
        directory_repo.delete_brand(brand_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ─── 公司主体 ───────────────────────────────────────────────

@router.get("/entities")
async def list_entities():
    return directory_repo.list_entities()


@router.post("/entities", status_code=201)
async def create_entity(data: dict):
    return directory_repo.create_entity(
        name=data.get("name", ""),
        short_name=data.get("shortName"),
        remark=data.get("remark"),
    )


@router.put("/entities/{entity_id}")
async def update_entity(entity_id: int, data: dict):
    result = directory_repo.update_entity(entity_id, **data)
    if not result:
        raise HTTPException(404, "公司主体不存在")
    return result


@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: int):
    try:
        directory_repo.delete_entity(entity_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ─── 场地方 ─────────────────────────────────────────────────

@router.get("/landlords")
async def list_landlords():
    return directory_repo.list_landlords()


@router.post("/landlords", status_code=201)
async def create_landlord(data: dict):
    return directory_repo.create_landlord(
        name=data.get("name", ""),
        contact=data.get("contact"),
        phone=data.get("phone"),
        remark=data.get("remark"),
    )


@router.put("/landlords/{landlord_id}")
async def update_landlord(landlord_id: int, data: dict):
    result = directory_repo.update_landlord(landlord_id, **data)
    if not result:
        raise HTTPException(404, "场地方不存在")
    return result


@router.delete("/landlords/{landlord_id}")
async def delete_landlord(landlord_id: int):
    directory_repo.delete_landlord(landlord_id)
    return {"ok": True}


# ─── 股东 ───────────────────────────────────────────────────

@router.get("/shareholders")
async def list_shareholders():
    return directory_repo.list_shareholders()


@router.post("/shareholders", status_code=201)
async def create_shareholder(data: dict):
    return directory_repo.create_shareholder(
        name=data.get("name", ""),
        phone=data.get("phone"),
        remark=data.get("remark"),
    )


@router.put("/shareholders/{shareholder_id}")
async def update_shareholder(shareholder_id: int, data: dict):
    result = directory_repo.update_shareholder(shareholder_id, **data)
    if not result:
        raise HTTPException(404, "股东不存在")
    return result


@router.delete("/shareholders/{shareholder_id}")
async def delete_shareholder(shareholder_id: int):
    directory_repo.delete_shareholder(shareholder_id)
    return {"ok": True}


# ─── 介绍人 ─────────────────────────────────────────────────

@router.get("/introducers")
async def list_introducers():
    return directory_repo.list_introducers()


@router.post("/introducers", status_code=201)
async def create_introducer(data: dict):
    return directory_repo.create_introducer(
        name=data.get("name", ""),
        phone=data.get("phone"),
        remark=data.get("remark"),
    )


@router.put("/introducers/{introducer_id}")
async def update_introducer(introducer_id: int, data: dict):
    result = directory_repo.update_introducer(introducer_id, **data)
    if not result:
        raise HTTPException(404, "介绍人不存在")
    return result


@router.delete("/introducers/{introducer_id}")
async def delete_introducer(introducer_id: int):
    directory_repo.delete_introducer(introducer_id)
    return {"ok": True}


# ─── 公司主体-品牌方关联 ─────────────────────────────────────

@router.get("/entity-brands")
async def list_entity_brands(entityId: int = None):
    return directory_repo.list_entity_brands(entity_id=entityId)


@router.post("/entity-brands", status_code=201)
async def create_entity_brand(data: dict):
    return directory_repo.create_entity_brand(
        entity_id=data.get("entityId"),
        brand_id=data.get("brandId"),
        remark=data.get("remark"),
    )


@router.delete("/entity-brands/{id}")
async def delete_entity_brand(id: int):
    directory_repo.delete_entity_brand(id)
    return {"ok": True}


# ─── 平台使用人员 ─────────────────────────────────────────────

@router.get("/platform-users")
async def list_platform_users():
    return directory_repo.list_platform_users()


@router.post("/platform-users", status_code=201)
async def create_platform_user(data: dict):
    return directory_repo.create_platform_user(
        name=data.get("name", ""),
        role=data.get("role", ""),
        shareholder_id=data.get("shareholderId"),
        phone=data.get("phone"),
        remark=data.get("remark"),
    )


@router.put("/platform-users/{user_id}")
async def update_platform_user(user_id: int, data: dict):
    result = directory_repo.update_platform_user(
        user_id,
        name=data.get("name"),
        role=data.get("role"),
        shareholder_id=data.get("shareholderId"),
        phone=data.get("phone"),
        remark=data.get("remark"),
    )
    if not result:
        raise HTTPException(404, "用户不存在")
    return result


@router.delete("/platform-users/{user_id}")
async def delete_platform_user(user_id: int):
    directory_repo.delete_platform_user(user_id)
    return {"ok": True}
