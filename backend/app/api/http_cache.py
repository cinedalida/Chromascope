"""HTTP caching and compression rules for responses. No Firebase and no app state, so they are unit tested on their own."""
from starlette.middleware.gzip import GZipMiddleware
from starlette.staticfiles import StaticFiles

# The catalog is the same list for every user, so a browser may keep it: for 5 minutes without asking, then up to an hour
# while it checks in the background (a 304 when nothing changed). Deliberately no "Vary: Authorization": the sign-in
# token changes every hour, which would make the browser forget the list each time.
PRODUCTS_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=3600"

# Product photos: a week without asking, then a day while the browser checks. Not "immutable": the file names are reused
# when a photo is replaced, so a changed photo shows up within a week at the latest.
PHOTOS_CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=86400"


def etag_matches(header: str | None, etag: str) -> bool:
    """Whether an If-None-Match header names `etag` (or is "*"). Weak validators ("W/...") count as the same tag."""
    if not header:
        return False
    return header.strip() == "*" or any(tag.strip().removeprefix("W/") == etag for tag in header.split(","))


class ApiGZipMiddleware:
    """gzip for /api JSON only (the catalog and filter results shrink about 10x). Product photos are already compressed,
    so they are passed through untouched instead of burning the free server's CPU."""

    def __init__(self, app, minimum_size: int = 1000):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope, receive, send):
        use_gzip = scope["type"] == "http" and scope["path"].startswith("/api")
        await (self.gzip if use_gzip else self.app)(scope, receive, send)


class CachedStaticFiles(StaticFiles):
    """Static files that the browser may keep (PHOTOS_CACHE_CONTROL); a 304 carries the same header."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = PHOTOS_CACHE_CONTROL
        return response
