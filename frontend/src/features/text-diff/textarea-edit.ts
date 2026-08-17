export interface TextState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function getLineBlock(value: string, selectionStart: number, selectionEnd: number) {
  const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const endSearch = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
    ? selectionEnd - 1
    : selectionEnd;
  const nextNewline = value.indexOf("\n", endSearch);
  return { blockStart, blockEnd: nextNewline === -1 ? value.length : nextNewline };
}

export function moveLines(state: TextState, direction: "up" | "down"): TextState {
  const { value, selectionStart, selectionEnd } = state;
  const { blockStart, blockEnd } = getLineBlock(value, selectionStart, selectionEnd);
  const block = value.slice(blockStart, blockEnd);
  if (direction === "up") {
    if (blockStart === 0) return state;
    const previousStart = value.lastIndexOf("\n", blockStart - 2) + 1;
    const previousLine = value.slice(previousStart, blockStart - 1);
    const shift = blockStart - previousStart;
    return {
      value: value.slice(0, previousStart) + block + "\n" + previousLine + value.slice(blockEnd),
      selectionStart: selectionStart - shift,
      selectionEnd: selectionEnd - shift,
    };
  }
  if (blockEnd === value.length) return state;
  const nextStart = blockEnd + 1;
  const nextEnd = value.indexOf("\n", nextStart);
  const nextLine = value.slice(nextStart, nextEnd === -1 ? value.length : nextEnd);
  const shift = nextLine.length + 1;
  return {
    value: value.slice(0, blockStart) + nextLine + "\n" + block + value.slice(nextEnd === -1 ? value.length : nextEnd),
    selectionStart: selectionStart + shift,
    selectionEnd: selectionEnd + shift,
  };
}

export function deleteLines(state: TextState): TextState {
  const { blockStart, blockEnd } = getLineBlock(state.value, state.selectionStart, state.selectionEnd);
  let from = blockStart;
  let to = blockEnd;
  if (blockEnd < state.value.length) to += 1;
  else if (blockStart > 0) from -= 1;
  const value = state.value.slice(0, from) + state.value.slice(to);
  const caret = Math.min(from, value.length);
  return { value, selectionStart: caret, selectionEnd: caret };
}
