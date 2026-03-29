import re
import unittest
from pathlib import Path

from apply_engine.portal_specs import (
    GREENHOUSE_CUSTOM_SELECTORS,
    GREENHOUSE_SELECTORS,
    LEVER_CUSTOM_SELECTORS,
    LEVER_SELECTORS,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def fixture_text(name: str) -> str:
    return (FIXTURES_DIR / name).read_text()


def selector_matches_html(html: str, selector_group: str) -> bool:
    for selector in [selector.strip() for selector in selector_group.split(",")]:
        if selector and single_selector_matches_html(html, selector):
            return True
    return False


def single_selector_matches_html(html: str, selector: str) -> bool:
    tag_match = re.match(r"^(?P<tag>[a-z]+)", selector)
    if not tag_match:
        return False

    tag = tag_match.group("tag")
    attrs = re.findall(r'\[(?P<key>[a-z_]+)="(?P<value>[^"]+)"\]', selector)

    for element in re.findall(rf"<{tag}\b[^>]*>", html):
        if all(
            re.search(rf'{key}="{re.escape(value)}"', element)
            for key, value in attrs
        ):
            return True

    return False


class PortalSpecFixtureTests(unittest.TestCase):
    def test_greenhouse_selectors_match_fixture(self) -> None:
        html = fixture_text("greenhouse_form.html")

        for key, selector in GREENHOUSE_SELECTORS.items():
            with self.subTest(key=key):
                self.assertTrue(selector_matches_html(html, selector))

        for key, spec in GREENHOUSE_CUSTOM_SELECTORS.items():
            for selector_key, selector in spec.items():
                with self.subTest(key=f"{key}:{selector_key}"):
                    self.assertTrue(selector_matches_html(html, selector))

    def test_lever_selectors_match_fixture(self) -> None:
        html = fixture_text("lever_form.html")

        for key, selector in LEVER_SELECTORS.items():
            with self.subTest(key=key):
                self.assertTrue(selector_matches_html(html, selector))

        for key, spec in LEVER_CUSTOM_SELECTORS.items():
            for selector_key, selector in spec.items():
                with self.subTest(key=f"{key}:{selector_key}"):
                    self.assertTrue(selector_matches_html(html, selector))


if __name__ == "__main__":
    unittest.main()
