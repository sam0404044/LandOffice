// ================================
// script.js － 通用表單送出 + LIFF 取得 lineUserId
//   - 支援每表單自訂最早天數(data-min-days)
//   - form1~7：平日 08:00–16:00（含 16:00）
//   - form8：data-slot-policy="law" → 每月第2/第4週三 + 下拉時段(14:00/14:30/15:00/15:30)
// ================================

document.addEventListener('DOMContentLoaded', function () {
  // === GAS Web App /exec ===
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxam0tMYFh1LAF1kRssm_-6-DaTQ7ave0_sIJk8hBaUijTFlqA9QxvsP3aMa7oZA4pk/exec';

  // === LIFF ===
  const LIFF_ID = '2008032262-oybPJNJN';
  const LS_KEY = 'lineUserId';

  // === 是否啟用日期/時間即時紅字驗證 ===
  const ENABLE_DATE_TIME_VALIDATION = true;

  // === 完成頁 ===
  const FINISH_MAP = {
    1: '../finish/finish-1.html',
    2: '../finish/finish-2.html',
    3: '../finish/finish-3.html',
    4: '../finish/finish-4.html',
    5: '../finish/finish-5.html',
    6: '../finish/finish-6.html',
    7: '../finish/finish-7.html',
    8: '../finish/finish-8.html',
  };

  // ---------- 動態載入 LIFF SDK ----------
  (function loadLiffSdk() {
    if (!window.liff) {
      const s = document.createElement('script');
      s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      document.head.appendChild(s);
    }
  })();

  async function waitForLiff() {
    if (window.liff) return;
    await new Promise(resolve => {
      const t = setInterval(() => {
        if (window.liff) { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  async function initLiffIfNeeded() {
    await waitForLiff();
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href }); // 回到當前頁
      return false; // 本次流程中止，登入後會回來
    }
    return true;
  }

  // 先取 localStorage；取不到再用 LIFF 補抓
  async function ensureUserId() {
    let uid = localStorage.getItem(LS_KEY);
    if (uid) return uid;

    const ok = await initLiffIfNeeded();
    if (!ok) return null;

    try {
      const profile = await liff.getProfile();
      uid = profile.userId || '';
      if (uid) localStorage.setItem(LS_KEY, uid);
      return uid;
    } catch (err) {
      console.error('getProfile 失敗：', err);
      return null;
    }
  }

  // ---------- 工具 ----------
  function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ---------- 日期/時間驗證（每表單可自訂 minDays；form8 有雙週三規則） ----------
  function makeValidators(form) {
    const dateInput = form.querySelector('input[type="date"]');
    // form8 用 <select name="time">；其它表單可能用 <input type="time">
    const timeInput = form.querySelector('select[name="time"], input[type="time"]');

    const isLaw = form.dataset.slotPolicy === 'law'; // form8 才會啟用
    const minDays = Number(form.dataset.minDays || 2); // 預設 2 天後可預約（form6 可設 3）

    // 動態 min/max（minDays 天後 ～ 兩個月內）
    const now = new Date();
    const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + minDays);
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
    const MIN_STR = toYMD(minDate);
    const MAX_STR = toYMD(maxDate);

    if (dateInput) { dateInput.min = MIN_STR; dateInput.max = MAX_STR; }

    // 一般表單把 time input 的原生上限限制為 16:00（法律諮詢不需要）
    if (!isLaw && timeInput && timeInput.tagName === 'INPUT' && timeInput.type === 'time') {
      timeInput.max = '16:00';
    }

    // 紅字提示區
    let dateWarning = form.querySelector('.date-warning');
    if (!dateWarning && dateInput) {
      dateWarning = document.createElement('div');
      dateWarning.className = 'date-warning';
      dateWarning.style.color = 'red';
      dateWarning.style.fontSize = '0.9rem';
      dateInput.insertAdjacentElement('afterend', dateWarning);
    }
    let timeWarning = form.querySelector('.time-warning');
    if (!timeWarning && timeInput) {
      timeWarning = document.createElement('div');
      timeWarning.className = 'time-warning';
      timeWarning.style.color = 'red';
      timeWarning.style.fontSize = '0.9rem';
      timeInput.insertAdjacentElement('afterend', timeWarning);
    }

    // form8（法律諮詢）：判斷是否為當月第 2 / 第 4 個星期三
    function isSecondOrFourthWednesday(d) {
      if (d.getDay() !== 3) return false; // 3 = 星期三
      const year = d.getFullYear();
      const month = d.getMonth();
      let count = 0;
      for (let day = 1; day <= 31; day++) {
        const dt = new Date(year, month, day);
        if (dt.getMonth() !== month) break;
        if (dt.getDay() === 3) {
          count++;
          if (dt.getDate() === d.getDate()) {
            return (count === 2 || count === 4);
          }
        }
      }
      return false;
    }

    function validateDateOnly() {
      if (!ENABLE_DATE_TIME_VALIDATION || !dateInput) return true;
      const v = dateInput.value;
      if (!v) { if (dateWarning) dateWarning.textContent = ''; return false; }

      // 先檢查「minDays ~ 兩個月內」
      if (v < MIN_STR || v > MAX_STR) {
        if (dateWarning) dateWarning.textContent = `申請日期需為「${minDays}天後～兩個月內」（${MIN_STR}～${MAX_STR}）。`;
        return false;
      }

      const d = new Date(v + 'T00:00:00');
      const day = d.getDay(); // 0=日,6=六
      if (day === 0 || day === 6) {
        if (dateWarning) dateWarning.textContent = '申請日期不受理週六、週日。';
        return false;
      }

      // 法律諮詢：每月第 2 / 第 4 個星期三
      if (isLaw && !isSecondOrFourthWednesday(d)) {
        if (dateWarning) dateWarning.textContent = '僅開放每月第 2 與第 4 個星期三可預約。';
        return false;
      }

      if (dateWarning) dateWarning.textContent = '';
      return true;
    }

    function validateDateTime() {
      if (!ENABLE_DATE_TIME_VALIDATION) return true;
      const dateOK = validateDateOnly();
      if (!dateOK) return false;

      if (!timeInput || !timeInput.value) {
        if (timeWarning) timeWarning.textContent = '';
        return false;
      }

      // form8：時間用下拉（14:00/14:30/15:00/15:30），不做 08–16 的檢查
      if (isLaw) {
        if (timeWarning) timeWarning.textContent = '';
        return true;
      }

      // 其它表單：平日 08:00–16:00（含 16:00）
      const selected = new Date(`${dateInput.value}T${timeInput.value}`);
      const wday = selected.getDay();
      const hour = selected.getHours();
      const minute = selected.getMinutes();

      const isWeekday = wday >= 1 && wday <= 5;
      const isBusinessHour =
        (hour > 8 || (hour === 8 && minute >= 0)) &&
        (hour < 16 || (hour === 16 && minute === 0));

      if (!isWeekday || !isBusinessHour) {
        if (timeWarning) timeWarning.textContent = '請選擇星期一～五的 08:00 至 16:00（含 16:00）。';
        return false;
      }
      if (timeWarning) timeWarning.textContent = '';
      return true;
    }

    if (dateInput) ['input','change','blur'].forEach(evt => dateInput.addEventListener(evt, validateDateOnly));
    if (timeInput) ['input','change','blur'].forEach(evt => timeInput.addEventListener(evt, validateDateTime));

    return { validateDateTime, dateInput, timeInput };
  }

  // ---------- 掃描 form1 ~ form8 ----------
  for (let i = 1; i <= 8; i++) {
    const form = document.getElementById(`form${i}`);
    if (!form) continue;

    const dataKey = form.dataset.key;
    const dataFinish = form.dataset.finish;
    const KEY = dataKey || `form${i}`;
    const FINISH_URL = dataFinish || FINISH_MAP[i] || './';

    form.noValidate = true;

    const { validateDateTime, dateInput, timeInput } = makeValidators(form);

    // 送出
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (ENABLE_DATE_TIME_VALIDATION && (dateInput || timeInput)) {
        if (typeof validateDateTime === 'function' && !validateDateTime()) return;
      }

      // 狀態顯示
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      let statusEl = form.querySelector('.submit-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'submit-status';
        statusEl.setAttribute('aria-live','polite');
        statusEl.style.marginTop = '8px';
        statusEl.style.color = '#444';
        statusEl.style.fontSize = '.95rem';
        if (submitBtn && submitBtn.parentNode) {
          submitBtn.insertAdjacentElement('afterend', statusEl);
        } else {
          form.appendChild(statusEl);
        }
      }
      if (submitBtn) submitBtn.disabled = true;
      let dots = 0;
      statusEl.textContent = '資料送出中';
      const anim = setInterval(() => {
        dots = (dots + 1) % 4;
        statusEl.textContent = '資料送出中' + '.'.repeat(dots);
      }, 320);

      // 先保證拿到 userId（localStorage 或 LIFF）
      const lineUserId = await ensureUserId();
      if (!lineUserId) {
        clearInterval(anim);
        statusEl.textContent = '正在登入 LINE，請稍候…';
        if (submitBtn) submitBtn.disabled = false;
        return; // 登入後回本頁再送
      }

      // 收集非檔案欄位
      const fields = {};
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name || el.disabled || el.type === 'file') return;
        if (el.type === 'radio') {
          if (el.checked) fields[el.name] = el.value;
        } else if (el.type === 'checkbox') {
          if (!fields[el.name]) fields[el.name] = [];
          if (el.checked) fields[el.name].push(el.value);
        } else {
          fields[el.name] = el.value;
        }
      });

      // 檔案轉 Base64
      const fileInputs = Array.from(form.querySelectorAll('input[type="file"]'));
      const base64List = [];
      for (const fi of fileInputs) {
        if (!fi.files || fi.files.length === 0) continue;
        for (const f of fi.files) {
          const b64 = await fileToBase64(f);
          base64List.push({ field: fi.name, b64, name: f.name, type: f.type || 'application/octet-stream' });
        }
      }

      // 組 payload
      const payload = new URLSearchParams();
      payload.set('key', KEY);
      Object.entries(fields).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach(x => payload.append(k, x));
        else payload.append(k, v ?? '');
      });
      base64List.forEach(({ field, b64, name, type }) => {
        payload.append(field, b64);
        payload.append(field + '_name', name);
        payload.append(field + '_type', type);
      });

      // 必帶：LINE userId
      payload.set('lineUserId', lineUserId);

      // 帶預約日期與時間（給後端推播使用；不一定入表）
      if (fields.date) payload.set('reserveDate', fields.date);
      if (fields.time) payload.set('reserveTime', fields.time);

      // 送出
      try {
        const r = await fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload.toString(),
        });
        const data = await r.json().catch(() => null);
        if (r.ok && data && data.ok) {
          clearInterval(anim);
          statusEl.textContent = '送出成功，正在導向完成頁…';
          window.location.href = FINISH_URL;
        } else {
          throw new Error(data && data.error ? data.error : `HTTP ${r.status}`);
        }
      } catch (err) {
        // 後備：fire-and-forget
        await fetch(GAS_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload.toString(),
        });
        clearInterval(anim);
        statusEl.textContent = '已送出，正在導向完成頁…';
        window.location.href = FINISH_URL;
      }
    });
  }
});
