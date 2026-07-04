const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'v3/css/style.css'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(appSource.includes('const modalStack = []'), 'modal layer keeps an explicit stack for nested dialogs');
assert(appSource.includes('function openAppModal'), 'modal layer exposes openAppModal');
assert(appSource.includes('function closeTopModal'), 'modal layer exposes closeTopModal');
assert(appSource.includes('function trapModalFocus'), 'modal layer traps Tab/Shift+Tab inside the top modal');
assert(appSource.includes("event.key === 'Escape'"), 'Escape closes the top modal');
assert(appSource.includes("event.key !== 'Tab'") || appSource.includes("event.key === 'Tab'"), 'Tab handling is wired for focus trap');
assert(appSource.includes('restoreModalFocus'), 'modal close restores focus to the exact opener when possible');
assert(appSource.includes('data-app-modal-open'), 'modal triggers are rendered with stable opener attributes');
assert(appSource.includes('data-app-modal-close'), 'modal top/bottom close buttons are rendered');
assert(appSource.includes("modal.setAttribute('role', 'dialog')"), 'modal markup has role=dialog');
assert(appSource.includes("modal.setAttribute('aria-modal', 'true')"), 'modal markup has aria-modal=true');
assert(appSource.includes("modal.setAttribute('aria-labelledby', labelId)"), 'modal markup has a stable labelledby heading');
assert(appSource.includes('upgradeOperationDetailsToModals(appEl)'), 'render route upgrades any remaining operation sources after binding');
assert(appSource.includes('openModalForElement') && appSource.includes('openModalForForm'), 'quick-action helpers can open migrated modal forms');

assert(!appSource.includes('class="operation-details"'), 'primary operation forms are no longer rendered with operation-details details spoilers');
assert(appSource.includes('function operationDetails') && appSource.includes('operation-modal-source'), 'shared operationDetails helper returns modal-upgraded operation sources, not operation-details spoilers');

[
  'manage-workers-details',
  'viz-committee-details',
  'editor-operation-details',
  'swap-create-details',
  'minter-send-details',
  'decimal-send-details'
].forEach((id) => {
  assert(appSource.includes(`id="${id}" class="operation-modal-source"`) || appSource.includes(`id="${id}"`) || appSource.includes(`'${id}'`), `${id} remains discoverable for modal upgrade/open helpers`);
});
assert(appSource.includes("trigger.setAttribute('data-app-modal-open', rawId)"), 'operation source upgrade creates stable modal opener attributes');

assert(cssSource.includes('.app-modal[role="dialog"]'), 'CSS styles modal dialog panels');
assert(cssSource.includes('.app-modal-backdrop'), 'CSS styles modal overlay/backdrop');
assert(cssSource.includes('max-height: min(90vh'), 'modal panel has responsive max-height scrolling');
assert(cssSource.includes('.app-modal-close'), 'CSS styles visible close controls');
assert(cssSource.includes('.app-modal-open'), 'body scroll state exists while modal is open');

assert(planSource.includes('Current focused pass — Accessible modal windows for large operation blocks'), 'plan records the modal conversion pass');
assert(planSource.includes('No incomplete handoff with primary operation-form spoilers left for later'), 'plan forbids leaving primary operation spoilers for later');

console.log('v3 modal accessibility smoke passed');
