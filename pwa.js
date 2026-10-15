(function () {
  'use strict';
  var installButton = document.getElementById('installApp');
  var offlineStatus = document.getElementById('offlineStatus');
  var updateStatus = document.getElementById('updateStatus');
  var installPrompt = null, registration = null, reloadRequested = false;
  var readyToReload = false, activationSnapshot = null, activationTimer = null, inputRevision = 0;
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function setOffline(text) { if (offlineStatus) offlineStatus.textContent = text; }
  function updateConnectivity() {
    if (!navigator.onLine) setOffline(navigator.serviceWorker && navigator.serviceWorker.controller ? '오프라인 · 설정과 코드 생성 가능' : '오프라인 · 먼저 온라인에서 열어 주세요');
    else setOffline(navigator.serviceWorker && navigator.serviceWorker.controller ? '오프라인 사용 준비됨' : '설정은 기기 안에서 처리');
  }
  // Protect edits made while a new worker is activating, including calculator
  // changes outside the settings form. The app revision also catches delayed
  // imports and other changes applied without a native input/change event.
  document.addEventListener('input', function () { inputRevision++; }, true);
  document.addEventListener('change', function () { inputRevision++; }, true);
  function currentRevision() {
    return window.app && typeof window.app.getRevision === 'function' ? window.app.getRevision() : null;
  }
  function stopActivationWait() {
    if (activationTimer) window.clearTimeout(activationTimer);
    activationTimer = null;
  }
  function reloadApp() {
    stopActivationWait();
    reloadRequested = false;
    if (window.app && typeof window.app.allowNavigation === 'function') window.app.allowNavigation();
    window.location.reload();
  }
  function showUpdate(message) {
    if (!updateStatus || !registration || (!message && !registration.waiting && !readyToReload)) return;
    updateStatus.replaceChildren(); updateStatus.hidden = false;
    var text = document.createElement('span');
    text.textContent = message || '새 버전이 준비됐어요. 적용 전에 필요한 설정·코드를 저장해 주세요. ';
    var button = document.createElement('button'); button.type = 'button'; button.id = 'applyUpdate';
    button.textContent = readyToReload ? '저장 후 새 버전 다시 열기' : '저장 후 새 버전 열기';
    button.addEventListener('click', function () {
      if (!window.confirm('저장하지 않은 설정과 입력한 API 키는 새로고침하면 사라집니다. 필요한 설정·코드를 저장하셨나요? 새 버전을 열까요?')) return;
      if (readyToReload && !registration.waiting) { reloadApp(); return; }
      if (!registration.waiting) { updateStatus.textContent = '업데이트 상태를 확인하지 못했어요. 현재 작업을 저장하고 앱을 다시 열어 주세요.'; return; }
      activationSnapshot = { appRevision: currentRevision(), inputRevision: inputRevision };
      reloadRequested = true; button.disabled = true; button.textContent = '새 버전을 여는 중…';
      stopActivationWait();
      activationTimer = window.setTimeout(function () {
        activationTimer = null;
        reloadRequested = false;
        showUpdate('새 버전을 여는 데 시간이 걸려 현재 화면을 유지했어요. 작업을 저장한 뒤 다시 시도해 주세요. ');
      }, 15000);
      try { registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); }
      catch (_) {
        stopActivationWait(); reloadRequested = false;
        showUpdate('업데이트 요청을 보내지 못해 현재 화면을 유지했어요. 작업을 저장한 뒤 다시 시도해 주세요. ');
      }
    });
    updateStatus.append(text, button);
  }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); installPrompt = event;
    if (installButton && !standalone) { installButton.hidden = false; installButton.textContent = '앱으로 추가'; }
  });
  window.addEventListener('appinstalled', function () { installPrompt = null; standalone = true; if (installButton) installButton.hidden = true; });
  if (installButton) installButton.addEventListener('click', async function () {
    if (installPrompt) {
      var prompt = installPrompt; installPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; } catch (_) {}
      installButton.hidden = true;
    } else {
      var help = document.getElementById('installHelp');
      if (help) { help.hidden = false; if (help.tagName === 'DETAILS') help.open = true; help.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  });
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !standalone && installButton && location.protocol === 'https:') { installButton.hidden = false; installButton.textContent = '홈 화면 추가 방법'; }
  window.addEventListener('online', function () { updateConnectivity(); if (registration) registration.update().catch(function () {}); });
  window.addEventListener('offline', updateConnectivity);
  updateConnectivity();
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    setOffline(location.protocol === 'file:' ? '파일로 실행 중 · 홈 화면 추가는 HTTPS 주소에서' : '브라우저에서 사용 중 · 홈 화면 추가 미지원'); return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    updateConnectivity();
    var replacedExisting = hadController;
    hadController = true;
    if (reloadRequested) {
      stopActivationWait(); reloadRequested = false; readyToReload = true;
      if (activationSnapshot && (activationSnapshot.appRevision !== currentRevision() || activationSnapshot.inputRevision !== inputRevision)) {
        showUpdate('업데이트 승인 뒤 입력이 바뀌어 자동으로 새로고침하지 않았어요. 현재 설정·코드는 유지됩니다. 필요한 내용을 저장한 뒤 새 버전을 다시 열어 주세요. ');
        return;
      }
      reloadApp();
    } else if (replacedExisting) {
      readyToReload = true;
      showUpdate('새 버전이 준비됐어요. 현재 화면의 작업은 유지했습니다. 필요한 설정·코드를 저장한 뒤 새 버전을 열어 주세요. ');
    }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(function (value) {
    registration = value;
    if (registration.waiting) showUpdate();
    registration.addEventListener('updatefound', function () {
      var worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        else if (worker.state === 'installed') setOffline('오프라인 사용 준비됨');
      });
    });
    navigator.serviceWorker.ready.then(updateConnectivity);
  }).catch(function () { setOffline('웹으로 사용 가능 · 오프라인 준비는 다음 접속에 재시도'); });
}());
