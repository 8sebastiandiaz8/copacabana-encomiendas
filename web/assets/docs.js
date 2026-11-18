// YouTube rechaza algunos embeds cuando el origen es una IP literal: pasamos a localhost.
(function () {
  const host = location.hostname;
  if (host !== "127.0.0.1" && host !== "0.0.0.0" && host !== "[::1]") return;
  const go = () => {
    if (!document.querySelector('iframe[src*="youtube.com/embed"]')) return;
    location.replace("http://localhost" + (location.port ? ":" + location.port : "") + location.pathname + location.search + location.hash);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
})();

const studyMenu = document.querySelector("[data-study-menu]");

if (studyMenu) {
  const cards = Array.from(studyMenu.querySelectorAll(".rail-card[data-menu]"));
  const rail = studyMenu.querySelector("[data-rail-track]");
  const mega = studyMenu.querySelector("[data-mega]");
  const preview = studyMenu.querySelector("[data-preview]");
  const previewImage = preview.querySelector("img");
  const previewSheet = preview.querySelector(".pv-sheet");
  const previewTitle = preview.querySelector(".pv-title");
  const previewText = preview.querySelector(".pv-text");
  const panels = new Map(
    cards.map((card) => [card.dataset.menu, studyMenu.querySelector(`#mega-${card.dataset.menu}`)]),
  );
  const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pageKey = document.body.dataset.page || "";
  const pageCard = cards.find((card) => card.dataset.menu === pageKey) || null;
  const homeLink = studyMenu.querySelector("[data-home]");
  let closeTimer;

  /* ---------- estado de la página actual ---------- */

  function markPage() {
    pageCard?.classList.add("is-active");
    if (pageKey === "inicio") homeLink?.classList.add("is-active");
  }

  markPage();

  /* ---------- etiqueta de tipo en cada chip ---------- */

  studyMenu.querySelectorAll(".chip").forEach((chip) => {
    if (chip.hasAttribute("data-video")) return;
    const tag = document.createElement("i");
    tag.className = "chip-tag";
    tag.textContent = chip.dataset.previewKind || (chip.dataset.previewImg ? "Diagrama" : "Texto");
    chip.append(tag);
  });

  /* ---------- ventana de previsualización ---------- */

  function paintPreview(item) {
    if (!item) return;
    const source = item.dataset.previewImg;
    const chips = Array.from(item.parentElement.querySelectorAll(".chip"));
    const position = String(chips.indexOf(item) + 1).padStart(2, "0");

    if (source) {
      preview.classList.remove("is-sheet");
      previewImage.src = source;
      previewImage.alt = item.dataset.previewTitle || "";
      previewImage.hidden = false;
    } else {
      preview.classList.add("is-sheet");
      previewImage.removeAttribute("src");
      previewImage.alt = "";
      previewImage.hidden = true;
      previewSheet.dataset.code = position;
    }

    previewTitle.textContent =
      item.dataset.previewTitle || item.querySelector("span")?.textContent || "";
    previewText.textContent = item.dataset.previewText || "";
    preview.classList.toggle("is-video", (item.dataset.previewKind || "") === "Video");
    preview.classList.add("is-on");
    preview.setAttribute("aria-hidden", "false");
  }

  function resetPreview(panel) {
    const first = panel?.querySelector(".chip");
    if (first) paintPreview(first);
    else {
      preview.classList.remove("is-on");
    preview.classList.remove("is-video");
      preview.setAttribute("aria-hidden", "true");
    }
  }

  /* ---------- apertura y cierre de categorías ---------- */

  function openCard(card) {
    clearTimeout(closeTimer);
    const panel = panels.get(card.dataset.menu);
    if (!panel) return;

    cards.forEach((candidate) => {
      const active = candidate === card;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-expanded", String(active));
    });

    panels.forEach((candidate, key) => {
      candidate.hidden = key !== card.dataset.menu;
    });

    mega.classList.add("open");
    resetPreview(panel);
  }

  function closeMenu() {
    clearTimeout(closeTimer);
    cards.forEach((card) => {
      card.classList.remove("is-active");
      card.setAttribute("aria-expanded", "false");
    });
    homeLink?.classList.remove("is-active");
    mega.classList.remove("open");
    preview.classList.remove("is-on");
    preview.classList.remove("is-video");
    preview.setAttribute("aria-hidden", "true");
    markPage();
  }

  const isOpen = () => mega.classList.contains("open");

  cards.forEach((card) => {
    let pointerActivated = false;

    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") openCard(card);
    });

    card.addEventListener("pointerdown", () => {
      pointerActivated = true;
    });

    card.addEventListener("pointerup", () => {
      setTimeout(() => {
        pointerActivated = false;
      }, 0);
    });

    card.addEventListener("focus", () => {
      if (!pointerActivated) openCard(card);
    });

    card.addEventListener("click", () => {
      const open = card.classList.contains("is-active") && isOpen();
      if (open && hoverCapable.matches) return;
      if (open) closeMenu();
      else openCard(card);
    });

    card.addEventListener("keydown", (event) => {
      const index = cards.indexOf(card);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const next = cards[(index + (event.key === "ArrowRight" ? 1 : -1) + cards.length) % cards.length];
        next.focus();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        panels.get(card.dataset.menu)?.querySelector(".chip")?.focus();
      }
    });
  });

  /* ---------- chips: previsualización y navegación ---------- */

  studyMenu.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("pointerenter", () => paintPreview(chip));
    chip.addEventListener("focus", () => paintPreview(chip));

    chip.addEventListener("click", () => closeMenu());
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Escape") return;
      if (event.key === "Enter" || event.key === " ") closeMenu();
    });
  });

  studyMenu.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    closeTimer = setTimeout(closeMenu, 180);
  });

  studyMenu.addEventListener("pointerenter", () => clearTimeout(closeTimer));

  studyMenu.addEventListener("focusout", (event) => {
    if (!studyMenu.contains(event.relatedTarget)) closeTimer = setTimeout(closeMenu, 0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    const active = cards.find((card) => card.classList.contains("is-active"));
    closeMenu();
    active?.focus();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (isOpen()) closeMenu();
    },
    { passive: true },
  );

  /* ---------- carrusel: arrastre y flechas de scroll ---------- */

  let pressing = false;
  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startLeft = 0;

  rail?.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") return;
    pressing = true;
    dragged = false;
    startX = event.clientX;
    startLeft = rail.scrollLeft;
  });

  rail?.addEventListener("pointermove", (event) => {
    if (!pressing) return;
    const delta = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) < 8) return;
      dragging = true;
      dragged = true;
      rail.classList.add("is-dragging");
      rail.setPointerCapture(event.pointerId);
    }
    rail.scrollLeft = startLeft - delta;
  });

  function endDrag() {
    pressing = false;
    if (!dragging) return;
    dragging = false;
    rail.classList.remove("is-dragging");
  }

  rail?.addEventListener("pointerup", endDrag);
  rail?.addEventListener("pointercancel", endDrag);
  rail?.addEventListener("pointerleave", endDrag);

  /* el arrastre no debe cancelar la navegación de los enlaces del carrusel */
  rail?.addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  rail?.addEventListener("dragstart", (event) => event.preventDefault());

  /* ---------- precarga de las miniaturas de la ventana ---------- */

  studyMenu.querySelectorAll(".chip[data-preview-img]").forEach((chip) => {
    const preload = new Image();
    preload.src = chip.dataset.previewImg;
  });
}
