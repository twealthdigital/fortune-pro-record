(async () => {
  const v = document.getElementById('v');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    v.srcObject = stream;
    window.addEventListener('pagehide', () => stream.getTracks().forEach((t) => t.stop()));
  } catch (err) {
    document.body.style.background = '#1a0d05';
  }
})();
