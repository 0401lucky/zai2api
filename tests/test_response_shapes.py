from zai2api.server import build_responses_output


def test_responses_output_keeps_reasoning_separate() -> None:
    output = build_responses_output("final answer", "reasoning text")
    assert output[0]["type"] == "reasoning"
    assert output[0]["summary"][0]["text"] == "reasoning text"
    assert output[1]["type"] == "message"
    assert output[1]["content"][0]["text"] == "final answer"
