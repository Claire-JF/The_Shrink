/* global mockShell */

const scoreReadout = document.getElementById('scoreReadout');
const summaryReadout = document.getElementById('summaryReadout');
const stateChip = document.getElementById('stateChip');
const orbRoot = document.getElementById('orbRoot');

function setChip(patch) {
  if (patch.chatSending) {
    stateChip.textContent = '对话中';
    stateChip.className = 'chip busy';
    return;
  }
  if (patch.analyzing) {
    stateChip.textContent = '分析';
    stateChip.className = 'chip busy';
    return;
  }
  const tier = patch.tier === 'refined' ? '精评' : patch.tier === 'preview' ? '预览' : '待机';
  stateChip.textContent = tier;
  stateChip.className =
    patch.tier === 'refined' ? 'chip refined' : patch.tier === 'preview' ? 'chip preview' : 'chip idle';
}

function applyPatch(patch = {}) {
  if (patch.total != null && !Number.isNaN(Number(patch.total))) {
    scoreReadout.textContent = Number(patch.total).toFixed(2);
  } else {
    scoreReadout.textContent = '–';
  }
  summaryReadout.textContent =
    patch.summary && String(patch.summary).trim()
      ? String(patch.summary).slice(0, 48) + (String(patch.summary).length > 48 ? '…' : '')
      : '双击球体收起';
  setChip(patch);
}

orbRoot.addEventListener('dblclick', (event) => {
  event.preventDefault();
  mockShell.dismissBoth();
});

mockShell.subscribeOrb((payload) => {
  applyPatch(payload || {});
});
