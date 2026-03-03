document.addEventListener("DOMContentLoaded", () => {
  const welcome = document.getElementById("welcome");
  const interaction = document.getElementById("interaction");
  const input = document.getElementById("userInput");
  const nudge = document.getElementById("nudge");
  const actionBtn = document.getElementById("actionBtn");
  const output = document.getElementById("output");

  if (welcome) {
    const text = welcome.textContent ?? "";
    welcome.textContent = "";

    const startDelay = 400;
    const charDelay = 120;

    setTimeout(() => {
      text.split("").forEach((char, index) => {
        setTimeout(() => {
          const span = document.createElement("span");
          span.textContent = char === " " ? "\u00A0" : char;
          welcome.appendChild(span);
        }, index * charDelay);
      });

      const totalWelcomeTime = text.length * charDelay + 200;

      setTimeout(() => {
        interaction?.classList.add("show");
      }, totalWelcomeTime);
    }, startDelay);
  } else {
    interaction?.classList.add("show");
  }

  if (input && nudge) {
    const nudgeTimer = setTimeout(() => {
      nudge.classList.remove("hidden");
      nudge.classList.add("show");
    }, 6000);

    input.addEventListener("input", () => {
      clearTimeout(nudgeTimer);
      nudge.classList.remove("show");
      nudge.classList.add("hidden");
    });
  }

  if (actionBtn && input && output) {
    actionBtn.addEventListener("click", () => {
      const ingredients = input.value.trim();
      output.textContent = ingredients
        ? `Got it. We'll find ideas with: ${ingredients}`
        : "Add at least one ingredient to get started.";
    });
  }
});
