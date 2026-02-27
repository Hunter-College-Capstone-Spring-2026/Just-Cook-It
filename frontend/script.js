document.addEventListener("DOMContentLoaded", () => {
  const welcome = document.getElementById("welcome");
  const interaction = document.getElementById("interaction");

  if (!welcome) return;

  const text = welcome.textContent;

  welcome.textContent = "";

  const startDelay = 400;

  setTimeout(() => {
    text.split("").forEach((char, index) => {
      setTimeout(() => {
        const span = document.createElement("span");
        span.textContent = char === " " ? "\u00A0" : char;
        welcome.appendChild(span);
      }, index * 120);
    });

    const totalWelcomeTime = text.length * 120 + 200;

    setTimeout(() => {
      if (interaction) {
        interaction.classList.add("show");
      }
    }, totalWelcomeTime);

  }, startDelay);
});

document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("input");
  const nudge = document.getElementById("nudge");

  let nudgeTimer = setTimeout(() => {
    nudge.classList.remove("hidden");
    nudge.classList.add("show");
  }, 6000); // 6 seconds

  input.addEventListener("input", () => {
    clearTimeout(nudgeTimer);
    nudge.classList.remove("show");
    nudge.classList.add("hidden");
  });
});
