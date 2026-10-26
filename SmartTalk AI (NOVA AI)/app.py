import os
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__, static_folder="templates/static")
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

api_key = os.getenv("GEMINI_API_KEY", "").strip()
model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

client = genai.Client(api_key=api_key) if api_key else None


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    if client is None:
        return jsonify({
            "error": "API key missing. Please add your key to the .env file."
        }), 500

    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])

    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "Please enter a message."}), 400

    if len(messages) > 40:
        return jsonify({"error": "Start a new chat to continue."}), 400

    contents = []

    for message in messages[-20:]:
        if not isinstance(message, dict):
            return jsonify({"error": "Invalid message format."}), 400

        role = message.get("role")
        text = message.get("text")

        if role not in ("user", "model") or not isinstance(text, str):
            return jsonify({"error": "Invalid message format."}), 400

        text = text.strip()

        if not text or len(text) > 4000:
            return jsonify({
                "error": "Each message must contain 1 to 4000 characters."
            }), 400

        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=text)]
            )
        )

    if contents[-1].role != "user":
        return jsonify({"error": "The last message must be from you."}), 400

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are Nova AI, a helpful AI assistant. "
                    "Give accurate, clear answers. "
                    "Explain difficult topics in simple language. "
                    "Use examples when useful."
                ),
                temperature=0.7
            )
        )

        answer = response.text

        if not answer:
            return jsonify({
                "error": "The AI returned an empty answer. Please try again."
            }), 502

        return jsonify({"reply": answer})

    except Exception as error:
        print(f"Gemini error: {type(error).__name__}: {error}")
        return jsonify({
            "error": (
                "Gemini could not answer. Check your API key, "
                "model name, internet connection, and usage quota."
            )
        }), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
