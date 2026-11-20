function openPermissionPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') openPermissionPage();
});

chrome.action.onClicked.addListener(async () => {
  const { on = false, granted = false } = await chrome.storage.local.get(['on', 'granted']);
  if (!granted) {
    openPermissionPage();
    return;
  }
  await chrome.storage.local.set({ on: !on });
});
