"""Run from backend/: python -m unittest tests.test_filter_batch_and_cache"""
import unittest

from pydantic import ValidationError

from app.api.http_cache import PRODUCTS_CACHE_CONTROL, etag_matches
from app.api.schemas import FilterBatchRequest, FilterRequest


class EtagMatches(unittest.TestCase):
    TAG = '"abc123"'

    def test_exact_match(self):
        self.assertTrue(etag_matches('"abc123"', self.TAG))

    def test_weak_validator_and_lists(self):
        self.assertTrue(etag_matches('W/"abc123"', self.TAG))
        self.assertTrue(etag_matches('"other", "abc123"', self.TAG))
        self.assertTrue(etag_matches(' "other" ,  W/"abc123" ', self.TAG))

    def test_star_matches_anything(self):
        self.assertTrue(etag_matches("*", self.TAG))

    def test_no_match(self):
        for header in (None, "", '"different"', '"abc1234"', 'abc123'):
            self.assertFalse(etag_matches(header, self.TAG), header)

    def test_cache_control_is_private_and_has_no_vary_trap(self):
        self.assertIn("private", PRODUCTS_CACHE_CONTROL)
        self.assertRegex(PRODUCTS_CACHE_CONTROL, r"max-age=\d+")


class FilterBatchSchema(unittest.TestCase):
    def test_accepts_the_six_app_categories(self):
        req = FilterBatchRequest(categories=["Face", "Concealer", "Cheeks", "Lips", "Eyes", "Multiuse"])
        self.assertEqual(len(req.categories), 6)

    def test_category_names_are_case_insensitive_like_run_filter(self):
        FilterBatchRequest(categories=["lips", "EYES", "multi-use"])

    def test_profile_fields_are_the_same_as_run_filter(self):
        req = FilterBatchRequest(categories=["Lips"], skin_type="oily", avoid_ingredients=["Fragrance / Parfum"],
                                 user_lab=[38, 14, 14], seasonal_label="Deep Winter")
        self.assertEqual(req.skin_type, "oily")
        self.assertEqual(req.user_lab, [38, 14, 14])

    def test_rejects_empty_too_many_and_unknown(self):
        for categories in ([], ["Lips"] * 7, ["Lips", "Nonsense"]):
            with self.assertRaises(ValidationError):
                FilterBatchRequest(categories=categories)

    def test_rejects_missing_categories_and_extra_fields(self):
        with self.assertRaises(ValidationError):
            FilterBatchRequest()
        with self.assertRaises(ValidationError):
            FilterBatchRequest(categories=["Lips"], surprise=1)

    def test_still_validates_the_profile(self):
        with self.assertRaises(ValidationError):
            FilterBatchRequest(categories=["Lips"], user_lab=[500, 0, 0])
        with self.assertRaises(ValidationError):
            FilterBatchRequest(categories=["Lips"], skin_type="not-a-skin-type")

    def test_single_request_schema_is_unchanged(self):
        self.assertEqual(FilterRequest(category="Lips").category, "Lips")
        with self.assertRaises(ValidationError):
            FilterRequest(category="Lips", categories=["Lips"])


if __name__ == "__main__":
    unittest.main()


# ---- compression and photo caching, through a real (tiny) ASGI app ----
import os
import tempfile

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.testclient import TestClient

from app.api.http_cache import ApiGZipMiddleware, CachedStaticFiles, PHOTOS_CACHE_CONTROL


class CompressionAndPhotoCaching(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        cls.photo_bytes = os.urandom(20000)  # incompressible, like a JPEG
        with open(os.path.join(cls.dir.name, "photo.jpg"), "wb") as fh:
            fh.write(cls.photo_bytes)
        big = [{"id": i, "name": "A product name " * 5} for i in range(200)]
        app = Starlette(routes=[
            Route("/api/products", lambda request: JSONResponse(big)),
            Route("/api/tiny", lambda request: JSONResponse({"ok": True})),
            Route("/other/big", lambda request: JSONResponse(big)),
            Mount("/catalog-images", app=CachedStaticFiles(directory=cls.dir.name)),
        ])
        app.add_middleware(ApiGZipMiddleware, minimum_size=1000)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def get(self, path, **headers):
        return self.client.get(path, headers={"Accept-Encoding": "gzip", **headers})

    def test_api_json_is_gzipped_when_the_client_accepts_it(self):
        r = self.get("/api/products")
        self.assertEqual(r.headers.get("content-encoding"), "gzip")
        self.assertEqual(len(r.json()), 200)  # the client decompressed it

    def test_api_json_is_not_gzipped_for_clients_that_do_not_accept_it(self):
        r = self.client.get("/api/products", headers={"Accept-Encoding": "identity"})
        self.assertIsNone(r.headers.get("content-encoding"))

    def test_small_api_answers_are_left_alone(self):
        self.assertIsNone(self.get("/api/tiny").headers.get("content-encoding"))

    def test_only_api_paths_are_compressed(self):
        self.assertIsNone(self.get("/other/big").headers.get("content-encoding"))

    def test_photos_are_never_gzipped_and_are_served_whole(self):
        r = self.get("/catalog-images/photo.jpg")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.headers.get("content-encoding"))
        self.assertEqual(r.content, self.photo_bytes)

    def test_photos_carry_the_long_cache_header(self):
        r = self.get("/catalog-images/photo.jpg")
        self.assertEqual(r.headers.get("cache-control"), PHOTOS_CACHE_CONTROL)
        self.assertNotIn("immutable", r.headers["cache-control"])  # names are reused when a photo is replaced

    def test_a_not_modified_answer_keeps_the_cache_header(self):
        first = self.get("/catalog-images/photo.jpg")
        again = self.get("/catalog-images/photo.jpg", **{"If-None-Match": first.headers["etag"]})
        self.assertEqual(again.status_code, 304)
        self.assertEqual(again.headers.get("cache-control"), PHOTOS_CACHE_CONTROL)

    def test_missing_files_and_the_folder_itself_are_not_served_or_cached(self):
        for path in ("/catalog-images/nope.jpg", "/catalog-images/", "/catalog-images"):
            r = self.client.get(path, follow_redirects=False)
            self.assertIn(r.status_code, (404, 307), path)
            self.assertNotEqual(r.headers.get("cache-control"), PHOTOS_CACHE_CONTROL, path)
