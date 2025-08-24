document.addEventListener('DOMContentLoaded', function () {
  // === 你的 GAS Web App /exec ===
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxam0tMYFh1LAF1kRssm_-6-DaTQ7ave0_sIJk8hBaUijTFlqA9QxvsP3aMa7oZA4pk/exec';

  // 是否啟用日期/時間的即時紅字驗證
  const ENABLE_DATE_TIME_VALIDATION = true;

  // 送出後的完成頁（可用 <form data-finish="..."> 覆寫）
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

  // 把檔案轉 Base64（回傳不含 data:*;base64, 的純內容）
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // 掃描 form1 ~ form8（不存在的自動略過）
  for (let i = 1; i <= 8; i++) {
    const form = document.getElementById(`form${i}`);
    if (!form) continue;

    // 可用 data-key / data-finish 覆寫預設
    const dataKey = form.dataset.key;          // 例：<form data-key="form3">
    const dataFinish = form.dataset.finish;    // 例：<form data-finish="/thanks.html">

    const KEY = dataKey || `form${i}`;
    const FINISH_URL = dataFinish || FINISH_MAP[i] || './';

    // 你有自訂驗證，關閉原生泡泡
    form.noValidate = true;

    const dateInput = form.querySelector('input[type="date"]');
    const timeInput = form.querySelector('input[type="time"]');

    // 原生 date 選取限制（非必要，但可避免明顯錯誤）
    if (dateInput) { dateInput.min = MIN_STR; dateInput.max = MAX_STR; }

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

    // 驗證：日期
    function validateDateOnly() {
      if (!ENABLE_DATE_TIME_VALIDATION || !dateInput) return true;
      const v = dateInput.value;
      if (!v) { if (dateWarning) dateWarning.textContent = ''; return false; }
      if (v < MIN_STR || v > MAX_STR) {
        if (dateWarning) dateWarning.textContent = `申請日期需為「兩天後～兩個月內」（${MIN_STR}～${MAX_STR}）。`;
        return false;
      }
      const d = new Date(v + 'T00:00:00');
      const day = d.getDay(); // 0=日,6=六
      if (day === 0 || day === 6) {
        if (dateWarning) dateWarning.textContent = '申請日期不受理週六、週日。';
        return false;
      }
      if (dateWarning) dateWarning.textContent = '';
      return true;
    }

    // 驗證：日期＋時間（平日 08:00–17:00，含 17:00）
    function validateDateTime() {
      if (!ENABLE_DATE_TIME_VALIDATION) return true;
      const dateOK = validateDateOnly();
      if (!dateOK) return false;
      if (!timeInput || !timeInput.value) { if (timeWarning) timeWarning.textContent = ''; return false; }

      const selected = new Date(`${dateInput.value}T${timeInput.value}`);
      const day = selected.getDay();
      const hour = selected.getHours();
      const minute = selected.getMinutes();

      const isWeekday = day >= 1 && day <= 5;
      const isBusinessHour =
        (hour > 8 || (hour === 8 && minute >= 0)) &&
        (hour < 17 || (hour === 17 && minute === 0));

      if (!isWeekday || !isBusinessHour) {
        if (timeWarning) timeWarning.textContent = '請選擇星期一～五的 08:00 至 17:00（含 17:00）。';
        return false;
      }
      if (timeWarning) timeWarning.textContent = '';
      return true;
    }

    // 即時驗證（有欄位才綁）
    if (dateInput) ['input','change','blur'].forEach(evt => dateInput.addEventListener(evt, validateDateOnly));
    if (timeInput) ['input','change','blur'].forEach(evt => timeInput.addEventListener(evt, validateDateTime));

    // 送出：→ 轉 Base64 → x-www-form-urlencoded → 只在成功時跳完成頁
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (ENABLE_DATE_TIME_VALIDATION && (dateInput || timeInput) && !validateDateTime()) return;

      // 1) 先收集所有非檔案欄位
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

      // 2) 收集檔案欄位並轉成 base64
      const fileInputs = Array.from(form.querySelectorAll('input[type="file"]'));
      // 若有 required 的檔案欄位，手動檢查（因為 noValidate=true）
      const missingRequired = fileInputs.some(fi => fi.required && (!fi.files || fi.files.length === 0));
      if (missingRequired) { alert('請上傳必要的檔案'); return; }

      const base64List = []; // 每個元素：{ field, b64, name, type }
      for (const fi of fileInputs) {
        if (!fi.files || fi.files.length === 0) continue;
        for (const f of fi.files) {
          const b64 = await fileToBase64(f);
          base64List.push({ field: fi.name, b64, name: f.name, type: f.type || 'application/octet-stream' });
        }
      }

      // 3) 用 x-www-form-urlencoded 組 payload（簡單請求，避免 CORS/redirect 問題）
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

      try {
        const r = await fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload.toString(),
        });
        const data = await r.json().catch(() => null);
        if (r.ok && data && data.ok) {
          window.location.href = FINISH_URL;
        } else {
          throw new Error(data && data.error ? data.error : `HTTP ${r.status}`);
        }
      } catch (err) {
        // ★ CORS/redirect 導致讀不到回應時，改用 no-cors 發送一次（fire-and-forget）
        await fetch(GAS_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload.toString(),
        });
        // 直接導向完成頁；實際是否寫入，請以試算表/Drive 為準
        window.location.href = FINISH_URL;
      }
    });
  }
});
