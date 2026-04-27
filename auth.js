// ============================================================
//  auth.js  —  Password Gate
//  Ganti nilai PASSWORD di bawah sesuai kebutuhan.
// ============================================================

(function () {
  const PASSWORD = "Mempawah123"; // 🔑 Ganti password di sini
  const KEY = "auth_ok_v2";

  const gate  = document.getElementById("password-gate");
  const input = document.getElementById("password-input");
  const btn   = document.getElementById("password-btn");
  const msg   = document.getElementById("password-msg");

  // Kalau sudah login di sesi ini, langsung hapus gate
  if (sessionStorage.getItem(KEY)) {
    gate.remove();
    return;
  }

  const checkPassword = () => {
    if (input.value === PASSWORD) {
      sessionStorage.setItem(KEY, "true");
      gate.style.animation = "fadeOutDown 0.5s ease forwards";
      setTimeout(() => gate.remove(), 500);
    } else {
      msg.style.display = "block";
      input.value = "";
      input.focus();
    }
  };

  btn.addEventListener("click", checkPassword);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkPassword();
  });
})();
