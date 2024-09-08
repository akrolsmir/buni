export function applyDiff(code: string, diff: string) {
  // Go line by line through the diff, applying hunks
  // Types of hunks:
  // 1) Insertion: only + lines
  // 2) Deletion: only - lines
  // 3) Context: no prefix
  //
  // The diff only contains a subset of the lines, so we need to
  // seek to the right line number in the code before applying the diff.
  // Note that the diff is indented by 1 additional space compared to the code
  const lines = code.split('\n')
  const diffs = diff.split('\n')
  const result = []
  let i = 0 // lines index
  let j = 0 // diffs index
  // If the line exists, move i to it and add lines in between to result
  function seekAndApply() {
    // Noop if diff line is an insertion
    if (diffs[j].startsWith('+')) {
      return
    }

    // Given the current diff line j, find the next matching line or -1
    const newI = lines.findIndex(
      (line, index) => index >= i && line === diffs[j].slice(1)
    )
    // If there's a match, add lines in between
    if (newI !== -1) {
      while (i < newI) {
        result.push(lines[i])
        i++
      }
    }
    // After this function, i and j are matching (if there is any match for j); otherwise i is unchanged.
  }
  // Apply each line in the diff
  for (; j < diffs.length; j++) {
    seekAndApply()
    const diffLine = diffs[j]
    if (diffLine.startsWith('-')) {
      // Deletion
      if (lines[i] === diffLine.slice(1)) {
        i++
      } else {
        console.error(`bad delete i${i} j${j}`, lines[i], diffLine.slice(1))
      }
    } else if (diffLine.startsWith('+')) {
      // Insertion of diffLine
      result.push(diffLine.slice(1))
    } else {
      // Context
      result.push(lines[i])
      i++
    }
  }
  // Add remaining lines in i
  for (; i < lines.length; i++) {
    result.push(lines[i])
  }
  return result.join('\n')
}
