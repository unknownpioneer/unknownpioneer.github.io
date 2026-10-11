document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const message = document.querySelector(".status-pill");

  if (window.matchMedia("(max-width: 760px)").matches && message) {
    message.textContent = "Site status: Mobile-friendly";
  }

  const usernameCookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("username="));

  if (usernameCookie && body.dataset.greeting !== "enabled") {
    const username = decodeURIComponent(usernameCookie.split("=")[1]);
    const welcome = document.createElement("div");
    welcome.className = "status-pill";
    welcome.textContent = `Welcome back, ${username}`;
    const heroPanel = document.querySelector(".hero-panel");
    if (heroPanel) {
      heroPanel.prepend(welcome);
    }
  }
});
