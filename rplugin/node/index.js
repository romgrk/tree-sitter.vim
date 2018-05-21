/*
 * index.js
 */

const neovim = require('neovim')
const TreeSitter = require('tree-sitter')
const parsers = {
  javascript: getParser('tree-sitter-javascript'),
}

const getDiff = require('../../diff.js')



const detailsByID = {}


let nvim
// To get completion only
try { nvim = new neovim.Neovim() } catch(e) {}


// Exports
module.exports = plugin => {
  nvim = global.nvim = plugin.nvim

  // To get completion only
  try { plugin = new neovim.NvimPlugin() } catch(e) {}

  plugin.registerAutocmd('BufNewFile,BufReadPost',   onBufferOpen,   { pattern: '*', eval: 'expand("<afile>:p")' })
  plugin.registerAutocmd('TextChanged,TextChangedI', onBufferChange, { pattern: '*', eval: 'expand("<afile>:p")' })

  plugin.registerCommand('TreeSitterGetCurrentNode', getCurrentNode, { sync: true })
  plugin.registerCommand('TreeSitterColorizeStart',  colorizeStart,  { sync: false })
  plugin.registerCommand('TreeSitterColorizeStop',   colorizeStop,   { sync: false })
  // require('fs').writeFileSync('./debug.log', (typeof colorize + ':' + String(colorize)))
}

process.on('uncaughtException', (err) => {
  log('Caught exception', err.stack);
})



async function onBufferOpen(name) {
/*   if (!/\.js$/.test(name))
 *     return
 * 
 *   log('onBufferOpen', name)
 * 
 *   const buffer = await getBufferByName(name)
 *   const id = buffer.data
 *   const lines = await buffer.getLines()
 * 
 *   const content = lines.join('\n')
 *   const tree = parsers.javascript.parse(content)
 * 
 *   detailsByID[id] = {
 *     id,
 *     buffer,
 *     lines,
 *     content,
 *     tree,
 *   } */
}

async function onBufferChange(name) {
  log('onBufferChangePre', name)

  if (!/\.js$/.test(name))
    return

  log('onBufferChange', name)

  const buffer = await getBufferByName(name)
  const id = buffer.data
  const details = detailsByID[id]

  if (!details)
    return

  const { content, lines, tree } = detailsByID[id]

  const newLines = await buffer.getLines()
  const newContent = lines.join('\n')

  const diff = getDiff(lines, newLines)
  log(diff)
  /* log({
   *   oldContent: lines.join('\n').slice(diff.startIndex, diff.oldEndIndex),
   *   newContent: newLines.join('\n').slice(diff.startIndex, diff.newEndIndex),
   * }) */

  tree.edit(diff)
  const newTree = parsers.javascript.parse(newContent, tree)

  detailsByID[id] = {
    id,
    buffer,
    lines: newLines,
    content: newContent,
    tree: newTree,
  }

  colorize(id, tree, diff)
}

async function colorizeStop() {
  const buffer = await nvim.buffer
  const id = buffer.data
  delete detailsByID[id]
  await buffer.clearHighlight()
}

async function colorizeStart() {
  log('startColorization')

  const buffer = await nvim.buffer
  const id = buffer.data
  const lines = await buffer.getLines()

  const content = lines.join('\n')
  const tree = parsers.javascript.parse(content)

  detailsByID[id] = {
    id,
    buffer,
    lines,
    content,
    tree,
  }

  try {
    await colorize(id)
  } catch(e) {
    log('error', e.toString(), e.stack)
  }
}

async function colorize(id, previousTree, diff) {
  log('colorize')

  const {
    buffer,
    lines,
    content,
    tree,
  } = detailsByID[id]

  const previousIDs = new Set()
  const nextIDs = new Set()

  if (previousTree)
    traverse(previousTree.rootNode, node => previousIDs.add(node.id))

  const startRow = diff ? diff.startPosition.row : 0
  const endRow   = diff ? Math.max(diff.newEndPosition.row, diff.oldEndPosition.row) : Infinity
  await buffer.clearHighlight(diff ? { lineStart: startRow + 1, lineEnd: endRow + 1 } : undefined)
  await delay(50)

  traverse(tree.rootNode, node => {
    if (node.startPosition.row < startRow || node.endPosition.row > endRow)
      return

    log(node.children.length === 0 ? '[leaf]' : '[branch]', node.type, content.slice(node.startIndex, node.endIndex).slice(0, 10))

    if (node.type === 'identifier' && node.parent.type === 'function')
      return highlight(buffer, node, 'Function')

    if (node.type === 'identifier' && node.parent.type === 'call_expression')
      return highlight(buffer, node, 'Function')
    if (node.type === 'property_identifier'
        && node.parent.type === 'member_expression'
        && node.parent.parent.type === 'call_expression'
        && equals(node, node.parent.children[node.parent.children.length - 1]))
      return highlight(buffer, node, 'Function')

    if (node.type === 'function' && getText(content, node) === 'function')
      return highlight(buffer, node, 'Keyword')

    if (node.type === 'property_identifier' && node.parent.type === 'pair')
      return highlight(buffer, node, 'StorageClass')
    if (node.type === 'shorthand_property_identifier' && node.parent.type === 'object')
      return highlight(buffer, node, 'StorageClass')

    switch (node.type) {
      case 'identifier':
        highlight(buffer, node, 'Normal'); break;

      case '=':
      case '<=':
      case '>=':
      case '===':
      case '==':
      case '=>':
      case '*':
      case '/':
      case '-':
      case '+':
      case '!':
      case '&&':
      case '||':
      case '&':
      case '|':
      case '>>':
      case '<<':
      case '?':
      case '...':
        highlight(buffer, node, 'Operator'); break;

      case '(':
      case ')':
      case '${':
      case '{':
      case '}':
      case '[':
      case ']':
      case '.':
      case ',':
      case ';':
      case ':':
      case 'comment':
        highlight(buffer, node, 'Comment'); break;

      case 'if':
      case 'else':
      case 'async':
      case 'await':
      case 'for':
      case 'in':
      case 'of':
      case 'do':
      case 'while':
      case 'try':
      case 'catch':
      case 'switch':
      case 'case':
      case 'break':
      case 'return':
      case 'new':
      case 'delete':
        highlight(buffer, node, 'Keyword'); break;

      case 'null':
      case 'undefined':
        highlight(buffer, node, 'Constant'); break;

      case 'true':
      case 'false':
        highlight(buffer, node, 'Boolean'); break;

      case 'number':
        highlight(buffer, node, 'Number'); break;

      case 'string':
      case 'template_string':
        highlight(buffer, node, 'String'); break;

      case 'regex':
        highlight(buffer, node, 'Regexp'); break;

      case 'var':
      case 'let':
      case 'const':
        highlight(buffer, node, 'StorageClass'); break;
    }
  })

  log('colorize end')
}


async function getCurrentNode() {
  const buffer = await nvim.buffer
  const details = detailsByID[buffer.data]

  if (!details) {
    log('No details')
    return
  }

  const position = await nvim.eval('{ "row": line(".") - 1, "column": col(".") }')
  log(position)
  const node = details.tree.rootNode.descendantForPosition(position)
  const text = details.content.slice(node.startIndex, node.endIndex)
  log(node, text)
}



/*
 * Helpers
 */

async function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function traverse(node, fn) {
  fn(node)
  node.children.forEach(child => {
    traverse(child, fn)
  })
}

function highlight(buffer, node, hlGroup) {
  const hls =
    Array(node.endPosition.row - node.startPosition.row + 1)
      .fill(node.startPosition.row)
      .map((start, i) => ({ hlGroup, line: start + i, colStart: 0, colEnd: -1 }))

  hls[0].colStart = node.startPosition.column
  hls[hls.length - 1].colEnd = node.endPosition.column

  hls.forEach(hl => {
    log(hl)
    buffer.addHighlight(hl)
  })
}

function getText(content, node) {
  return content.slice(node.startIndex, node.endIndex)
}

function equals(node, other) {
  return node.type === other.type && node.startIndex === other.startIndex && node.endIndex === other.endIndex
}

async function getBufferByName(name) {
  const buffers = await nvim.buffers
  const names = await Promise.all(buffers.map(b => b.name))
  const index = names.findIndex(n => n === name)
  return buffers[index]
}

function log(...args) {
  const prefix = '[tree-sitter.vim]'
  const line = `${prefix} ` + args.map(JSON.stringify).join(', ')
  nvim.command(`if !exists('g:lines') | let g:lines = [] | end`)
  nvim.command(`call add(lines, '${line}')`)
}

function getParser(module) {
  const lang = require(module)
  const parser = new TreeSitter()
  parser.setLanguage(lang)
  return parser
}
