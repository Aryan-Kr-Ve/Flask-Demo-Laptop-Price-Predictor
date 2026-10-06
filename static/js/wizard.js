(function () {
  const form = document.getElementById("specForm");
  if (!form) return;

  const steps = Array.from(document.querySelectorAll(".wizard-step"));
  const dots = Array.from(document.querySelectorAll(".step-dot"));
  const btnBack = document.getElementById("btnBack");
  const btnNext = document.getElementById("btnNext");
  const screenSizeInput = document.getElementById("screenSizeInput");
  const screenSizeOut = document.getElementById("screenSizeOut");
  const resultPrice = document.getElementById("resultPrice");
  const resultNote = document.getElementById("resultNote");

  const TOTAL_STEPS = steps.length;
  let current = 1;
  let furthestVisited = 1;

  const LABELS = {
    ram: (v) => `${v} GB`,
    hdd: (v) => (Number(v) === 0 ? "None" : `${v} GB`),
    ssd: (v) => (Number(v) === 0 ? "None" : `${v} GB`),
    weight: (v) => `${v} kg`,
    screenSize: (v) => `${v}\u2033`,
    touchscreen: (checked) => (checked ? "Yes" : "No"),
    ips: (checked) => (checked ? "Yes" : "No"),
  };

  function goToStep(n) {
    current = Math.min(Math.max(n, 1), TOTAL_STEPS);
    steps.forEach((s) => s.classList.toggle("is-active", Number(s.dataset.step) === current));
    dots.forEach((d) => {
      const n2 = Number(d.dataset.step);
      d.classList.toggle("is-active", n2 === current);
      d.classList.toggle("is-done", n2 < current || (n2 <= furthestVisited && n2 !== current));
      d.disabled = n2 > furthestVisited;
    });
    btnBack.disabled = current === 1;
    btnNext.textContent = current === TOTAL_STEPS ? "Calculate price" : "Next";
    steps[current - 1].querySelector("select, input")?.focus({ preventScroll: true });
    window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  }

  function currentStepValid() {
    const el = steps[current - 1];
    const fields = el.querySelectorAll("select, input[type=number]");
    for (const f of fields) {
      if (!f.reportValidity()) return false;
    }
    return true;
  }

  function updateSpecSheet() {
    const data = new FormData(form);
    document.querySelectorAll("#specSheet dd").forEach((dd) => {
      const field = dd.dataset.field;
      let value;
      if (field === "touchscreen" || field === "ips") {
        value = LABELS[field](form.querySelector(`[name=${field}]`).checked);
      } else {
        const raw = data.get(field);
        value = raw === null || raw === "" ? null : (LABELS[field] ? LABELS[field](raw) : raw);
      }
      dd.textContent = value ?? "\u2014";
      dd.classList.toggle("is-set", value !== null && value !== "\u2014");
    });
  }

  screenSizeInput?.addEventListener("input", () => {
    screenSizeOut.textContent = screenSizeInput.value;
    updateSpecSheet();
  });

  form.addEventListener("input", updateSpecSheet);
  form.addEventListener("change", updateSpecSheet);

  dots.forEach((d) => {
    d.addEventListener("click", () => {
      const target = Number(d.dataset.step);
      if (target <= furthestVisited) goToStep(target);
    });
  });

  btnBack.addEventListener("click", () => goToStep(current - 1));

  btnNext.addEventListener("click", async () => {
    if (!currentStepValid()) return;

    if (current < TOTAL_STEPS) {
      furthestVisited = Math.max(furthestVisited, current + 1);
      goToStep(current + 1);
      return;
    }

    await runPrediction();
  });

  function animatePrice(target) {
    const duration = 500;
    const start = performance.now();
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      resultPrice.textContent = "\u20b9" + value.toLocaleString("en-IN");
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  async function runPrediction() {
    const data = new FormData(form);
    const payload = {
      company: data.get("company"),
      typeName: data.get("typeName"),
      os: data.get("os"),
      cpu: data.get("cpu"),
      gpu: data.get("gpu"),
      ram: data.get("ram"),
      hdd: data.get("hdd"),
      ssd: data.get("ssd"),
      weight: data.get("weight"),
      touchscreen: form.querySelector("[name=touchscreen]").checked,
      ips: form.querySelector("[name=ips]").checked,
      screenSize: data.get("screenSize"),
      resolution: data.get("resolution"),
    };

    btnNext.disabled = true;
    btnNext.textContent = "Calculating\u2026";
    resultNote.textContent = "Running the ensemble\u2026";
    resultNote.classList.remove("is-error");
    resultPrice.style.opacity = "0.4";

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error || "Prediction failed.");

      resultPrice.style.opacity = "1";
      animatePrice(body.price);
      resultNote.textContent = `Calculated at ${body.ppi} PPI`;
    } catch (err) {
      resultPrice.style.opacity = "1";
      resultPrice.textContent = "\u2014";
      resultNote.textContent = err.message || "Something went wrong. Try again.";
      resultNote.classList.add("is-error");
    } finally {
      btnNext.disabled = false;
      btnNext.textContent = "Calculate price";
    }
  }

  updateSpecSheet();
  goToStep(1);
})();
