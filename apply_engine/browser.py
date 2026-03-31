from __future__ import annotations

import asyncio
import base64
import re
from typing import Any, Callable, Awaitable

from apply_engine.models import CapturedScreenshot, PlannedAction


class ActionExecutionError(RuntimeError):
    pass


class AuthRequiredError(ActionExecutionError):
    pass


class SubmissionBlockedError(ActionExecutionError):
    pass


def looks_like_manual_verification_error(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\bhcaptcha\b",
        r"\brecaptcha\b",
        r"\bcaptcha\b",
        r"\bsecurity challenge\b",
        r"\bverify you are human\b",
        r"\bsubtree intercepts pointer events\b",
        r"\bpointer events\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_missing_select_option_error(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    return "did not find some options" in normalized or "no option found" in normalized


def exception_screenshots(exc: BaseException) -> list[CapturedScreenshot]:
    screenshots = getattr(exc, "_twin_screenshots", None)
    return screenshots if isinstance(screenshots, list) else []


async def selector_exists(page: Any, selector: str) -> bool:
    if hasattr(page, "locator"):
        locator = page.locator(selector)
        count = getattr(locator, "count", None)
        if callable(count):
            return await count() > 0
    return True


def split_selector_group(selector_group: str) -> list[str]:
    return [selector.strip() for selector in selector_group.split(",") if selector.strip()]


async def is_combobox_input(page: Any, selector: str) -> bool:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return False

    try:
        return bool(
            await evaluate(
                """
                ({ selector }) => {
                  const element = document.querySelector(selector);
                  if (!(element instanceof HTMLElement)) {
                    return false;
                  }

                  const role = (element.getAttribute("role") || "").toLowerCase();
                  const ariaAutocomplete = (element.getAttribute("aria-autocomplete") || "").toLowerCase();
                  const ariaHaspopup = (element.getAttribute("aria-haspopup") || "").toLowerCase();

                  return (
                    role === "combobox" ||
                    ariaAutocomplete === "list" ||
                    ariaHaspopup === "true" ||
                    ariaHaspopup === "listbox"
                  );
                }
                """,
                {"selector": selector},
            )
        )
    except Exception:
        return False


async def fill_combobox_input(
    page: Any,
    selector: str,
    value: str,
    *,
    commit_value: str | None = None,
) -> None:
    search_value = _display_combobox_search_value(value)
    await page.click(selector)

    locator_factory = getattr(page, "locator", None)
    typed = False
    if callable(locator_factory):
        try:
            locator = locator_factory(selector)
            fill_method = getattr(locator, "fill", None)
            press_sequentially = getattr(locator, "press_sequentially", None)
            if callable(fill_method) and callable(press_sequentially):
                await fill_method("")
                await press_sequentially(search_value)
                typed = True
        except Exception:
            typed = False

    if not typed:
        type_text = getattr(page, "type", None)
        if callable(type_text):
            try:
                await page.fill(selector, "")
                await type_text(selector, search_value)
                typed = True
            except Exception:
                typed = False

    if not typed:
        await page.fill(selector, search_value)

    wait_for_timeout = getattr(page, "wait_for_timeout", None)
    if callable(wait_for_timeout):
        await wait_for_timeout(350)

    selected_via_option_click = False
    resolved_commit_value = (commit_value or "").strip()
    input_id = ""
    if selector.startswith("#"):
        input_id = selector[1:]
    else:
        evaluate = getattr(page, "evaluate", None)
        if callable(evaluate):
            try:
                input_id = str(
                    await evaluate(
                        """
                        ({ selector }) => {
                          const element = document.querySelector(selector);
                          return element instanceof HTMLElement ? (element.id || "") : "";
                        }
                        """,
                        {"selector": selector},
                    )
                ).strip()
            except Exception:
                input_id = ""

    if input_id:
        try:
            option_target = None
            options: list[dict[str, str]] = []
            for _attempt in range(6):
                options = await get_combobox_options(page, input_id)
                option_target = resolve_combobox_option_selector(
                    value,
                    options,
                )
                if option_target:
                    break
                if callable(wait_for_timeout):
                    await wait_for_timeout(250)
            if not option_target:
                await _open_combobox_toggle(page, selector)
                if callable(wait_for_timeout):
                    await wait_for_timeout(150)
                options = await get_combobox_options(page, input_id)
                option_target = resolve_combobox_option_selector(
                    value,
                    options,
                )
            if option_target and await selector_exists(page, option_target):
                if not resolved_commit_value:
                    for option in options:
                        if option.get("selector") != option_target:
                            continue
                        resolved_commit_value = (
                            str(option.get("value") or "").strip()
                            or str(option.get("label") or "").strip()
                        )
                        break
                await page.click(option_target)
                selected_via_option_click = True
                if callable(wait_for_timeout):
                    await wait_for_timeout(150)
        except Exception:
            selected_via_option_click = False

    keyboard = getattr(page, "keyboard", None)
    press = getattr(keyboard, "press", None) if keyboard is not None else None
    if callable(press) and not selected_via_option_click:
        await press("ArrowDown")
        await press("Enter")
        if callable(wait_for_timeout):
            await wait_for_timeout(150)
    await _sync_combobox_required_input(
        page,
        selector,
        search_value,
        commit_value=resolved_commit_value,
    )
    if callable(press):
        await press("Tab")
        if callable(wait_for_timeout):
            await wait_for_timeout(100)


def _display_combobox_search_value(value: str) -> str:
    canonical = _canonicalize_select_value(value)
    if not canonical:
        return value

    month_names = {
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    }
    if canonical in month_names:
        return canonical.title()

    display_map = {
        "bachelor": "Bachelor",
        "master": "Master",
        "computer science": "Computer Science",
        "female": "Female",
        "male": "Male",
        "citizen": "Citizen",
        "permanent resident": "Permanent Resident",
        "authorized": "Authorized",
        "no sponsorship": "No",
        "yes": "Yes",
        "no": "No",
        "onsite": "Onsite",
        "hybrid": "Hybrid",
        "remote": "Remote",
        "decline": "Decline",
        "not veteran": "I am not a protected veteran",
        "no disability": "No, I do not have a disability",
    }
    return display_map.get(canonical, value)


async def _open_combobox_toggle(page: Any, selector: str) -> None:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return

    try:
        await evaluate(
            """
            ({ selector }) => {
              const input = document.querySelector(selector);
              if (!(input instanceof HTMLElement)) {
                return false;
              }

              const wrapper =
                input.closest(".select__container") ||
                input.closest(".select") ||
                input.closest(".field-wrapper") ||
                input.closest(".input-wrapper") ||
                input.closest(".select-shell");
              if (!(wrapper instanceof HTMLElement)) {
                return false;
              }

              const toggle = wrapper.querySelector('button[aria-label="Toggle flyout"]');
              if (!(toggle instanceof HTMLButtonElement)) {
                return false;
              }

              toggle.click();
              return true;
            }
            """,
            {"selector": selector},
        )
    except Exception:
        return


async def _sync_combobox_required_input(
    page: Any,
    selector: str,
    fallback_value: str,
    *,
    commit_value: str | None = None,
) -> None:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return

    try:
        await evaluate(
            """
            ({ selector, fallbackValue, commitValue }) => {
              const setNativeInputValue = (element, value) => {
                const descriptor = Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  "value",
                );
                if (descriptor && typeof descriptor.set === "function") {
                  descriptor.set.call(element, value);
                } else {
                  element.value = value;
                }
                element.defaultValue = value;
                element.setAttribute("value", value);
              };

              const input = document.querySelector(selector);
              if (!(input instanceof HTMLElement)) {
                return false;
              }

              const wrapper =
                input.closest(".select__container") ||
                input.closest(".select") ||
                input.closest(".field-wrapper") ||
                input.closest(".input-wrapper") ||
                input.closest(".select-shell");
              if (!(wrapper instanceof HTMLElement)) {
                return false;
              }

              const singleValue = wrapper.querySelector(".select__single-value");
              const inputContainer = wrapper.querySelector(".select__input-container");
              const hiddenRequiredInput = wrapper.querySelector('input[aria-hidden="true"]');
              if (!(hiddenRequiredInput instanceof HTMLInputElement)) {
                return false;
              }

              const explicitCommitValue = (commitValue || "").trim();
              const selectedLabel =
                singleValue instanceof HTMLElement ? (singleValue.textContent || "").trim() : "";
              const committedValue =
                explicitCommitValue ||
                (input instanceof HTMLInputElement ? (input.dataset.twinCommittedValue || "").trim() : "") ||
                (wrapper.dataset.twinCommittedValue || "").trim() ||
                selectedLabel ||
                (input instanceof HTMLInputElement ? (input.value || "").trim() : "") ||
                (fallbackValue || "").trim();

              if (!committedValue) {
                return false;
              }

              if (input instanceof HTMLInputElement) {
                if (explicitCommitValue) {
                  input.dataset.twinCommittedValue = explicitCommitValue;
                }
                setNativeInputValue(input, committedValue);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                input.dispatchEvent(new Event("blur", { bubbles: true }));
              }

              if (inputContainer instanceof HTMLElement) {
                inputContainer.setAttribute("data-value", committedValue);
              }

              if (explicitCommitValue) {
                wrapper.dataset.twinCommittedValue = explicitCommitValue;
              }

              setNativeInputValue(hiddenRequiredInput, committedValue);
              hiddenRequiredInput.required = false;
              hiddenRequiredInput.disabled = true;
              hiddenRequiredInput.removeAttribute("required");
              hiddenRequiredInput.dispatchEvent(new Event("input", { bubbles: true }));
              hiddenRequiredInput.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            }
            """,
            {
                "selector": selector,
                "fallbackValue": fallback_value,
                "commitValue": (commit_value or "").strip(),
            },
        )
    except Exception:
        return


async def click_preferred_selector(page: Any, selector_group: str) -> None:
    preferred_selector = await get_preferred_selector(page, selector_group)
    try:
        await page.click(preferred_selector)
    except Exception as exc:
        if looks_like_manual_verification_error(str(exc)):
            raise AuthRequiredError(normalize_confirmation_text(str(exc), limit=240)) from exc
        raise


async def get_preferred_selector(page: Any, selector_group: str) -> str:
    if hasattr(page, "locator"):
        fallback_selector = None
        for selector in split_selector_group(selector_group):
            locator = page.locator(selector)
            count = getattr(locator, "count", None)
            nth = getattr(locator, "nth", None)

            if not callable(count) or not callable(nth):
                continue

            total = await count()
            if total <= 0:
                continue

            for index in range(total):
                candidate = nth(index)
                if fallback_selector is None:
                    fallback_selector = selector
                is_visible = getattr(candidate, "is_visible", None)
                if callable(is_visible):
                    try:
                        if await is_visible():
                            return selector
                    except Exception:
                        continue

        if fallback_selector is not None:
            return fallback_selector

    return selector_group


def _canonicalize_select_value(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", value.strip().lower()).strip()
    month_names = {
        "01": "january",
        "1": "january",
        "02": "february",
        "2": "february",
        "03": "march",
        "3": "march",
        "04": "april",
        "4": "april",
        "05": "may",
        "5": "may",
        "06": "june",
        "6": "june",
        "07": "july",
        "7": "july",
        "08": "august",
        "8": "august",
        "09": "september",
        "9": "september",
        "10": "october",
        "11": "november",
        "12": "december",
    }
    if normalized in month_names:
        return month_names[normalized]
    if "woman" in normalized:
        return "female"
    if normalized == "man" or " man " in f" {normalized} ":
        return "male"
    replacements = (
        ("b s ", "bachelor"),
        ("bs ", "bachelor"),
        ("bachelor of science", "bachelor"),
        ("bachelors", "bachelor"),
        ("bachelor s", "bachelor"),
        ("m s ", "master"),
        ("ms ", "master"),
        ("master of science", "master"),
        ("masters", "master"),
        ("master s", "master"),
        ("computer science", "computer science"),
    )
    for source, target in replacements:
        if source in normalized:
            return target
    if "prefer not to answer" in normalized or "prefer not to self identify" in normalized or "decline to answer" in normalized:
        return "decline"
    if "not a protected veteran" in normalized:
        return "not veteran"
    if "do not have a disability" in normalized:
        return "no disability"
    if "open to onsite" in normalized or "on site" in normalized:
        return "onsite"
    hours_match = re.search(r"\b(\d{1,2})\b", normalized)
    if hours_match and any(token in normalized for token in ("hour", "week", "weekly")):
        return hours_match.group(1)
    graduation_match = re.search(r"\b(20\d{2})\b", normalized)
    if graduation_match and any(token in normalized for token in ("graduat", "class", "year")):
        return graduation_match.group(1)
    return normalized


async def get_combobox_options(page: Any, input_id: str) -> list[dict[str, str]]:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return []

    try:
        return await evaluate(
            """
            ({ inputId }) => {
              return Array.from(
                document.querySelectorAll(`[id^="react-select-${inputId}-option-"]`)
              ).map((element) => ({
                selector: `#${element.id}`,
                label: (element.textContent || "").trim(),
              }));
            }
            """,
            {"inputId": input_id},
        )
    except Exception:
        return []


async def get_select_options(page: Any, selector: str) -> list[dict[str, str]]:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return []

    try:
        options = await evaluate(
            """
            ({ selector }) => {
              const element = document.querySelector(selector);
              if (!(element instanceof HTMLSelectElement)) {
                return [];
              }

              return Array.from(element.options).map((option, index) => ({
                label: (option.textContent || "").trim(),
                value: option.value || "",
                index: String(index),
              }));
            }
            """,
            {"selector": selector},
        )
    except Exception:
        return []

    if not isinstance(options, list):
        return []

    normalized: list[dict[str, str]] = []
    for option in options:
        if not isinstance(option, dict):
            continue
        normalized.append(
            {
                "label": str(option.get("label", "")).strip(),
                "value": str(option.get("value", "")).strip(),
                "index": str(option.get("index", "")).strip(),
            }
        )
    return normalized


def resolve_select_option_value(answer: str, options: list[dict[str, str]]) -> str | None:
    normalized_answer = answer.strip().lower()
    canonical_answer = _canonicalize_select_value(answer)
    if not normalized_answer:
        return None

    def option_values(option: dict[str, str]) -> list[str]:
        return [option.get("label", "").strip(), option.get("value", "").strip(), option.get("index", "").strip()]

    for option in options:
        values = [value for value in option_values(option) if value]
        lowered = {value.lower() for value in values}
        canonicalized = {_canonicalize_select_value(value) for value in values}
        if normalized_answer in lowered or canonical_answer in canonicalized:
            return option.get("value") or option.get("label") or option.get("index") or None

    answer_words = {word for word in re.split(r"[^a-z0-9]+", canonical_answer) if word}
    best_value = None
    best_score = 0

    for option in options:
        values = " ".join(_canonicalize_select_value(value) for value in option_values(option) if value)
        option_words = {word for word in re.split(r"[^a-z0-9]+", values) if word}
        score = len(answer_words & option_words)
        if score > best_score:
            best_score = score
            best_value = option.get("value") or option.get("label") or option.get("index") or None

    if best_score > 0:
        return best_value

    return None


def resolve_combobox_option_selector(answer: str, options: list[dict[str, str]]) -> str | None:
    normalized_answer = _canonicalize_select_value(answer)

    for option in options:
        label = str(option.get("label") or "").strip()
        selector = str(option.get("selector") or "").strip()
        if not label or not selector:
            continue
        if _canonicalize_select_value(label) == normalized_answer:
            return selector

    answer_words = {word for word in re.split(r"[^a-z0-9]+", normalized_answer) if word}
    best_selector = None
    best_score = 0

    for option in options:
        label = str(option.get("label") or "").strip()
        selector = str(option.get("selector") or "").strip()
        if not label or not selector:
            continue
        option_words = {
            word for word in re.split(r"[^a-z0-9]+", _canonicalize_select_value(label)) if word
        }
        score = len(answer_words & option_words)
        if score > best_score:
            best_score = score
            best_selector = selector

    if best_selector:
        return best_selector

    for option in options:
        selector = str(option.get("selector") or "").strip()
        if selector:
            return selector

    return None


async def execute_actions(page: Any, actions: list[PlannedAction]) -> None:
    for action in actions:
        exists = await selector_exists(page, action.selector)

        if not exists:
            if action.required:
                raise ActionExecutionError(f"Required selector not found: {action.selector}")
            continue

        preferred_selector = await get_preferred_selector(page, action.selector)

        if action.action == "fill":
            if await is_combobox_input(page, preferred_selector):
                await fill_combobox_input(page, preferred_selector, action.value)
            else:
                await page.fill(preferred_selector, action.value)
        elif action.action == "upload":
            await page.set_input_files(preferred_selector, action.value)
        elif action.action == "select":
            try:
                await page.select_option(preferred_selector, action.value)
            except Exception as exc:
                if looks_like_manual_verification_error(str(exc)):
                    raise AuthRequiredError(normalize_confirmation_text(str(exc), limit=240)) from exc
                if not looks_like_missing_select_option_error(str(exc)):
                    raise

                resolved_value = resolve_select_option_value(
                    action.value,
                    await get_select_options(page, preferred_selector),
                )
                if not resolved_value:
                    raise
                await page.select_option(preferred_selector, resolved_value)
        elif action.action == "click":
            await page.click(preferred_selector)
        elif action.action == "check":
            if hasattr(page, "check"):
                await page.check(preferred_selector)
            else:
                await page.click(preferred_selector)
        elif action.action == "uncheck":
            if hasattr(page, "uncheck"):
                await page.uncheck(preferred_selector)
            else:
                await page.click(preferred_selector)


async def inspect_missing_required_fields(page: Any) -> list[str]:
    preset = getattr(page, "required_issues", None)
    if isinstance(preset, list):
        return [normalize_confirmation_text(str(issue), limit=160) for issue in preset if str(issue).strip()]

    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return []

    try:
        issues = await evaluate(
            """
            () => {
              const elements = Array.from(
                document.querySelectorAll('input[required], select[required], textarea[required], [aria-required="true"]')
              );

              const isVisible = (el) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
              };

              const getLabel = (el) => {
                const aria = el.getAttribute("aria-label");
                if (aria) return aria;
                if (el.id) {
                  const label = document.querySelector(`label[for="${el.id}"]`);
                  if (label?.textContent) return label.textContent;
                }
                const wrapped = el.closest("label");
                if (wrapped?.textContent) return wrapped.textContent;
                const containerLabel = el.closest('[role="group"], fieldset, .field, .application-question')?.querySelector("label, legend");
                if (containerLabel?.textContent) return containerLabel.textContent;
                return el.getAttribute("name") || el.getAttribute("id") || el.tagName.toLowerCase();
              };

              const normalize = (value) => value.replace(/\\s+/g, " ").trim();

              return elements
                .filter((el) => isVisible(el))
                .filter((el) => {
                  if (el instanceof HTMLInputElement) {
                    if (el.type === "radio") {
                      return !document.querySelector(`input[type="radio"][name="${el.name}"]:checked`);
                    }
                    if (el.type === "checkbox") {
                      return !el.checked;
                    }
                    if (el.type === "file") {
                      return !(el.files && el.files.length > 0);
                    }
                    return !el.value.trim();
                  }
                  if (el instanceof HTMLSelectElement) {
                    return !el.value;
                  }
                  if (el instanceof HTMLTextAreaElement) {
                    return !el.value.trim();
                  }
                  return false;
                })
                .map((el) => `${normalize(getLabel(el))} is required`)
                .filter(Boolean)
                .slice(0, 6);
            }
            """
        )
    except Exception:
        return []

    if not isinstance(issues, list):
        return []

    return [normalize_confirmation_text(str(issue), limit=160) for issue in issues if str(issue).strip()]


async def capture_page_screenshot(
    page: Any,
    label: str,
    *,
    full_page: bool = True,
) -> CapturedScreenshot | None:
    screenshot = getattr(page, "screenshot", None)
    if not callable(screenshot):
        return None

    data = await screenshot(type="png", full_page=full_page)
    if not isinstance(data, (bytes, bytearray)):
        return None

    return CapturedScreenshot(
        label=label,
        mime_type="image/png",
        data_base64=base64.b64encode(bytes(data)).decode("ascii"),
    )


def normalize_confirmation_text(text: str, *, limit: int = 200) -> str:
    normalized = " ".join(text.split())
    return normalized[:limit]


async def extract_body_text(page: Any) -> str:
    return await page.locator("body").inner_text()


def extract_page_url(page: Any) -> str:
    url = getattr(page, "url", "")
    if callable(url):
        try:
            value = url()
        except TypeError:
            return ""
        return value if isinstance(value, str) else ""
    return url if isinstance(url, str) else ""


def looks_like_confirmation_url(url: str) -> bool:
    normalized = url.strip().lower()
    patterns = [
        r"/thanks\b",
        r"/thank-you\b",
        r"/confirmation\b",
        r"/submitted\b",
        r"/success\b",
        r"application_submitted",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_confirmation(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\bapplication submitted\b",
        r"\bapplied successfully\b",
        r"\bthank you for applying\b",
        r"\bthanks for applying\b",
        r"\bsubmission received\b",
        r"\bconfirmation\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_auth_wall(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\bsign in\b",
        r"\blog in\b",
        r"\bcreate an account\b",
        r"\bcontinue with google\b",
        r"\buse your account\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_review_step(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\breview your application\b",
        r"\bfinal review\b",
        r"\breview your details\b",
        r"\bsubmit your application\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def slugify_step_label(value: str, *, fallback: str = "application_step") -> str:
    normalized = "".join(
        character.lower() if character.isalnum() else "_"
        for character in value.strip()
    )
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_") or fallback


def describe_application_step(text: str, *, step_index: int = 0) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates = lines[:8] or [normalize_confirmation_text(text, limit=240)]

    keywords = (
        "my information",
        "personal information",
        "contact information",
        "experience",
        "education",
        "application questions",
        "additional questions",
        "voluntary disclosures",
        "eeo",
        "equal employment opportunity",
        "review",
        "submit",
    )

    for candidate in candidates:
        lowered = candidate.lower()
        if any(keyword in lowered for keyword in keywords):
            return slugify_step_label(candidate, fallback=f"step_{step_index}")

    fallback = candidates[0] if candidates else f"step_{step_index}"
    return slugify_step_label(fallback, fallback=f"step_{step_index}")


def extract_validation_issues(text: str) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    patterns = [
        r"\brequired\b",
        r"\binvalid\b",
        r"\bplease enter\b",
        r"\bplease select\b",
        r"\bplease provide\b",
        r"\bcomplete this field\b",
        r"\bmissing\b",
        r"\berror\b",
    ]
    issues: list[str] = []

    for line in lines:
        normalized = line.lower()
        if any(re.search(pattern, normalized) for pattern in patterns):
            issues.append(normalize_confirmation_text(line, limit=160))

    return issues


async def complete_submission_flow(
    page: Any,
    *,
    submit_selector: str,
    next_selector: str | None = None,
    max_steps: int = 4,
    max_next_steps: int = 2,
    on_step: Callable[[Any, int], Awaitable[None]] | None = None,
    step_timeout_seconds: float = 45.0,
) -> str:
    async def run_step_operation(
        awaitable: Awaitable[Any],
        *,
        step_index: int,
        action: str,
        step_label: str | None = None,
    ) -> Any:
        try:
            return await asyncio.wait_for(awaitable, timeout=step_timeout_seconds)
        except asyncio.TimeoutError as exc:
            resolved_label = step_label or f"step_{step_index}"
            raise SubmissionBlockedError(
                f"{resolved_label}: timed out during {action}"
            ) from exc

    next_steps_taken = 0
    submit_attempted = False
    previous_signature: str | None = None
    stalled_steps = 0

    for step_index in range(max_steps):
        if on_step:
            await run_step_operation(
                on_step(page, step_index),
                step_index=step_index,
                action="step_fill",
            )

        body_text = await run_step_operation(
            extract_body_text(page),
            step_index=step_index,
            action="step_read",
        )
        current_url = extract_page_url(page)
        step_label = describe_application_step(body_text, step_index=step_index)
        step_signature = (
            step_label
            + "|"
            + normalize_confirmation_text(body_text, limit=280)
            + "|"
            + current_url
        )
        if looks_like_confirmation(body_text):
            return body_text
        if looks_like_confirmation_url(current_url):
            return body_text
        if looks_like_auth_wall(body_text):
            raise AuthRequiredError(normalize_confirmation_text(body_text))

        validation_issues = extract_validation_issues(body_text)
        if submit_attempted and validation_issues:
            raise SubmissionBlockedError(
                f"{step_label}: " + "; ".join(validation_issues[:3])
            )

        review_step = looks_like_review_step(body_text)
        next_exists = bool(next_selector) and await selector_exists(page, next_selector)

        if (
            not review_step
            and next_selector
            and next_steps_taken < max_next_steps
            and next_exists
        ):
            await run_step_operation(
                click_preferred_selector(page, next_selector),
                step_index=step_index,
                action="next_click",
                step_label=step_label,
            )
            await run_step_operation(
                page.wait_for_timeout(1200),
                step_index=step_index,
                action="next_transition",
                step_label=step_label,
            )
            next_steps_taken += 1
            continue

        if await selector_exists(page, submit_selector):
            required_issues = await run_step_operation(
                inspect_missing_required_fields(page),
                step_index=step_index,
                action="required_field_check",
                step_label=step_label,
            )
            if required_issues:
                if on_step:
                    await run_step_operation(
                        on_step(page, step_index),
                        step_index=step_index,
                        action="required_field_refill",
                        step_label=step_label,
                    )
                    required_issues = await run_step_operation(
                        inspect_missing_required_fields(page),
                        step_index=step_index,
                        action="required_field_recheck",
                        step_label=step_label,
                    )
                if required_issues:
                    raise SubmissionBlockedError(
                        f"{step_label}: " + "; ".join(required_issues[:3])
                    )

            await run_step_operation(
                click_preferred_selector(page, submit_selector),
                step_index=step_index,
                action="submit_click",
                step_label=step_label,
            )
            await run_step_operation(
                page.wait_for_timeout(2000),
                step_index=step_index,
                action="submit_transition",
                step_label=step_label,
            )
            submit_attempted = True
            body_text = await run_step_operation(
                extract_body_text(page),
                step_index=step_index,
                action="post_submit_read",
                step_label=step_label,
            )
            if looks_like_confirmation(body_text):
                return body_text
            if looks_like_confirmation_url(extract_page_url(page)):
                return body_text
            continue

        if validation_issues:
            raise SubmissionBlockedError(
                f"{step_label}: " + "; ".join(validation_issues[:3])
            )

        if previous_signature == step_signature:
            stalled_steps += 1
        else:
            stalled_steps = 0
            previous_signature = step_signature

        if stalled_steps >= 1:
            raise SubmissionBlockedError(
                f"Application flow stalled on {step_label}"
            )
        raise SubmissionBlockedError(
            f"Application flow stalled on {step_label}"
        )

    final_body_text = await extract_body_text(page)
    if looks_like_confirmation_url(extract_page_url(page)):
        return final_body_text
    if looks_like_auth_wall(final_body_text):
        raise AuthRequiredError(normalize_confirmation_text(final_body_text))

    final_issues = extract_validation_issues(final_body_text)
    if final_issues:
        raise SubmissionBlockedError("; ".join(final_issues[:3]))

    return final_body_text


async def run_with_chromium(
    url: str,
    worker: Callable[[Any], Awaitable[str]],
) -> str:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "playwright is not installed. Install apply_engine/requirements.txt and run `playwright install chromium`."
        ) from exc

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            confirmation = await worker(page)
            return confirmation
        finally:
            await browser.close()
