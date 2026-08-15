(function() {
  // ============ DOM ELEMENTS ============
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseLabel = document.getElementById('pauseLabel');
  const floatControlsBtn = document.getElementById('floatControlsBtn');
  const mobileRecordModal = document.getElementById('mobileRecordModal');
  const recordFrontCamBtn = document.getElementById('recordFrontCamBtn');
  const recordBackCamBtn = document.getElementById('recordBackCamBtn');
  const mobileRecordCancelBtn = document.getElementById('mobileRecordCancelBtn');
  const previewVideo = document.getElementById('previewVideo');
  const placeholder = document.getElementById('placeholder');
  const statusEl = document.getElementById('status');
  const timerEl = document.getElementById('timer');

  // Custom dropdowns
  const qualityDropdown = document.getElementById('qualityDropdown');
  const qualityDropdownBtn = document.getElementById('qualityDropdownBtn');
  const qualityDropdownText = document.getElementById('qualityDropdownText');
  const qualityDropdownMenu = document.getElementById('qualityDropdownMenu');

  const fpsDropdown = document.getElementById('fpsDropdown');
  const fpsDropdownBtn = document.getElementById('fpsDropdownBtn');
  const fpsDropdownText = document.getElementById('fpsDropdownText');
  const fpsDropdownMenu = document.getElementById('fpsDropdownMenu');

  const clarityToggleBtn = document.getElementById('clarityToggleBtn');

  // Camera overlay elements
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraVideo = document.getElementById('cameraVideo');
  const cameraToggleBtn = document.getElementById('cameraToggleBtn');
  const shapeBtn = document.getElementById('shapeBtn');
  const resizeHandle = document.getElementById('resizeHandle');
  const previewArea = document.getElementById('previewArea');
  const mirrorBtn = document.getElementById('mirrorBtn');

  // Audio elements
  const micToggleBtn = document.getElementById('micToggleBtn');
  const systemAudioToggleBtn = document.getElementById('systemAudioToggleBtn');

  // ============ STATE VARIABLES ============
  let mediaRecorder = null;
  let recordedChunks = [];
  let pipWindow = null;
  let screenStream = null;
  let cameraStream = null;
  let micStream = null;
  let systemAudioStream = null;
  let combinedStream = null;
  let audioContext = null;
  let audioDestination = null;
  let micSourceNode = null;
  let systemSourceNode = null;
  let startTime = 0;
  let pausedAccum = 0;
  let pauseStartedAt = 0;
  let timerInterval = null;
  let isPaused = false;
  let cameraEnabled = false;
  let isCircle = false;
  let isMirrored = false;
  let micEnabled = false;
  let systemAudioEnabled = false;

  // Dropdown state (replaces native <select> values)
  let qualityValue = '12k';
  let fpsValue = 60;
  let ultraClarityEnabled = true;

  // Camera drag/resize state
  let isDragging = false;
  let isResizing = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let startX, startY, startWidth, startHeight;

  // ============ CUSTOM DROPDOWN LOGIC ============
  function setupDropdown(dropdown, btn, textEl, menu, onSelect) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) dropdown.classList.add('open');
    });

    menu.querySelectorAll('.dropdown-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        textEl.textContent = option.dataset.label;
        onSelect(option.dataset.value);
        dropdown.classList.remove('open');
      });
    });
  }

  function closeAllDropdowns() {
    qualityDropdown.classList.remove('open');
    fpsDropdown.classList.remove('open');
  }

  document.addEventListener('click', closeAllDropdowns);

  setupDropdown(qualityDropdown, qualityDropdownBtn, qualityDropdownText, qualityDropdownMenu, (val) => {
    qualityValue = val;
    if (!statusEl.classList.contains('recording')) {
      const config = getQualitySettings();
      statusEl.textContent = `✨ Ready for ${config.label} MP4 recording · Ultra Clarity ${ultraClarityEnabled ? 'ON' : 'OFF'}`;
    }
  });

  setupDropdown(fpsDropdown, fpsDropdownBtn, fpsDropdownText, fpsDropdownMenu, (val) => {
    fpsValue = parseInt(val, 10);
  });

  // ============ ULTRA CLARITY TOGGLE ============
  function toggleUltraClarity() {
    ultraClarityEnabled = !ultraClarityEnabled;
    clarityToggleBtn.classList.toggle('active', ultraClarityEnabled);
    if (!statusEl.classList.contains('recording')) {
      const config = getQualitySettings();
      statusEl.textContent = `✨ Ready for ${config.label} MP4 recording · Ultra Clarity ${ultraClarityEnabled ? 'ON' : 'OFF'}`;
    }
  }
  clarityToggleBtn.addEventListener('click', toggleUltraClarity);

  // ============ CAMERA POSITION INITIALIZATION ============
  function setDefaultCameraPosition() {
    cameraContainer.style.left = 'auto';
    cameraContainer.style.right = '1.5rem';
    cameraContainer.style.bottom = '1.5rem';
    cameraContainer.style.top = 'auto';
    cameraContainer.style.width = '180px';
    cameraContainer.style.height = '140px';
  }
  setDefaultCameraPosition();

  // ============ CAMERA FUNCTIONS ============
  async function toggleCamera() {
    if (cameraEnabled) {
      stopCamera();
    } else {
      await startCamera();
    }
  }

  async function startCamera() {
    try {
      if (cameraStream) {
        stopCameraTracks();
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: false
      });

      cameraVideo.srcObject = cameraStream;
      cameraContainer.style.display = 'block';
      cameraEnabled = true;
      updateCameraTransform();

      cameraToggleBtn.classList.add('active');

      if (!statusEl.classList.contains('recording')) {
        statusEl.textContent = '📸 Camera overlay active';
      }
    } catch (err) {
      console.warn('Camera access denied:', err);
      statusEl.textContent = '⚠️ Camera permission denied';
      cameraEnabled = false;
      cameraContainer.style.display = 'none';
      cameraToggleBtn.classList.remove('active');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      stopCameraTracks();
    }
    cameraVideo.srcObject = null;
    cameraContainer.style.display = 'none';
    cameraEnabled = false;
    cameraToggleBtn.classList.remove('active');

    if (!statusEl.classList.contains('recording')) {
      statusEl.textContent = '📷 Camera overlay off';
    }
  }

  function stopCameraTracks() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    cameraStream = null;
  }

  // ============ MIRROR FUNCTIONALITY ============
  function toggleMirror() {
    isMirrored = !isMirrored;
    updateCameraTransform();
    mirrorBtn.classList.toggle('active', isMirrored);
  }

  function updateCameraTransform() {
    cameraVideo.style.transform = isMirrored ? 'scaleX(1)' : 'scaleX(-1)';
  }

  // ============ SHAPE TOGGLE ============
  function toggleShape() {
    isCircle = !isCircle;
    cameraContainer.classList.toggle('circle', isCircle);
    updateCameraTransform();
  }

  // ============ AUDIO FUNCTIONS ============
  async function toggleMicrophone() {
    if (micEnabled) {
      stopMicrophone();
    } else {
      await startMicrophone();
    }
  }

  async function startMicrophone() {
    try {
      if (micStream) {
        stopMicrophoneTracks();
      }

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      micEnabled = true;
      micToggleBtn.classList.add('active');

      if (!statusEl.classList.contains('recording')) {
        statusEl.textContent = '🎤 Your voice will be recorded (mic ON)';
      }
    } catch (err) {
      console.warn('Microphone access denied:', err);
      statusEl.textContent = '⚠️ Microphone permission denied';
      micEnabled = false;
      micToggleBtn.classList.remove('active');
    }
  }

  function stopMicrophone() {
    if (micStream) {
      stopMicrophoneTracks();
    }
    micEnabled = false;
    micToggleBtn.classList.remove('active');

    if (!statusEl.classList.contains('recording')) {
      statusEl.textContent = '🔇 Microphone off';
    }
  }

  function stopMicrophoneTracks() {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    micStream = null;
  }

  async function toggleSystemAudio() {
    if (systemAudioEnabled) {
      stopSystemAudio();
    } else {
      await startSystemAudio();
    }
  }

  // Captures the sound your device is playing (tab/app/system audio),
  // separate from your voice, so it can be mixed in at record time.
  async function startSystemAudio() {
    try {
      if (systemAudioStream) {
        stopSystemAudioTracks();
      }

      statusEl.textContent = '🔊 Pick a tab/screen and check "Share audio" in the popup…';

      // Most browsers only expose system/tab audio through getDisplayMedia,
      // and only when video capture is also requested.
      const capture = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      const audioTracks = capture.getAudioTracks();
      // We only need the audio — drop the video track from this picker stream.
      capture.getVideoTracks().forEach(t => t.stop());

      if (audioTracks.length > 0) {
        systemAudioStream = new MediaStream(audioTracks);
        systemAudioEnabled = true;
        systemAudioToggleBtn.classList.add('active');

        // If the user closes the source from the browser's "sharing" bar,
        // reflect that in the UI immediately.
        audioTracks[0].onended = () => stopSystemAudio();

        if (!statusEl.classList.contains('recording')) {
          statusEl.textContent = '🔊 Device sound will be recorded';
        }
      } else {
        systemAudioStream = null;
        systemAudioEnabled = false;
        systemAudioToggleBtn.classList.remove('active');
        statusEl.textContent = '⚠️ No audio track shared — tick "Share audio" in the picker and try again';
      }
    } catch (err) {
      console.warn('System audio capture failed:', err);
      systemAudioEnabled = false;
      systemAudioToggleBtn.classList.remove('active');
      if (err.name === 'NotAllowedError') {
        statusEl.textContent = '⚠️ Device audio permission was denied';
      } else {
        statusEl.textContent = '⚠️ Device audio capture failed — try again';
      }
    }
  }

  function stopSystemAudio() {
    if (systemAudioStream) {
      stopSystemAudioTracks();
    }
    systemAudioEnabled = false;
    systemAudioToggleBtn.classList.remove('active');

    if (!statusEl.classList.contains('recording')) {
      statusEl.textContent = '🔇 Device sound off';
    }
  }

  function stopSystemAudioTracks() {
    if (systemAudioStream) {
      systemAudioStream.getTracks().forEach(track => track.stop());
    }
    systemAudioStream = null;
  }

  // ============ COMBINE AUDIO STREAMS ============
  // Mixes mic + device audio into a single track via the Web Audio API.
  // (Just appending multiple raw audio tracks to one MediaStream only
  // ever plays the first one back — this actually blends both sources.)
  function buildMixedAudioTrack() {
    const hasMic = micEnabled && micStream && micStream.getAudioTracks().length > 0;
    const hasSystem = systemAudioEnabled && systemAudioStream && systemAudioStream.getAudioTracks().length > 0;

    if (!hasMic && !hasSystem) return null;

    if (audioContext) {
      audioContext.close().catch(() => {});
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    audioDestination = audioContext.createMediaStreamDestination();

    if (hasMic) {
      micSourceNode = audioContext.createMediaStreamSource(micStream);
      micSourceNode.connect(audioDestination);
    }

    if (hasSystem) {
      systemSourceNode = audioContext.createMediaStreamSource(systemAudioStream);
      systemSourceNode.connect(audioDestination);
    }

    return audioDestination.stream.getAudioTracks()[0] || null;
  }

  // ============ QUALITY SETTINGS ============
  function getQualitySettings() {
    const settings = {
      '12k': {
        width: 12288,
        height: 6480,
        videoBitrate: 100000000,
        audioBitrate: 320000,
        label: '12K Extreme Ultra HD'
      },
      '8k': {
        width: 7680,
        height: 4320,
        videoBitrate: 60000000,
        audioBitrate: 320000,
        label: '8K Ultra HD'
      },
      '4k': {
        width: 3840,
        height: 2160,
        videoBitrate: 35000000,
        audioBitrate: 320000,
        label: '4K Ultra HD'
      },
      '1080p': {
        width: 1920,
        height: 1080,
        videoBitrate: 15000000,
        audioBitrate: 320000,
        label: 'Full HD 1080p'
      },
      '720p': {
        width: 1280,
        height: 720,
        videoBitrate: 8000000,
        audioBitrate: 256000,
        label: 'HD 720p'
      }
    };

    const base = settings[qualityValue] || settings['12k'];
    let videoBitrate = base.videoBitrate;
    let audioBitrate = base.audioBitrate;

    // Ultra Clarity: push bitrate headroom further so the encoder never
    // has to starve fine detail to hit a target size, and max out audio.
    if (ultraClarityEnabled) {
      videoBitrate = Math.round(videoBitrate * 1.6);
      audioBitrate = Math.min(384000, Math.round(audioBitrate * 1.2));
    }

    return {
      ...base,
      videoBitrate,
      audioBitrate,
      frameRate: fpsValue
    };
  }

  // ============ MIME TYPE SELECTION (MP4 FIRST) ============
  function pickBestMimeType() {
    // Ordered from most-preferred (real MP4/H.264 or HEVC) down to
    // last-resort WebM, so recordings stay .mp4 on any browser that
    // can produce it at all.
    const candidates = [
      'video/mp4;codecs=avc1.640034,mp4a.40.2', // H.264 High Profile Level 5.2 + AAC
      'video/mp4;codecs=avc1.640033,mp4a.40.2',
      'video/mp4;codecs=hvc1,mp4a.40.2',        // HEVC
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];

    for (const type of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  // ============ RECORDING FUNCTIONS ============
  async function startRecording() {
    try {
      const config = getQualitySettings();

      // Video-only screen capture — device sound is handled separately via
      // the system-audio toggle so we don't pop the share dialog twice.
      const videoConstraints = {
        frameRate: { ideal: config.frameRate, max: config.frameRate },
        width: { ideal: config.width, max: config.width },
        height: { ideal: config.height, max: config.height },
        cursor: 'always'
      };
      if (ultraClarityEnabled) {
        // Ask the browser not to downscale the capture for performance.
        videoConstraints.resizeMode = 'none';
      }

      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: false
      });

      const videoTrack = screenStream.getVideoTracks()[0];

      // Try to lock in native resolution / detail hint for max sharpness.
      if (videoTrack) {
        if (ultraClarityEnabled && videoTrack.contentHint !== undefined) {
          videoTrack.contentHint = 'detail';
        } else if (videoTrack.contentHint !== undefined) {
          videoTrack.contentHint = 'motion';
        }
        if (typeof videoTrack.applyConstraints === 'function') {
          try {
            await videoTrack.applyConstraints({
              ...videoConstraints,
              resizeMode: ultraClarityEnabled ? 'none' : 'crop-and-scale'
            });
          } catch (e) {
            // Not fatal — some browsers reject resizeMode; keep going.
          }
        }
      }

      const mixedAudioTrack = buildMixedAudioTrack();
      const tracks = [videoTrack];
      if (mixedAudioTrack) tracks.push(mixedAudioTrack);

      combinedStream = new MediaStream(tracks);

      previewVideo.srcObject = combinedStream;
      previewVideo.classList.add('active');
      placeholder.style.display = 'none';

      const mimeType = pickBestMimeType();
      if (!mimeType) {
        throw new Error('No supported recording format found in this browser');
      }
      const isMp4 = mimeType.startsWith('video/mp4');

      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: config.videoBitrate,
        audioBitsPerSecond: config.audioBitrate
      });

      recordedChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = saveRecording;
      mediaRecorder.start(1000);

      startTime = Date.now();
      pausedAccum = 0;
      startTimer();

      // Update UI
      startBtn.disabled = true;
      stopBtn.disabled = false;
      pauseBtn.disabled = false;
      floatControlsBtn.disabled = false;
      pauseLabel.textContent = 'Pause';
      isPaused = false;

      const audioStatus = [];
      if (micEnabled) audioStatus.push('voice');
      if (systemAudioEnabled) audioStatus.push('device sound');

      const formatNote = isMp4 ? 'MP4' : 'WebM (this browser can\'t encode MP4 directly)';
      const clarityNote = ultraClarityEnabled ? ' · Ultra Clarity' : '';

      statusEl.textContent = `🔴 Recording ${config.label} @ ${config.frameRate}FPS · ${formatNote}${clarityNote}${cameraEnabled ? ' · cam' : ''}${audioStatus.length ? ' · ' + audioStatus.join(' + ') : ' · no audio'}`;
      statusEl.classList.add('recording');

      // Auto-stop when user stops screen sharing
      videoTrack.onended = () => stopRecording();

    } catch (err) {
      console.error('Failed to start recording:', err);
      statusEl.textContent = '❌ Failed to start: ' + err.message;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }

    if (combinedStream) {
      combinedStream.getTracks().forEach(t => t.stop());
    }

    if (micSourceNode) { try { micSourceNode.disconnect(); } catch (e) {} micSourceNode = null; }
    if (systemSourceNode) { try { systemSourceNode.disconnect(); } catch (e) {} systemSourceNode = null; }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    floatControlsBtn.disabled = true;
      if (pipWindow) { pipWindow.close(); pipWindow = null; }
    stopTimer();

    statusEl.textContent = '⏳ Processing recording…';
    statusEl.classList.remove('recording');

    setTimeout(() => {
      previewVideo.classList.remove('active');
      previewVideo.srcObject = null;
      placeholder.style.display = 'flex';
    }, 800);
  }

  function saveRecording() {
    const config = getQualitySettings();

    const isMp4 = mediaRecorder.mimeType.includes('mp4');
    const extension = isMp4 ? 'mp4' : 'webm';
    const mimeType = mediaRecorder.mimeType || 'video/mp4';

    const blob = new Blob(recordedChunks, {
      type: mimeType
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.label.replace(/\s+/g, '-').toLowerCase()}-recording-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    statusEl.textContent = `✅ Saved ${sizeMB} MB ${extension.toUpperCase()} (${config.label})`;
    recordedChunks = [];
  }

  // ============ MOBILE FALLBACK: CAMERA RECORDING ============
  function handleStartClick() {
    const screenCaptureSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (screenCaptureSupported) {
      startRecording();
    } else {
      mobileRecordModal.classList.add('open');
    }
  }

  function closeMobileRecordModal() {
    mobileRecordModal.classList.remove('open');
  }

  async function startCameraRecordingFallback(facingMode) {
    closeMobileRecordModal();
    try {
      const config = getQualitySettings();

      screenStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate, max: config.frameRate }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];
      combinedStream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);

      previewVideo.srcObject = combinedStream;
      previewVideo.classList.add('active');
      placeholder.style.display = 'none';

      const mimeType = pickBestMimeType();
      if (!mimeType) throw new Error('No supported recording format found in this browser');
      const isMp4 = mimeType.startsWith('video/mp4');

      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: config.videoBitrate,
        audioBitsPerSecond: config.audioBitrate
      });

      recordedChunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = saveRecording;
      mediaRecorder.start(1000);

      startTime = Date.now();
      pausedAccum = 0;
      startTimer();

      startBtn.disabled = true;
      stopBtn.disabled = false;
      pauseBtn.disabled = false;
      pauseLabel.textContent = 'Pause';
      isPaused = false;

      const camLabel = facingMode === 'user' ? 'front camera' : 'back camera';
      const formatNote = isMp4 ? 'MP4' : 'WebM';
      statusEl.textContent = `🔴 Recording ${camLabel} @ ${config.frameRate}FPS · ${formatNote}${audioTrack ? ' · mic' : ' · no audio'}`;
      statusEl.classList.add('recording');

      videoTrack.onended = () => stopRecording();
    } catch (err) {
      console.error('Failed to start camera recording:', err);
      statusEl.textContent = '❌ Failed to start: ' + err.message;
    }
  }

  function togglePause() {
    if (!mediaRecorder) return;

    if (isPaused) {
      mediaRecorder.resume();
      pauseLabel.textContent = 'Pause';
      statusEl.textContent = '🔴 Recording resumed';
      statusEl.classList.add('recording');
      pausedAccum += Date.now() - pauseStartedAt;
      startTimer();
    } else {
      mediaRecorder.pause();
      pauseLabel.textContent = 'Resume';
      statusEl.textContent = '⏸ Recording paused';
      statusEl.classList.remove('recording');
      pauseStartedAt = Date.now();
      stopTimer();
    }

    isPaused = !isPaused;
  }

  async function toggleFloatingControls() {
    if (pipWindow) { pipWindow.close(); return; }
    if (!('documentPictureInPicture' in window)) {
      statusEl.textContent = '⚠️ Floating controls need Chrome or Edge 116+';
      return;
    }
    try {
      pipWindow = await documentPictureInPicture.requestWindow({ width: 260, height: 150 });
      pipWindow.document.title = 'Recorder Controls';
      pipWindow.document.body.style.cssText =
        'margin:0;background:#000;font-family:Inter,system-ui,sans-serif;color:#f5f2ee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.6rem;height:100%;';
      pipWindow.document.head.insertAdjacentHTML('beforeend',
        '<style>button{cursor:pointer;font-weight:700;border-radius:0.8rem;padding:0.6rem 1.1rem;border:1px solid #ff6b00;background:#141414;color:#f5f2ee;font-size:0.85rem;}button.stop{background:#ff4d4d;border-color:#ff4d4d;color:#fff;}</style>');

      const timerDiv = pipWindow.document.createElement('div');
      timerDiv.id = 'pipTimer';
      timerDiv.style.cssText = 'font-size:1.6rem;font-weight:700;color:#ff6b00;font-family:monospace;';
      timerDiv.textContent = timerEl.textContent;

      const row = pipWindow.document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.6rem;';

      const pipPauseBtn = pipWindow.document.createElement('button');
      pipPauseBtn.textContent = pauseLabel.textContent;
      pipPauseBtn.onclick = () => { togglePause(); pipPauseBtn.textContent = pauseLabel.textContent; };

      const pipStopBtn = pipWindow.document.createElement('button');
      pipStopBtn.className = 'stop';
      pipStopBtn.textContent = 'Stop & Save';
      pipStopBtn.onclick = () => stopRecording();

      row.appendChild(pipPauseBtn);
      row.appendChild(pipStopBtn);
      pipWindow.document.body.appendChild(timerDiv);
      pipWindow.document.body.appendChild(row);

      floatControlsBtn.classList.add('active');
      pipWindow.addEventListener('pagehide', () => {
        pipWindow = null;
        floatControlsBtn.classList.remove('active');
      });
    } catch (err) {
      console.warn('Floating controls failed:', err);
      statusEl.textContent = '⚠️ Could not open floating controls';
      pipWindow = null;
    }
  }

  // ============ DRAG & RESIZE FUNCTIONALITY ============
  cameraContainer.addEventListener('mousedown', (e) => {
    if (e.target === resizeHandle || e.target.closest('#resizeHandle')) return;

    isDragging = true;
    cameraContainer.classList.add('dragging');
    const rect = cameraContainer.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = cameraContainer.offsetWidth;
    startHeight = cameraContainer.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const parentRect = previewArea.getBoundingClientRect();
      let newLeft = e.clientX - parentRect.left - dragOffsetX;
      let newTop = e.clientY - parentRect.top - dragOffsetY;

      newLeft = Math.max(0, Math.min(newLeft, parentRect.width - cameraContainer.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, parentRect.height - cameraContainer.offsetHeight));

      cameraContainer.style.left = newLeft + 'px';
      cameraContainer.style.top = newTop + 'px';
      cameraContainer.style.right = 'auto';
      cameraContainer.style.bottom = 'auto';
    }

    if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newWidth = Math.max(80, startWidth + dx);
      let newHeight = Math.max(60, startHeight + dy);

      newWidth = Math.min(newWidth, previewArea.offsetWidth);
      newHeight = Math.min(newHeight, previewArea.offsetHeight);

      cameraContainer.style.width = newWidth + 'px';
      cameraContainer.style.height = newHeight + 'px';
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    cameraContainer.classList.remove('dragging');
  });

  // Touch events
  cameraContainer.addEventListener('touchstart', (e) => {
    if (e.target === resizeHandle || e.target.closest('#resizeHandle')) return;

    const touch = e.touches[0];
    isDragging = true;
    cameraContainer.classList.add('dragging');
    const rect = cameraContainer.getBoundingClientRect();
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;
    e.preventDefault();
  }, { passive: false });

  resizeHandle.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    isResizing = true;
    startX = touch.clientX;
    startY = touch.clientY;
    startWidth = cameraContainer.offsetWidth;
    startHeight = cameraContainer.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging && !isResizing) return;
    const touch = e.touches[0];

    if (isDragging) {
      const parentRect = previewArea.getBoundingClientRect();
      let newLeft = touch.clientX - parentRect.left - dragOffsetX;
      let newTop = touch.clientY - parentRect.top - dragOffsetY;

      newLeft = Math.max(0, Math.min(newLeft, parentRect.width - cameraContainer.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, parentRect.height - cameraContainer.offsetHeight));

      cameraContainer.style.left = newLeft + 'px';
      cameraContainer.style.top = newTop + 'px';
      cameraContainer.style.right = 'auto';
      cameraContainer.style.bottom = 'auto';
    }

    if (isResizing) {
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      cameraContainer.style.width = Math.max(80, startWidth + dx) + 'px';
      cameraContainer.style.height = Math.max(60, startHeight + dy) + 'px';
    }
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', () => {
    isDragging = false;
    isResizing = false;
    cameraContainer.classList.remove('dragging');
  });

  // ============ TIMER FUNCTIONS ============
  function startTimer() {
    timerEl.classList.add('active');
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime - pausedAccum) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      timerEl.textContent = hours > 0
        ? `${hours}:${minutes}:${seconds}`
        : `${minutes}:${seconds}`;
      if (pipWindow) {
        const pipTimerEl = pipWindow.document.getElementById('pipTimer');
        if (pipTimerEl) pipTimerEl.textContent = timerEl.textContent;
      }
    }, 200);
  }

  function stopTimer() {
    timerEl.classList.remove('active');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ============ EVENT LISTENERS ============
  startBtn.addEventListener('click', handleStartClick);
  recordFrontCamBtn.addEventListener('click', () => startCameraRecordingFallback('user'));
  recordBackCamBtn.addEventListener('click', () => startCameraRecordingFallback('environment'));
  mobileRecordCancelBtn.addEventListener('click', closeMobileRecordModal);
  mobileRecordModal.addEventListener('click', (e) => { if (e.target === mobileRecordModal) closeMobileRecordModal(); });
  stopBtn.addEventListener('click', stopRecording);
  pauseBtn.addEventListener('click', togglePause);
  cameraToggleBtn.addEventListener('click', toggleCamera);
  shapeBtn.addEventListener('click', toggleShape);
  mirrorBtn.addEventListener('click', toggleMirror);
  micToggleBtn.addEventListener('click', toggleMicrophone);
  systemAudioToggleBtn.addEventListener('click', toggleSystemAudio);
  floatControlsBtn.addEventListener('click', toggleFloatingControls);

  // ============ CLEANUP ============
  window.addEventListener('beforeunload', () => {
    if (cameraStream) stopCameraTracks();
    if (micStream) stopMicrophoneTracks();
    if (systemAudioStream) stopSystemAudioTracks();
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (combinedStream) combinedStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close().catch(() => {});
    if (timerInterval) clearInterval(timerInterval);
  });

  // ============ BROWSER SUPPORT CHECK ============
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    statusEl.textContent = "📷 Screen capture isn't available here — Start Recording will offer camera recording instead";
    const systemAudioWrapper = systemAudioToggleBtn.closest('.tooltip-wrapper');
    if (systemAudioWrapper) systemAudioWrapper.style.display = 'none';
  }

  // Floating controls only exist on desktop Chrome/Edge — hide the button
  // entirely on phones/browsers that can't support it instead of leaving
  // a dead, disabled button in the UI.
  if (!('documentPictureInPicture' in window)) {
    const floatWrapper = floatControlsBtn.closest('.tooltip-wrapper');
    if (floatWrapper) floatWrapper.style.display = 'none';
  }

  // Initialize camera transform
  updateCameraTransform();
})();