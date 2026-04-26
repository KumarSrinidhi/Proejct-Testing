from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select


async def paginate_select(
    db: AsyncSession,
    query: Select,
    count_query: Select,
    *,
    page: int,
    page_size: int,
    use_scalars: bool = True,
) -> tuple[int, list[object]]:
    total_result = await db.execute(count_query)
    total = int(total_result.scalar() or 0)

    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    if use_scalars:
        items = result.scalars().all()
    else:
        items = result.all()
    return total, list(items)
