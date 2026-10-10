// Apply the preference before React and the page content load.
(() => {
  let preference;
  try {
    preference = localStorage.getItem("biblioteca-theme-v1");
  } catch {
    // Private browsing may deny storage access.
  }
  const theme =
    preference === "light" || preference === "dark"
      ? preference
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
