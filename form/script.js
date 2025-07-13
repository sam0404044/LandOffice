document.addEventListener('DOMContentLoaded', function () {
  for (let i = 1; i <= 8; i++) {
    const form = document.getElementById(`form${i}`);
    if (!form) continue;

    const dateInput = form.querySelector('input[type="date"]');
    const timeInput = form.querySelector('input[type="time"]');

    // 動態建立錯誤提示區
    let warningBox = form.querySelector('.time-warning');
    if (!warningBox) {
      warningBox = document.createElement('div');
      warningBox.className = 'time-warning';
      warningBox.style.color = 'red';
      warningBox.style.fontSize = '0.9rem';
      timeInput.insertAdjacentElement('afterend', warningBox);
    }

    // 驗證函式
    function validateDateTime() {
      if (!dateInput.value || !timeInput.value) {
        warningBox.textContent = '';
        return false;
      }

      const selectedDateTime = new Date(`${dateInput.value}T${timeInput.value}`);
      const day = selectedDateTime.getDay(); // 0 = Sunday
      const hour = selectedDateTime.getHours();
      const minute = selectedDateTime.getMinutes();

      const isWeekday = day >= 1 && day <= 5;
      const isBusinessHour = (hour > 8 || (hour === 8 && minute >= 0)) &&
                             (hour < 17 || (hour === 17 && minute === 0));

      if (!isWeekday || !isBusinessHour) {
        warningBox.textContent = '請選擇星期一～五的 08:00 至 17:00 之間時間';
        return false;
      } else {
        warningBox.textContent = '';
        return true;
      }
    }

    // 即時驗證綁定
    dateInput.addEventListener('input', validateDateTime);
    timeInput.addEventListener('input', validateDateTime);

    // 表單提交驗證
    form.addEventListener('submit', function (e) {
      if (!validateDateTime()) {
        e.preventDefault();
        return;
      }

      e.preventDefault(); // 若驗證通過，跳轉
      window.location.href = `../finish/finish-${i}.html`;
    });
  }
});
