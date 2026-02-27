document.addEventListener("DOMContentLoaded", () => {
  const welcome = document.getElementById("welcome");
  if (!welcome) return;

  const text = welcome.innerText;
  welcome.innerText = "";

  text.split("").forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = char === " " ? "\u00A0" : char;
    span.style.animationDelay = `${index * 0.08}s`;
    welcome.appendChild(span);
  });
});
