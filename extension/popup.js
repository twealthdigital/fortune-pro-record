const cam = document.getElementById('cam');
const ann = document.getElementById('ann');

chrome.storage.local.get(['on', 'annOn'], (v) => {
  cam.checked = !!v.on;
  ann.checked = !!v.annOn;
});

cam.addEventListener('change', async () => {
  const { granted = false } = await chrome.storage.local.get('granted');
  if (cam.checked && !granted) {
    cam.checked = false;
    chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
    return;
  }
  chrome.storage.local.set({ on: cam.checked });
});

ann.addEventListener('change', () => {
  chrome.storage.local.set({ annOn: ann.checked });
});

chrome.storage.onChanged.addListener((c) => {
  if (c.on) cam.checked = !!c.on.newValue;
  if (c.annOn) ann.checked = !!c.annOn.newValue;
});
