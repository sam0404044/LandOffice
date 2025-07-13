document.addEventListener('DOMContentLoaded', function () {
  for (let i = 1; i <= 8; i++) {
    const form = document.getElementById(`form${i}`);
    if (form) {
      form.addEventListener('submit', function (e) {
        // 取得時間輸入值
        const dateInput = form.querySelector('input[type="date"]');
        const timeInput = form.querySelector('input[type="time"]');

        // 若有任一欄位未填，先交由瀏覽器原生驗證處理
        if (!dateInput.value || !timeInput.value) return;

        const selectedDateTime = new Date(`${dateInput.value}T${timeInput.value}`);
        const day = selectedDateTime.getDay(); // 0=Sun, 1=Mon,...
        const hour = selectedDateTime.getHours();
        const minute = selectedDateTime.getMinutes();

        const isWeekday = day >= 1 && day <= 5;
        const isBusinessHour = (hour > 8 || (hour === 8 && minute >= 0)) &&
                               (hour < 17 || (hour === 17 && minute === 0));

        if (!isWeekday || !isBusinessHour) {
          e.preventDefault();
          alert("請選擇星期一～五的 08:00 至 17:00 之間時間");
          return;
        }

        // 驗證通過後跳轉
        e.preventDefault();
        window.location.href = `../finish/finish-${i}.html`;
      });
    }
  }
});
