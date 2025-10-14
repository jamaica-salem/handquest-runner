(() => {
  // CONFIG
  const backendUrl = 'http://localhost:8000/generate'; // Remove ?n=10, send as form data
  const tryBackend = true; // set false to only simulate local storage
  const MAX_INLINE_STORE_BYTES = 2 * 1024 * 1024; // 2MB threshold

  // DOM
  const dropArea = document.getElementById('dropArea');
  const dropText = document.getElementById('dropText');
  const loadingEl = document.getElementById('loading');
  const statusMessage = document.getElementById('statusMessage');
  const playBtn = document.getElementById('playBtn');

  let selectedFile = null;

  // Utility: show/hide helpers
  function showLoading(show) { loadingEl.classList.toggle('hidden', !show); }
  function setStatus(msg, isError = false) {
    statusMessage.textContent = msg || '';
    statusMessage.style.color = isError ? '#ff6666' : '#66ff66';
    console.log(msg);
  }

  // Prevent default for drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
    document.addEventListener(evt, e => e.preventDefault(), false)
  );

  // Highlight drop area
  ['dragenter', 'dragover'].forEach(evt => {
    dropArea.addEventListener(evt, (e) => {
      dropArea.classList.add('highlight');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropArea.addEventListener(evt, (e) => {
      dropArea.classList.remove('highlight');
    });
  });

  // Handle drop
  dropArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  });

  // Click opens file dialog
  dropArea.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (ev) => {
      const file = ev.target.files && ev.target.files[0];
      handleFile(file);
    };
    input.click();
  });

  // keyboard accessibility (Enter or Space)
  dropArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropArea.click();
    }
  });

  async function handleFile(file) {
    if (!file) {
      console.warn('No file received.');
      return;
    }

    // Basic validation
    const name = file.name || 'file';
    const isPdfMime = file.type === 'application/pdf';
    const hasPdfExt = name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !hasPdfExt) {
      setStatus('❌ Please provide a PDF file (.pdf).', true);
      console.warn('Rejected non-PDF file:', file.type, name);
      return;
    }

    selectedFile = file;
    dropText.innerHTML = `📄 Selected: <strong>${name}</strong>`;

    // Start uploading / saving
    setStatus('');
    showLoading(true);
    playBtn.disabled = true;
    playBtn.classList.remove('ready');

    try {
      if (tryBackend) {
        console.log('🚀 Attempting to upload to backend...');
        
        // Try uploading to backend
        const form = new FormData();
        form.append('file', file, file.name);

        const resp = await fetch(`${backendUrl}?n=10`, { 
          method: 'POST', 
          body: form 
        });
        
        console.log('📡 Response status:', resp.status);
        
        const text = await resp.text();
        console.log('📄 Response body:', text);
        
        let json = null;
        try { 
          json = JSON.parse(text); 
        } catch(e) { 
          console.error('Failed to parse JSON:', e);
          json = null; 
        }

        if (!resp.ok) {
          console.error('❌ Server error:', resp.status, text);
          // fallback to local store
          await fallbackLocalStore(file, `Server returned ${resp.status}. Saved locally.`);
        } else {
          // Success: server returned something
          if (json && json.questions) {
            localStorage.setItem('handquest_questions', JSON.stringify(json.questions));
            localStorage.setItem('uploaded_pdf_name', file.name);
            setStatus(`✅ Success! Generated ${json.questions.length} questions from your PDF.`);
            console.log('✅ Saved questions to localStorage:', json.questions);
            playBtn.disabled = false;
            playBtn.classList.add('ready');
          } else {
            // Server returned ok but not the expected JSON
            console.warn('⚠️ Unexpected server response:', text);
            await fallbackLocalStore(file, 'Server responded but no questions generated. Saved locally.');
          }
        }
      } else {
        // No backend: simulate and store locally
        console.log('💾 Backend disabled, saving locally...');
        await fallbackLocalStore(file, 'Saved locally (backend disabled).');
        playBtn.disabled = false;
        playBtn.classList.add('ready');
      }
    } catch (err) {
      console.error('❌ Upload failed:', err);
      console.error('Error details:', err.message);
      
      // Check if it's a network error
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        setStatus('❌ Cannot connect to AI server. Make sure backend is running on http://localhost:8000', true);
      } else {
        setStatus('❌ Upload error: ' + err.message, true);
      }
      
      await fallbackLocalStore(file, 'Upload failed; saved locally (AI backend offline).');
      playBtn.disabled = false;
      playBtn.classList.add('ready');
    } finally {
      showLoading(false);
    }
  }

  // fallbackLocalStore: tries to store a small base64 copy if file size is small,
  // otherwise just stores metadata (name, size, timestamp)
  async function fallbackLocalStore(file, userMsg) {
    const meta = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      savedAt: Date.now()
    };
    try {
      if (file.size <= MAX_INLINE_STORE_BYTES) {
        const dataUrl = await readFileAsDataURL(file);
        localStorage.setItem('uploaded_pdf_data', dataUrl);
        localStorage.setItem('uploaded_pdf_meta', JSON.stringify(meta));
        setStatus(userMsg + ' (stored inline)');
        console.log('💾 Stored inline base64 in localStorage. Meta:', meta);
      } else {
        // too big to store inline; store metadata only
        localStorage.setItem('uploaded_pdf_meta', JSON.stringify(meta));
        setStatus(userMsg + ' (metadata only, file too large)', true);
        console.log('⚠️ File too large to inline. Stored metadata only:', meta);
      }
      localStorage.setItem('uploaded_pdf_name', file.name);
    } catch (err) {
      console.error('❌ Local storage failed:', err);
      setStatus('Failed to store file locally: ' + err.message, true);
    }
  }

  // helper: File -> Data URL (base64)
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  // Start Game button
  playBtn.addEventListener('click', () => {
    const name = localStorage.getItem('uploaded_pdf_name') || '(none)';
    console.log('🎮 Start Game pressed. uploaded_pdf_name =', name);
    
    // Ensure something saved before navigating
    const questions = localStorage.getItem('handquest_questions');
    if (!questions) {
      alert('❌ No questions found! Please upload a PDF and wait for processing.');
      return;
    }
    
    const parsedQuestions = JSON.parse(questions);
    console.log('✅ Found', parsedQuestions.length, 'questions');
    
    // go to game page
    window.location.href = 'game.html';
  });

  // Safety: expose a debug function for console
  window._uploadDebug = {
    uploaded_pdf_name: () => localStorage.getItem('uploaded_pdf_name'),
    uploaded_meta: () => JSON.parse(localStorage.getItem('uploaded_pdf_meta') || 'null'),
    uploaded_data: () => localStorage.getItem('uploaded_pdf_data') ? 'Present (not showing, too large)' : 'None',
    questions: () => JSON.parse(localStorage.getItem('handquest_questions') || 'null'),
    clear: () => {
      localStorage.clear();
      console.log('✅ localStorage cleared');
    }
  };

  console.log('📝 Debug helper available: window._uploadDebug');
  console.log('   - _uploadDebug.questions() - view questions');
  console.log('   - _uploadDebug.uploaded_meta() - view file metadata');
  console.log('   - _uploadDebug.clear() - clear all data');

})();