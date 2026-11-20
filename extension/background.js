function openPermissionPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') openPermissionPage();
});

// Keyboard shortcut: show / hide annotation tools on every tab
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-annotate') return;
  const { annOn = false } = await chrome.storage.local.get('annOn');
  await chrome.storage.local.set({ annOn: !annOn });
});
