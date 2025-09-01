document.addEventListener('DOMContentLoaded', function () {
  // === 你的 GAS Web App /exec ===
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxam0tMYFh1LAF1kRssm_-6-DaTQ7ave0_sIJk8hBaUijTFlqA9QxvsP3aMa7oZA4pk/exec';

  // === 你的 LIFF ID ===
  const LIFF_ID = '2008032262-oybPJNJN';


  // 是否啟用日期/時間的即時紅字驗證
  const ENABLE_DATE_TIME_VALIDATION = true;

  // 完成頁
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

  // 初始化 LIFF
  async function initLiff() {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  }
  initLiff();

  // 工具：yyyy-mm-dd
  function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 驗證用：兩天後～兩個月內
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
  const MIN_STR = toYMD(minDate);
  const MAX_STR = toYMD(maxDate);

  // 把檔案轉 Base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // 掃描 form1 ~ form8
  for (let i = 1; i <= 8; i++) {
    const form = document.getElementById(`form${i}`);
    if (!form) continue;

    const dataKey = form.dataset.key;
    const dataFinish = form.dataset.finish;
    const KEY = dataKey || `form${i}`;
    const FINISH_URL = dataFinish || FINISH_MAP[i] || './';

    form.noValidate = true;

    const dateInput = form.querySelector('input[type="date"]');
    const timeInput = form.querySelector('input[type="time"]');

    if (dateInput) { dateInput.min = MIN_STR; dateInput.max = MAX_STR; }

    // 驗證函式（略，跟你原來相同，這裡省略重複程式碼）
    // ...

    // 送出
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // === 新增：取得 LINE userId ===
      let lineUserId = '';
      try {
        const profile = await liff.getProfile();
        lineUserId = profile.userId;
      } catch (err) {
        console.error('無法取得 LINE userId:', err);
      }

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

      // 收集欄位
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
      if (lineUserId) payload.set('lineUserId', lineUserId); // ★ 把 userId 一起送給 GAS

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
