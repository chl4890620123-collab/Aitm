import math
import unittest
from comparison import compare_measurements


class ComparisonTests(unittest.TestCase):
    def test_signed_differences_from_real_metric_fields(self):
        result = compare_measurements(
            {"kneeMinAngleDeg": 89.1, "rotationAngularVelocity": 250,
             "analysisConfidence": 83},
            {"kneeMinAngleDeg": 93.2, "rotationAngularVelocity": 290,
             "analysisConfidence": 91},
        )
        rows = {x["metric"]: x for x in result["differences"]}
        self.assertEqual(rows["kneeMinAngleDeg"]["delta"], -4.1)
        self.assertEqual(rows["rotationAngularVelocity"]["delta"], -40)
        self.assertEqual(result["learnerConfidence"], 83)
        self.assertEqual(result["referenceConfidence"], 91)

    def test_missing_or_nonfinite_metrics_never_make_fake_evidence(self):
        result = compare_measurements(
            {"kneeMinAngleDeg": float("nan"), "rotationAngularVelocity": None},
            {"kneeMinAngleDeg": 90, "rotationAngularVelocity": 300},
        )
        self.assertEqual(result["differences"], [])

    def test_does_not_infer_which_video_is_better(self):
        result = compare_measurements(
            {"landingStabilityScore": 75}, {"landingStabilityScore": 80},
        )
        self.assertNotIn("better", result)
        self.assertEqual(result["differences"][0]["delta"], -5)


if __name__ == "__main__":
    unittest.main()
