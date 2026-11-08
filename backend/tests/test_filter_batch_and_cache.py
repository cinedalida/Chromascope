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
