/*
 * diff.js
 */

module.exports = getDiff


function test() {
  let previous = [
    '/* files.js */',
    'const x = 1; console.log(x);',
    '',
  ]
  let next     = [
    '/* files.js */',
    '',
  ]

  const diff = getDiff(previous, next)

  if (diff !== undefined) {
    const oldContent = previous.join('\n').slice(diff.startIndex, diff.oldEndIndex)
    const newContent = next.join('\n').slice(diff.startIndex, diff.newEndIndex)

    console.log({ ...diff, oldContent, newContent })
  }
}


function getDiff(previousLines, nextLines) {
  const minLength = Math.min(previousLines.length, nextLines.length)
  const maxLength = Math.max(previousLines.length, nextLines.length)

  let start
  let oldEnd
  let newEnd

  for (let i = 0; i < minLength; i++) {
    if (previousLines[i] === nextLines[i])
      continue
    start = i
    break
  }

  for (let i = 0; i < previousLines.length; i++) {
    const iPlusOne = i + 1
    if (previousLines[previousLines.length - iPlusOne] === nextLines[nextLines.length - iPlusOne])
      continue
    oldEnd = previousLines.length - i - 1
    newEnd = nextLines.length - i - 1
    break
  }

  if (start === undefined)
    return undefined

  // Line removed
  if (oldEnd > newEnd) {
    const startPosition  = { row: oldEnd, column: 0 }
    const oldEndPosition = { row: oldEnd, column: previous[oldEnd].length }
    const newEndPosition = { row: newEnd, column: next[newEnd].length }

    let startIndex = startPosition.column
    for (let i = 0; i < startPosition.row; i++) {
      startIndex += previousLines[i].length + 1 // +1 for \n character
    }
    let oldEndIndex = oldEndPosition.column
    for (let i = 0; i < oldEndPosition.row; i++) {
      oldEndIndex += previousLines[i].length + 1 // +1 for \n character
    }
    let newEndIndex = startIndex
    return { startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition }
  }

  // Line added
  if (oldEnd < newEnd) {
    const startPosition  = { row: newEnd, column: 0 }
    const oldEndPosition = { row: newEnd, column: previous[newEnd].length }
    const newEndPosition = { row: newEnd, column: next[newEnd].length }

    let startIndex = startPosition.column
    for (let i = 0; i < start; i++) {
      startIndex += previousLines[i].length + 1 // +1 for \n character
    }
    let oldEndIndex = oldEndPosition.column
    for (let i = 0; i < newEnd; i++) {
      oldEndIndex += previousLines[i].length + 1 // +1 for \n character
    }
    let newEndIndex = newEndPosition.column
    for (let i = 0; i < newEnd; i++) {
      newEndIndex += nextLines[i].length + 1 // +1 for \n character
    }

    return { startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition }
  }

  const lineDiff = getLineDiff(previousLines[start], nextLines[start])

  const startPosition  = { row: start, column: lineDiff.start }
  const oldEndPosition = { row: start, column: lineDiff.oldEnd }
  const newEndPosition = { row: start, column: lineDiff.newEnd }

  let startIndex = lineDiff.start
  for (let i = 0; i < start; i++) {
    startIndex += previousLines[i].length + 1 // +1 for \n character
  }
  let oldEndIndex = lineDiff.oldEnd
  for (let i = 0; i < oldEnd; i++) {
    oldEndIndex += previousLines[i].length + 1 // +1 for \n character
  }
  let newEndIndex = lineDiff.newEnd
  for (let i = 0; i < newEnd; i++) {
    newEndIndex += nextLines[i].length + 1 // +1 for \n character
  }

  return { start, oldEnd, startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition }
}

function getLineDiff(previous, next) {
  const minLength = Math.min(previous.length, next.length)
  const maxLength = Math.max(previous.length, next.length)

  let start
  let oldEnd
  let newEnd

  for (let i = 0; i < minLength; i++) {
    if (previous[i] === next[i])
      continue
    start = i
    break
  }

  for (let i = 1; i <= previous.length + 1; i++) {
    const iPlusOne = i === 1 ? undefined : -i + 1
    if (previous.slice(-i, iPlusOne)[0] === next.slice(-i, iPlusOne)[0])
      continue
    oldEnd = previous.length - i + 2
    newEnd = next.length - i + 2
    break
  }

  return { start, oldEnd, newEnd }
}
