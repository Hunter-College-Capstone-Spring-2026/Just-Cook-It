document.addEventListener("DOMContentLoaded", () => {
  const welcome = document.getElementById("welcome");
  const interaction = document.getElementById("interaction");

  if (!welcome) return;

  const text = welcome.innerText;
  welcome.innerText = "";

  // ⏳ Delay before Welcome starts
  const startDelay = 400;

  setTimeout(() => {
    text.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.animationDelay = `${index * 0.08}s`;
      welcome.appendChild(span);
    });

    // ⏳ Show input AFTER welcome finishes
    const totalWelcomeTime = text.length * 80 + 600;

    setTimeout(() => {
      interaction.classList.add("show");
    }, totalWelcomeTime);

  }, startDelay);
});
