const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {URL};
vm.createContext(sandbox);
vm.runInContext(readFileSync(__dirname + '/extractor.js', 'utf8'), sandbox);
const classify = sandbox.classifyBlackboardLink;
const base = 'https://bb.cruzeirodosulvirtual.com.br/ultra/courses/_example_1';
for (const [path, label, expected] of [
  ['/file/_123_1?courseId=_example_1', 'Aula.pdf', 'possivel-arquivo'],
  ['/calendar', 'Agenda', 'navegacao-do-curso'],
  ['/outline/message?recipientIds=x', 'Enviar mensagem', 'navegacao-do-curso'],
  ['/outline', 'Disciplina', 'disciplina'],
  ['/assessment/_456_1/overview', 'Pesquisa', 'avaliacao'],
  ['/outline/roster', 'Participantes', 'navegacao-do-curso'],
]) assert.equal(classify(base + path, label), expected);
assert.equal(classify('https://example.com/material.pdf', 'Material'), 'possivel-arquivo');
assert.equal(classify('https://example.com/chat', 'Grupo'), 'outro-link');
console.log('8 casos de classificação passaram.');
