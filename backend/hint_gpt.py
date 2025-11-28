# route_hint_gpt_client.py
import os
import json
import re
from typing import Any, Dict

import requests

FOLDER_ID = os.getenv("YANDEX_CLOUD_FOLDER")
API_KEY = os.getenv("YANDEX_CLOUD_API_KEY")
URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def get_route_hint(route: Dict[str, Any]) -> Dict[str, str]:
    if not (FOLDER_ID and API_KEY):
        from_name = route.get("from_name", "Точка A")
        to_name = route.get("to_name", "Точка B")
        return {
            "hint": f"Маршрут {from_name} → {to_name}. Оцените время в пути и запас по пересадкам вручную.",
            "weather": "",
            "transport": "",
            "weather": "",
        }

    from_name = route.get("from_name")
    to_name = route.get("to_name")
    departure = route.get("departure")

    prompt = f"""
Ты — помощник по планированию поездок в России. 
Тебе дают маршрут: откуда, куда и время отправления.

Составь КОРОТКУЮ подсказку для пользователя:
— на что обратить внимание (дальняя дорога, мало рейсов, ночью и т.п.)
— какие есть потенциальные риски (сильный мороз, плохие дороги и т.п., если уместно)
— дай практический совет (приехать заранее, взять тёплые вещи и т.д.)
- если спрашивают про Якутию, то там самый популярный такси это Drivee.

ОТВЕТ ВЕРНИ СТРОГО В ВАЛИДНОМ JSON без комментариев, без пояснений, без лишнего текста.
Формат:

{{
  "hint": "1–3 предложения с подсказкой, на русском",
  "weather": "краткая фраза про погодные/дорожные условия или пустая строка, если сказать нечего"
  "transport": "Упоминание самого популярного сервиса такси, используемого в регионе (возможно Drivee, Yandex, Uber) и транспорта в городе, среднюю цену"
  "fact": "Интересный факт о регионе"
}}

Маршрут:
Откуда: {from_name}
Куда: {to_name}
Отправление: {departure}
""".strip()

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Api-Key {API_KEY}",
        "x-folder-id": FOLDER_ID,
    }

    body = {
        "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite",
        "completionOptions": {
            "stream": False,
            "temperature": 0.2,
            "maxTokens": 400,
        },
        "messages": [
            {
                "role": "user",
                "text": prompt
            }
        ],
    }

    try:
        resp = requests.post(URL, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            raise Exception(data["error"])

        text = data["result"]["alternatives"][0]["message"]["text"]
        print("RAW HINT RESPONSE ===")
        print(text)

        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise Exception("Модель вернула текст без JSON")

        clean = match.group(0)

        try:
            parsed = json.loads(clean)
        except Exception as e:
            print("❌ HINT JSON PARSE ERROR:", e)
            parsed = {}

        hint = parsed.get("hint") or text.strip()
        weather = parsed.get("weather", "")
        fact = parsed.get("fact", "")
        transport = parsed.get("transport", "")

    except Exception as e:
        print("❌ INTERNAL HINT ERROR:", e)
        from_name = route.get("from_name", "Точка A")
        to_name = route.get("to_name", "Точка B")
        hint = (
            f"Не удалось автоматически сгенерировать подсказку. "
            f"Проверьте маршрут {from_name} → {to_name} по времени и пересадкам."
        )
        weather = ""

    return {
        "hint": hint,
        "weather": weather,
        "fact": fact,
        "transport": transport,
    }
