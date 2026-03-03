(() => {
  const appRoot = document.getElementById("app");
  if (!appRoot || !window.React || !window.ReactDOM) return;

  const { useEffect, useMemo, useState } = React;

  function HomeApp() {
    const [inputValue, setInputValue] = useState("");
    const [outputMessage, setOutputMessage] = useState("");
    const [showNudge, setShowNudge] = useState(false);
    const [visibleChars, setVisibleChars] = useState(0);
    const [showInteraction, setShowInteraction] = useState(false);

    const welcomeText = "Welcome!";
    const characters = useMemo(() => welcomeText.split(""), [welcomeText]);

    useEffect(() => {
      const startDelay = 400;
      const charDelay = 120;
      let revealTimer;

      const startTimer = setTimeout(() => {
        let count = 0;
        revealTimer = setInterval(() => {
          count += 1;
          setVisibleChars(count);

          if (count >= characters.length) {
            clearInterval(revealTimer);
            setTimeout(() => setShowInteraction(true), 200);
          }
        }, charDelay);
      }, startDelay);

      return () => {
        clearTimeout(startTimer);
        if (revealTimer) clearInterval(revealTimer);
      };
    }, [characters.length]);

    useEffect(() => {
      if (inputValue.trim()) {
        setShowNudge(false);
        return undefined;
      }

      const nudgeTimer = setTimeout(() => setShowNudge(true), 6000);
      return () => clearTimeout(nudgeTimer);
    }, [inputValue]);

    const onCook = () => {
      const ingredients = inputValue.trim();
      setOutputMessage(
        ingredients
          ? `Got it. We'll find ideas with: ${ingredients}`
          : "Add at least one ingredient to get started."
      );
    };

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "h1",
        { id: "welcome", className: "welcome-text", "aria-label": "Welcome" },
        characters.slice(0, visibleChars).map((char, index) =>
          React.createElement("span", { key: `${char}-${index}` }, char === " " ? "\u00A0" : char)
        )
      ),
      React.createElement(
        "section",
        {
          id: "interaction",
          "aria-live": "polite",
          className: showInteraction ? "show" : "",
        },
        React.createElement("h2", null, "What do you have in your kitchen?"),
        React.createElement("label", { className: "sr-only", htmlFor: "userInput" }, "Ingredients"),
        React.createElement("input", {
          type: "text",
          id: "userInput",
          placeholder: "e.g. chicken, rice, spinach",
          value: inputValue,
          onChange: (event) => setInputValue(event.target.value),
        }),
        React.createElement(
          "div",
          { id: "nudge", className: `nudge ${showNudge ? "show" : "hidden"}` },
          "Not sure where to start? Try one ingredient."
        ),
        React.createElement(
          "button",
          { id: "actionBtn", type: "button", onClick: onCook },
          "Cook it!"
        ),
        React.createElement("p", { id: "output" }, outputMessage)
      )
    );
  }

  const root = ReactDOM.createRoot(appRoot);
  root.render(React.createElement(HomeApp));
})();
