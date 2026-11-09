"""Run from backend/: python -m unittest tests.test_firebase_init"""
import os
import unittest
from unittest import mock

from app import firebase_init


class CredentialChoice(unittest.TestCase):
    def init(self, env, key_exists):
        """Runs init_firebase with a fake environment; returns the credential that was passed to initialize_app."""
        clean = {k: v for k, v in os.environ.items() if k not in ("FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_KEY_JSON", "FIREBASE_KEY_FILE", "K_SERVICE")}
        with mock.patch.dict(os.environ, {**clean, **env}, clear=True), \
             mock.patch.object(firebase_init.firebase_admin, "_apps", {}), \
             mock.patch.object(firebase_init.os.path, "exists", return_value=key_exists), \
             mock.patch.object(firebase_init.credentials, "Certificate", side_effect=lambda x: ("certificate", x)) as cert, \
             mock.patch.object(firebase_init.credentials, "ApplicationDefault", side_effect=lambda: ("adc",)) as adc, \
             mock.patch.object(firebase_init.firebase_admin, "initialize_app", side_effect=lambda c, options=None: c) as init:
            result = firebase_init.init_firebase()
            return result, cert, adc, init

    def test_key_json_secret_wins(self):
        result, cert, adc, _ = self.init({"FIREBASE_KEY_JSON": '{"type": "service_account"}', "K_SERVICE": "x"}, key_exists=True)
        self.assertEqual(result[0], "certificate")
        adc.assert_not_called()

    def test_key_file_is_used_when_it_exists(self):
        result, cert, adc, _ = self.init({}, key_exists=True)
        self.assertEqual(result[0], "certificate")
        adc.assert_not_called()

    def test_cloud_run_without_a_key_uses_its_own_identity(self):
        result, cert, adc, _ = self.init({"K_SERVICE": "chromascope-api"}, key_exists=False)
        self.assertEqual(result, ("adc",))
        cert.assert_not_called()

    def test_a_key_file_still_wins_on_cloud_run(self):
        result, cert, adc, _ = self.init({"K_SERVICE": "chromascope-api"}, key_exists=True)
        self.assertEqual(result[0], "certificate")
        adc.assert_not_called()

    def test_without_any_key_and_off_cloud_run_the_old_error_is_kept(self):
        result, cert, adc, _ = self.init({}, key_exists=False)
        self.assertEqual(result[0], "certificate")  # Certificate(missing file) is what raises, as before
        adc.assert_not_called()


if __name__ == "__main__":
    unittest.main()
