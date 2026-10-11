document.addEventListener("DOMContentLoaded", () => {
  const yearNode = document.getElementById("year");
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear();
  }

  const usernameCookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("username="));

  if (usernameCookie) {
    const username = decodeURIComponent(usernameCookie.split("=")[1]);
    const heroPanel = document.querySelector(".hero-panel");
    if (heroPanel && !heroPanel.querySelector(".welcome-tag")) {
      const badge = document.createElement("div");
      badge.className = "status-pill welcome-tag";
      badge.textContent = `Welcome back, ${username}`;
      heroPanel.prepend(badge);
    }
  }
});
