"""Persistent local inference worker for mlabonne/LFM2.5-230M-Chess."""

import json
import sys

MODEL_ID = "mlabonne/LFM2.5-230M-Chess"
model = None
token_ids = None
torch = None


def load_model():
    global model, token_ids, torch
    if model is not None:
        return
    import torch as torch_module
    from huggingface_hub import hf_hub_download
    from transformers import AutoModelForCausalLM

    torch = torch_module
    with open(hf_hub_download(MODEL_ID, "token_ids.json"), encoding="utf-8") as tokens_file:
        token_ids = json.load(tokens_file)
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID)
    model.eval()
    if torch.cuda.is_available():
        model.to("cuda")


def prompt_ids(fen, repetition, history):
    board, turn, castling, en_passant, halfmove, _ = fen.split()
    cells = "".join("." * int(c) if c.isdigit() else c for c in board if c != "/")
    if len(cells) != 64:
        raise ValueError("Invalid FEN board")
    rights = "".join(c for c in "KQkq" if c in castling) or "-"
    tokens = ["<|pos|>"] + [f"<c:{c}>" for c in cells]
    tokens += [
        f"<stm:{turn}>", f"<cast:{rights}>",
        f"<ep:{en_passant[0] if en_passant != '-' else '-'}>",
        f"<hm:{min(max(int(halfmove), 0), 100) // 4}>",
        f"<rep:{min(max(int(repetition), 0), 2)}>", "<|hist|>",
    ]
    tokens += ["<m:0000>"] * (8 - len(history[-8:]))
    tokens += [f"<m:{move}>" for move in history[-8:]]
    tokens.append("<|eval|>")
    if len(tokens) != 80:
        raise ValueError("Invalid model prompt length")
    return [token_ids[token] for token in tokens]


def choose_move(request):
    load_model()
    legal = request["legalMoves"]
    known = [move for move in legal if f"<m:{move}>" in token_ids]
    if not known:
        return {"move": legal[0], "comment": "Спасаюсь ультой."}
    prompt = prompt_ids(request["fen"], request["repetition"], request["history"])
    device = next(model.parameters()).device
    with torch.inference_mode():
        value_logits = model(input_ids=torch.tensor([prompt], device=device)).logits[0, -1]
        value = max(range(64), key=lambda n: value_logits[token_ids[f"<v:{n}>"]].item())
        move_prompt = prompt + [token_ids[f"<v:{value}>"], token_ids["<|bestmove|>"]]
        move_logits = model(input_ids=torch.tensor([move_prompt], device=device)).logits[0, -1]
        chosen = max(known, key=lambda move: move_logits[token_ids[f"<m:{move}>"]].item())
    return {"move": chosen, "comment": "Ход сделан."}


for line in sys.stdin:
    request = None
    try:
        request = json.loads(line)
        result = {"id": request["id"], **choose_move(request)}
    except Exception as exc:
        result = {"id": request.get("id") if isinstance(request, dict) else None, "error": str(exc)}
    print(json.dumps(result), flush=True)
