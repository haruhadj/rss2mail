from messenger import chunk_text


def test_chunk_text_returns_single_chunk_when_short():
    assert chunk_text("hello world") == ["hello world"]


def test_chunk_text_splits_long_text_under_limit():
    text = " ".join(["word"] * 500)
    chunks = chunk_text(text, max_chars=50)
    assert len(chunks) > 1
    assert all(len(c) <= 50 for c in chunks)


def test_chunk_text_preserves_all_words():
    text = " ".join(f"w{i}" for i in range(200))
    chunks = chunk_text(text, max_chars=30)
    rejoined_words = " ".join(chunks).split()
    assert rejoined_words == text.split()
