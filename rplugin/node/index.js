/*
 * index.js
 */

const neovim = require('neovim')
const TreeSitter = require('tree-sitter')


const parsers = {
  javascript: getParser('tree-sitter-javascript'),
}


const detailsByID = {}


let nvim
// To get completion only
try { nvim = new neovim.Neovim() } catch(e) {}


// Exports
module.exports = plugin => {
  nvim = global.nvim = plugin.nvim

  // To get completion only
  try { plugin = new neovim.NvimPlugin() } catch(e) {}

  plugin.registerAutocmd('BufNewFile,BufReadPost', onBufferOpen, { pattern: '*', eval: 'expand("<afile>:p")' })

  plugin.registerCommand('TreeSitterGetCurrentNode', getCurrentNode, { sync: true })
  plugin.registerCommand('TreeSitterColorize', colorize, { sync: false })
  // require('fs').writeFileSync('./debug.log', (typeof colorize + ':' + String(colorize)))
}




async function onBufferOpen(name) {
  if (!/\.js$/.test(name))
    return

  log('onBufferOpen', name)

  const buffer = await getBufferByName(name)
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
}


async function colorize() {
  log('colorize')

  const buffer = await nvim.buffer
  const details = detailsByID[buffer.data]

  if (!details) {
    log('No details')
    return
  }

  const { tree, content } = details

  let val = undefined
  traverse(tree.rootNode, node => {

    if (node.type === 'identifier' && node.parent.type === 'function')
      return highlight(buffer, node, 'Function')

    if (node.type === 'function' && getText(content, node) === 'function')
      return highlight(buffer, node, 'Keyword')

    if (node.type === 'property_identifier' && node.parent.type === 'pair')
      return highlight(buffer, node, 'StorageClass')
    if (node.type === 'shorthand_property_identifier' && node.parent.type === 'object')
      return highlight(buffer, node, 'StorageClass')

    switch (node.type) {
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
      case '...':
        highlight(buffer, node, 'Operator'); break;

      case '(':
      case ')':
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
      case 'while':
      case 'try':
      case 'catch':
      case 'switch':
      case 'case':
      case 'return':
        highlight(buffer, node, 'Keyword'); break;

      case 'null':
      case 'undefined':
        highlight(buffer, node, 'Constant'); break;

      case 'true':
      case 'false':
        highlight(buffer, node, 'Boolean'); break;

      case 'var':
      case 'let':
      case 'const':
        highlight(buffer, node, 'StorageClass'); break;

      default: log(node.type, content.slice(node.startIndex, node.endIndex).slice(0, 10))
    }
  })
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
    buffer.addHighlight(hl)
  })
}

function getText(content, node) {
  return content.slice(node.startIndex, node.endIndex)
}

async function getBufferByName(name) {
  const buffers = await nvim.buffers
  const names = await Promise.all(buffers.map(b => b.name))
  const index = names.findIndex(n => n === name)
  return buffers[index]
}

function log(...args) {
  const prefix = '[tree-sitter.vim]'
  nvim.command(`echomsg '${prefix} ` + args.map(JSON.stringify).join(', ') + `'`)
}

function getParser(module) {
  const lang = require(module)
  const parser = new TreeSitter()
  parser.setLanguage(lang)
  return parser
}
