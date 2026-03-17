/**
 * OTP 6 Digits Component - Azure B2C
 * Cria inputs OTP de 6 dígitos, sincroniza com #VerificationCode
 * e realiza auto-submit ao completar.
 */
(function () {
  "use strict";

  const OTP_LENGTH = 6;
  const CONTAINER_ID = "otp-container";
  const VERIFICATION_INPUT_ID = "VerificationCode";
  const SUBMIT_BUTTON_ID = "emailVerificationControl_but_verify_code";

  /**
   * Inicializa o componente OTP assim que o DOM estiver pronto.
   * Usa MutationObserver para cenários onde o B2C injeta o DOM dinamicamente.
   */
  function init() {
    const verificationInput = document.getElementById(VERIFICATION_INPUT_ID);
    if (!verificationInput) {
      waitForElement(VERIFICATION_INPUT_ID, bootstrap);
      return;
    }
    bootstrap();
  }

  /**
   * Aguarda um elemento aparecer no DOM (útil para Azure B2C que renderiza dinamicamente).
   */
  function waitForElement(id, callback) {
    const observer = new MutationObserver(function (_mutations, obs) {
      if (document.getElementById(id)) {
        obs.disconnect();
        callback();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Monta o componente OTP no DOM.
   */
  function bootstrap() {
    const verificationInput = document.getElementById(VERIFICATION_INPUT_ID);
    if (!verificationInput) return;

    // Esconde o input original do B2C
    verificationInput.style.position = "absolute";
    verificationInput.style.opacity = "0";
    verificationInput.style.pointerEvents = "none";
    verificationInput.style.height = "0";
    verificationInput.style.overflow = "hidden";
    verificationInput.setAttribute("tabindex", "-1");
    verificationInput.setAttribute("aria-hidden", "true");

    // Cria o container OTP
    let container = document.getElementById(CONTAINER_ID);
    if (container) return; // Já inicializado

    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "otp-container";
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Código de verificação de 6 dígitos");

    // Cria os 6 inputs
    const inputs = [];
    for (var i = 0; i < OTP_LENGTH; i++) {
      var input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.pattern = "[0-9]";
      input.maxLength = 1;
      input.className = "otp-input";
      input.setAttribute("autocomplete", "one-time-code");
      input.setAttribute(
        "aria-label",
        "Dígito " + (i + 1) + " de " + OTP_LENGTH,
      );
      input.dataset.index = i;
      inputs.push(input);
      container.appendChild(input);
    }

    // Insere o container OTP antes do input original
    verificationInput.parentNode.insertBefore(container, verificationInput);

    // Bind dos eventos
    bindEvents(inputs, verificationInput);
  }

  /**
   * Registra todos os event listeners nos inputs OTP.
   */
  function bindEvents(inputs, verificationInput) {
    inputs.forEach(function (input, idx) {
      // Input: aceita apenas dígitos numéricos
      input.addEventListener("input", function (e) {
        var value = sanitize(e.target.value);

        if (value.length === 0) {
          e.target.value = "";
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          return;
        }

        // Se digitou mais de 1 caractere (ex: autocomplete do SO)
        if (value.length > 1) {
          distributeDigits(inputs, value, idx);
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          autoSubmitIfComplete(inputs);
          return;
        }

        e.target.value = value[0];
        updateClasses(inputs);
        syncToVerificationCode(inputs, verificationInput);

        // Move para o próximo input
        if (idx < OTP_LENGTH - 1) {
          inputs[idx + 1].focus();
          inputs[idx + 1].select();
        }

        autoSubmitIfComplete(inputs);
      });

      // Keydown: navegação e backspace
      input.addEventListener("keydown", function (e) {
        if (e.key === "Backspace") {
          if (e.target.value === "" && idx > 0) {
            inputs[idx - 1].value = "";
            inputs[idx - 1].focus();
            updateClasses(inputs);
            syncToVerificationCode(inputs, verificationInput);
          } else {
            e.target.value = "";
            updateClasses(inputs);
            syncToVerificationCode(inputs, verificationInput);
          }
          e.preventDefault();
          return;
        }

        if (e.key === "Delete") {
          e.target.value = "";
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          e.preventDefault();
          return;
        }

        if (e.key === "ArrowLeft" && idx > 0) {
          inputs[idx - 1].focus();
          inputs[idx - 1].select();
          e.preventDefault();
          return;
        }

        if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
          inputs[idx + 1].focus();
          inputs[idx + 1].select();
          e.preventDefault();
          return;
        }

        // Se é um dígito e o campo já tem valor, sobrescreve e avança
        if (/^[0-9]$/.test(e.key) && e.target.value !== "") {
          e.target.value = e.key;
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          if (idx < OTP_LENGTH - 1) {
            inputs[idx + 1].focus();
            inputs[idx + 1].select();
          }
          autoSubmitIfComplete(inputs);
          e.preventDefault();
          return;
        }

        // Bloqueia caracteres não numéricos (exceto teclas de controle)
        if (
          e.key.length === 1 &&
          !/[0-9]/.test(e.key) &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault();
        }
      });

      // Paste: suporte a Ctrl+V e click direito -> colar
      input.addEventListener("paste", function (e) {
        e.preventDefault();
        var clipboardData =
          e.clipboardData ||
          (window.clipboardData &&
            window.clipboardData.getData &&
            window.clipboardData);
        if (!clipboardData) return;

        var pasted =
          typeof clipboardData.getData === "function"
            ? clipboardData.getData("text/plain") ||
              clipboardData.getData("Text")
            : "";

        var digits = sanitize(pasted);
        if (digits.length === 0) return;

        distributeDigits(inputs, digits, idx);
        updateClasses(inputs);
        syncToVerificationCode(inputs, verificationInput);
        autoSubmitIfComplete(inputs);
      });

      // Focus: seleciona o conteúdo ao focar
      input.addEventListener("focus", function () {
        setTimeout(function () {
          input.select();
        }, 0);
      });
    });

    // Observa mudanças externas no #VerificationCode (ex: preenchido por outra lógica B2C)
    var verificationObserver = new MutationObserver(function () {
      var val = sanitize(verificationInput.value);
      if (val !== getOtpValue(inputs)) {
        distributeDigits(inputs, val, 0);
        updateClasses(inputs);
      }
    });
    verificationObserver.observe(verificationInput, {
      attributes: true,
      attributeFilter: ["value"],
    });

    // Também monitora via polling leve para cobrir .value programático
    setInterval(function () {
      var currentVerification = sanitize(verificationInput.value);
      var currentOtp = getOtpValue(inputs);
      if (
        currentVerification !== currentOtp &&
        currentVerification.length === OTP_LENGTH
      ) {
        distributeDigits(inputs, currentVerification, 0);
        updateClasses(inputs);
      }
    }, 500);
  }

  /**
   * Filtra apenas dígitos numéricos de uma string.
   */
  function sanitize(str) {
    return (str || "").replace(/[^0-9]/g, "");
  }

  /**
   * Distribui uma sequência de dígitos nos inputs OTP a partir de um índice.
   */
  function distributeDigits(inputs, digits, startIndex) {
    for (var i = 0; i < digits.length && startIndex + i < OTP_LENGTH; i++) {
      inputs[startIndex + i].value = digits[i];
    }
    // Foca no próximo vazio ou no último preenchido
    var nextEmpty = -1;
    for (var j = 0; j < OTP_LENGTH; j++) {
      if (inputs[j].value === "") {
        nextEmpty = j;
        break;
      }
    }
    if (nextEmpty >= 0) {
      inputs[nextEmpty].focus();
    } else {
      inputs[OTP_LENGTH - 1].focus();
    }
  }

  /**
   * Retorna o valor OTP concatenado de todos os inputs.
   */
  function getOtpValue(inputs) {
    var val = "";
    for (var i = 0; i < inputs.length; i++) {
      val += inputs[i].value;
    }
    return val;
  }

  /**
   * Sincroniza o valor dos inputs OTP para o #VerificationCode.
   */
  function syncToVerificationCode(inputs, verificationInput) {
    var otpValue = getOtpValue(inputs);
    if (verificationInput.value !== otpValue) {
      verificationInput.value = otpValue;
      // Dispara eventos para garantir que frameworks/B2C detectem a mudança
      verificationInput.dispatchEvent(new Event("input", { bubbles: true }));
      verificationInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /**
   * Atualiza classes visuais (filled) nos inputs.
   */
  function updateClasses(inputs) {
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value !== "") {
        inputs[i].classList.add("filled");
      } else {
        inputs[i].classList.remove("filled");
      }
    }
  }

  /**
   * Auto-submit quando todos os 6 dígitos estiverem preenchidos.
   */
  function autoSubmitIfComplete(inputs) {
    var otpValue = getOtpValue(inputs);
    if (otpValue.length === OTP_LENGTH && /^[0-9]{6}$/.test(otpValue)) {
      setTimeout(function () {
        var btn = document.getElementById(SUBMIT_BUTTON_ID);
        if (btn && !btn.disabled) {
          btn.click();
        }
      }, 150);
    }
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
