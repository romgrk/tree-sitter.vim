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
    content,
    tree,
  }
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

