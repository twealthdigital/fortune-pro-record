const msg = document.getElementById('msg');

async function ask() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    await chrome.storage.local.set({ granted: true, on: true });
    msg.textContent = 'Camera allowed. Your bubble is live on every tab. You can close this tab now.';
  } catch (err) {
    msg.textContent = 'Camera was blocked. Click the camera icon in the address bar, allow it, then press the button again.';
  }
}

document.getElementById('allow').addEventListener('click', ask);
ask();
