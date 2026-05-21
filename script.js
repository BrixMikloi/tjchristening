(function () {
  "use strict";

  const SELECTORS = {
    countdown: "[data-countdown]",
    reveal: ".reveal",
    gallery: "[data-gallery]",
    galleryItem: ".gallery-item",
    lightbox: "[data-lightbox]",
    lightboxImage: "[data-lightbox-image]",
    close: "[data-lightbox-close]",
    prev: "[data-lightbox-prev]",
    next: "[data-lightbox-next]",
    form: ".rsvp-form",
    success: ".form-success",
  };

  const EVENT_DATE = new Date("2026-06-28T11:30:00+08:00");
  const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxSK5p_YXKFTD0FUdMYQCoBC5VlOIiL66EfArP3a-ODnQSCMO2ZcY1MQOy_c5JwiIU3/exec";
  const state = {
    galleryImages: [],
    activeImage: 0,
    lastFocusedElement: null,
  };

  const getElements = () => ({
    countdown: document.querySelectorAll(SELECTORS.countdown),
    revealItems: document.querySelectorAll(SELECTORS.reveal),
    gallery: document.querySelector(SELECTORS.gallery),
    lightbox: document.querySelector(SELECTORS.lightbox),
    lightboxImage: document.querySelector(SELECTORS.lightboxImage),
    form: document.querySelector(SELECTORS.form),
  });

  const pad = (value) => String(value).padStart(2, "0");

  const updateCountdown = (items) => {
    const now = new Date();
    const difference = Math.max(EVENT_DATE - now, 0);
    const units = {
      days: Math.floor(difference / 86400000),
      hours: Math.floor((difference / 3600000) % 24),
      minutes: Math.floor((difference / 60000) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };

    items.forEach((item) => {
      item.textContent = pad(units[item.dataset.countdown] || 0);
    });
  };

  const initCountdown = (items) => {
    if (!items.length) return;
    updateCountdown(items);
    window.setInterval(() => updateCountdown(items), 1000);
  };

  const initRevealAnimations = (items) => {
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18 }
    );

    items.forEach((item) => observer.observe(item));
  };

  const collectGalleryImages = (gallery) => {
    if (!gallery) return [];

    return Array.from(gallery.querySelectorAll("img")).map((image) => ({
      src: image.currentSrc || image.src,
      alt: image.alt,
    }));
  };

  const setLightboxImage = (index, elements) => {
    const image = state.galleryImages[index];
    if (!image) return;

    elements.lightboxImage.classList.add("is-switching");

    window.setTimeout(() => {
      elements.lightboxImage.src = image.src;
      elements.lightboxImage.alt = image.alt;
      elements.lightboxImage.classList.remove("is-switching");
    }, 160);
  };

  const openLightbox = (index, elements) => {
    state.activeImage = index;
    state.lastFocusedElement = document.activeElement;
    setLightboxImage(index, elements);
    elements.lightbox.classList.add("is-open");
    elements.lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    elements.lightbox.querySelector(SELECTORS.close).focus();
  };

  const closeLightbox = (elements) => {
    elements.lightbox.classList.remove("is-open");
    elements.lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");

    if (state.lastFocusedElement) {
      state.lastFocusedElement.focus();
    }
  };

  const moveLightbox = (direction, elements) => {
    const total = state.galleryImages.length;
    state.activeImage = (state.activeImage + direction + total) % total;
    setLightboxImage(state.activeImage, elements);
  };

  const initGallery = (elements) => {
    if (!elements.gallery || !elements.lightbox) return;

    state.galleryImages = collectGalleryImages(elements.gallery);

    elements.gallery.addEventListener("click", (event) => {
      const item = event.target.closest(SELECTORS.galleryItem);
      if (!item) return;
      openLightbox(Number(item.dataset.index), elements);
    });

    elements.lightbox.addEventListener("click", (event) => {
      if (event.target === elements.lightbox || event.target.closest(SELECTORS.close)) {
        closeLightbox(elements);
        return;
      }

      if (event.target.closest(SELECTORS.prev)) {
        moveLightbox(-1, elements);
      }

      if (event.target.closest(SELECTORS.next)) {
        moveLightbox(1, elements);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!elements.lightbox.classList.contains("is-open")) return;

      const actions = {
        Escape: () => closeLightbox(elements),
        ArrowLeft: () => moveLightbox(-1, elements),
        ArrowRight: () => moveLightbox(1, elements),
      };

      if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
      }
    });
  };

  const validators = {
    attendance: (value) => (value ? "" : "Please confirm your attendance."),
    name: (value) => (value.trim().length >= 2 ? "" : "Please enter your name."),
    contact: (value) =>
      /^[0-9+\-\s()]{7,}$/.test(value.trim()) ? "" : "Please enter a valid contact number.",
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "" : "Please enter a valid email.",
    count: (value) => {
      const count = Number(value);
      return count >= 1 && count <= 10 ? "" : "Please enter a number from 1 to 10.";
    },
  };

  const setFieldError = (form, name, message) => {
    const field = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);

    if (field) {
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }

    if (error) {
      error.textContent = message;
    }
  };

  const validateForm = (form) => {
    let isValid = true;

    Object.keys(validators).forEach((name) => {
      const message = validators[name](form.elements[name].value);
      setFieldError(form, name, message);

      if (message) {
        isValid = false;
      }
    });

    return isValid;
  };

  const getFormPayload = (form) => {
    const formData = new FormData(form);
    formData.append("submittedAt", new Date().toISOString());
    return formData;
  };

  const isGoogleSheetsConfigured = () =>
    GOOGLE_SHEETS_WEB_APP_URL &&
    !GOOGLE_SHEETS_WEB_APP_URL.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE");

  const setFormStatus = (message, successMessage, isError = false) => {
    successMessage.textContent = message;
    successMessage.classList.toggle("is-error", isError);
    successMessage.classList.add("is-visible");
  };

  const submitToGoogleSheets = async (form) => {
    if (!isGoogleSheetsConfigured()) {
      throw new Error("Google Sheets endpoint is not configured.");
    }

    await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      body: getFormPayload(form),
    });
  };

  const initForm = (form) => {
    if (!form) return;

    const successMessage = form.querySelector(SELECTORS.success);
    const submitButton = form.querySelector("button[type='submit']");

    form.addEventListener("input", (event) => {
      const field = event.target;
      if (!validators[field.name]) return;
      setFieldError(form, field.name, validators[field.name](field.value));
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      successMessage.classList.remove("is-visible", "is-error");
      successMessage.textContent = "";

      if (!validateForm(form)) {
        form.querySelector("[aria-invalid='true']").focus();
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Sending...";

      try {
        await submitToGoogleSheets(form);
        form.reset();
        setFormStatus("Thank you. Your RSVP has been received.", successMessage);
      } catch (error) {
        setFormStatus(
          "Sorry, your RSVP could not be sent yet. Please try again later.",
          successMessage,
          true
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit RSVP";
      }
    });
  };

  const initParallax = () => {
    const hero = document.querySelector(".hero");
    const decor = document.querySelectorAll(".decor");
    if (!hero || !decor.length) return;

    window.addEventListener(
      "scroll",
      () => {
        const offset = Math.min(window.scrollY * 0.08, 42);
        decor.forEach((item, index) => {
          item.style.translate = `${index ? -offset : offset}px ${offset * 0.5}px`;
        });
      },
      { passive: true }
    );
  };

  const init = () => {
    const elements = getElements();
    initCountdown(elements.countdown);
    initRevealAnimations(elements.revealItems);
    initGallery(elements);
    initForm(elements.form);
    initParallax();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
