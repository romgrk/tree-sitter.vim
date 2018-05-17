/*
 * index.js
 */

const neovim = require('neovim')
const Parser = require('tree-sitter')
const languages = {
  javascript: require('tree-sitter-javascript'),
}

// To get completion only
try { let nvim = new neovim.Neovim() } catch(e) {}

// Exports
module.exports = plugin => {
  nvim = plugin.nvim
  plugin.registerCommand('Test', test, { sync: true })
}


function test(...args) {
  nvim.command('vsplit')
}
