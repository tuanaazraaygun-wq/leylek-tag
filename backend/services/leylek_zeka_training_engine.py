from . import leylek_zeka_draft_service as draft_service

last_question = None


def process_admin_message(message):
    global last_question
    text = message.lower()

    if "soru:" in text:
        last_question = message.replace("soru:", "").strip()
        return {"message": message, "created_drafts": []}

    if "cevap:" in text and last_question:
        answer = message.replace("cevap:", "").strip()
        draft = draft_service.create_draft(
            "faq",
            {"question": last_question, "answer": answer},
            [],
        )
        last_question = None
        return {"message": message, "created_drafts": [draft]}

    return {"message": message, "created_drafts": []}
