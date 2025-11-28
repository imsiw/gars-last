# risk_gpt_client.py
import os
import json
import requests
import re
from typing import Any, Dict


FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")

URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def _calc_base_risk(route: Dict[str, Any]) -> float:
    probs = []
    for seg in route.get("segments", []):
        r = seg.get("delay_risk")
        if r is None:
            continue
        try:
            r = float(r)
        except:
            continue
        probs.append(max(0.0, min(1.0, r)))

    if not probs:
        return 0.3

    p_ok = 1.0
    for p in probs:
        p_ok *= (1 - p)
    return 1 - p_ok


def assess_route_risk(route: Dict[str, Any]) -> Dict[str, Any]:
    base_risk = _calc_base_risk(route)

    if not (FOLDER_ID and API_KEY):
        score = int(round(base_risk * 10))
        return {
            "risk_score": score,
            "reason": "GPT не настроен, fallback.",
            "recommend_insurance": score >= 8
        }

    txt = "\n".join(
        f"{i+1}) {s['from_name']} → {s['to_name']} · {s['type']} · {s['departure']} — {s['arrival']}"
        for i, s in enumerate(route.get("segments", []))
    )

    prompt = f"""
Оцени риск срыва маршрута по шкале 0..10. И обязательно в причинах напиши рекомендуется ли брать страовку в этом случае или нет.

Маршрут:
{txt}

Базовый эвристический риск: {base_risk:.2f}

Ответь строго в JSON:
{{"risk_score": <0..10>, "reason": "<текст>"}}
"""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Api-Key {API_KEY}"
    }

    payload = {
        "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite/latest",
        "completionOptions": {
            "stream": False,
            "temperature": 0.3,
            "maxTokens": 2000
        },
        "messages": [
            {"role": "user", "text": prompt}
        ]
    }

    try:
        resp = requests.post(URL, headers=headers, json=payload, timeout=15)

        print("\n=== YANDEX RAW RESPONSE ===")
        print(resp.status_code, resp.text)
        print("=== END RAW ===\n")

        data = resp.json()

        if "error" in data:
            raise Exception(data["error"])

        text = data["result"]["alternatives"][0]["message"]["text"]

        # --- ВЫРЕЗАЕМ JSON ---
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise Exception("Модель вернула текст без JSON")

        clean = match.group(0)
        parsed = json.loads(clean)

        score = int(parsed.get("risk_score", round(base_risk * 10)))
        reason = parsed.get("reason", "")

    except Exception as e:
        score = int(round(base_risk * 10))
        return {
            "risk_score": score,
            "reason": f"GPT недоступен ({e}), fallback.",
            "recommend_insurance": score >= 8
        }

    score = max(0, min(10, score))

    return {
        "risk_score": score,
        "reason": reason,
        "recommend_insurance": score >= 8
    }
