"""HTTP caching rules for the catalog response. Pure (no Firebase, no FastAPI), so it is unit tested on its own."""

# The same list for every user, so a browser may keep it: for 5 minutes without asking, then up to an hour while it checks
# in the background (a 304 when nothing changed). Deliberately no "Vary: Authorization": the sign-in token changes every
# hour, which would make the browser forget the list each time.
PRODUCTS_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=3600"


def etag_matches(header: str | None, etag: str) -> bool:
    """Whether an If-None-Match header names `etag` (or is "*"). Weak validators ("W/...") count as the same tag."""
    if not header:
        return False
    return header.strip() == "*" or any(tag.strip().removeprefix("W/") == etag for tag in header.split(","))
