/**
 * OTP 6 Digits Component - Azure B2C
 * Cria inputs OTP de 6 dígitos, sincroniza com #VerificationCode
 * e realiza auto-submit ao completar.
 */
function initOtp6Digits() {
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
    // Histórico para undo/redo
    var history = [];
    var historyIndex = -1;
    var MAX_HISTORY = 30;

    function snapshotState() {
      var state = [];
      for (var i = 0; i < OTP_LENGTH; i++) state.push(inputs[i].value);
      return state.join("");
    }

    function pushHistory() {
      var current = snapshotState();
      // Não duplica o estado atual
      if (historyIndex >= 0 && history[historyIndex] === current) return;
      // Remove qualquer redo futuro
      history = history.slice(0, historyIndex + 1);
      history.push(current);
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length - 1;
    }

    function restoreState(state) {
      for (var i = 0; i < OTP_LENGTH; i++) {
        inputs[i].value = state[i] || "";
      }
      updateClasses(inputs);
      syncToVerificationCode(inputs, verificationInput);
    }

    function undo() {
      if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
      }
    }

    function redo() {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
      }
    }

    // Snapshot inicial
    pushHistory();

    inputs.forEach(function (input, idx) {
      // Input: aceita apenas dígitos numéricos
      input.addEventListener("input", function (e) {
        var value = sanitize(e.target.value);

        if (value.length === 0) {
          e.target.value = "";
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          pushHistory();
          return;
        }

        // Se digitou mais de 1 caractere (ex: autocomplete do SO)
        if (value.length > 1) {
          distributeDigits(inputs, value, idx);
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          pushHistory();
          autoSubmitIfComplete(inputs);
          return;
        }

        e.target.value = value[0];
        updateClasses(inputs);
        syncToVerificationCode(inputs, verificationInput);
        pushHistory();

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
          pushHistory();
          e.preventDefault();
          return;
        }

        if (e.key === "Delete") {
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Delete: limpa do cursor até o final
            for (var cd = idx; cd < OTP_LENGTH; cd++) {
              inputs[cd].value = "";
            }
            updateClasses(inputs);
            syncToVerificationCode(inputs, verificationInput);
            pushHistory();
            e.preventDefault();
            return;
          }
          // Delete: shift dos dígitos à direita para a esquerda
          for (var d = idx; d < OTP_LENGTH - 1; d++) {
            inputs[d].value = inputs[d + 1].value;
          }
          inputs[OTP_LENGTH - 1].value = "";
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          pushHistory();
          e.preventDefault();
          return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          if (idx > 0) {
            inputs[idx - 1].focus();
            inputs[idx - 1].select();
          }
          e.preventDefault();
          return;
        }

        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          if (idx < OTP_LENGTH - 1) {
            inputs[idx + 1].focus();
            inputs[idx + 1].select();
          }
          e.preventDefault();
          return;
        }

        if (e.key === "Home") {
          inputs[0].focus();
          inputs[0].select();
          e.preventDefault();
          return;
        }

        if (e.key === "End") {
          inputs[OTP_LENGTH - 1].focus();
          inputs[OTP_LENGTH - 1].select();
          e.preventDefault();
          return;
        }

        // Enter: submeter verificação
        if (e.key === "Enter") {
          var btn = document.getElementById(SUBMIT_BUTTON_ID);
          if (btn && !btn.disabled) btn.click();
          e.preventDefault();
          return;
        }

        // Escape: desfocar o componente
        if (e.key === "Escape") {
          e.target.blur();
          e.preventDefault();
          return;
        }

        // Ctrl+A / Cmd+A: seleciona todos (foca o primeiro)
        if ((e.ctrlKey || e.metaKey) && e.key === "a") {
          inputs[0].focus();
          inputs[0].select();
          e.preventDefault();
          return;
        }

        // Ctrl+Z / Cmd+Z: desfazer
        if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
          undo();
          e.preventDefault();
          return;
        }

        // Ctrl+Y / Cmd+Y ou Ctrl+Shift+Z: refazer
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === "y" || (e.key === "z" && e.shiftKey))
        ) {
          redo();
          e.preventDefault();
          return;
        }

        // Ctrl+Backspace / Cmd+Backspace: limpa tudo
        if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
          for (var c = 0; c < OTP_LENGTH; c++) {
            inputs[c].value = "";
          }
          inputs[0].focus();
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          pushHistory();
          e.preventDefault();
          return;
        }

        // Tab / Shift+Tab: comportamento nativo (não interceptar)

        // Se é um dígito e o campo já tem valor, sobrescreve e avança
        if (/^[0-9]$/.test(e.key) && e.target.value !== "") {
          e.target.value = e.key;
          updateClasses(inputs);
          syncToVerificationCode(inputs, verificationInput);
          pushHistory();
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

      // Copy: copia o OTP completo (não apenas o dígito do campo atual)
      input.addEventListener("copy", function (e) {
        e.preventDefault();
        var fullOtp = getOtpValue(inputs);
        if (e.clipboardData) {
          e.clipboardData.setData("text/plain", fullOtp);
        }
      });

      // Cut: copia o OTP completo e limpa todos os campos
      input.addEventListener("cut", function (e) {
        e.preventDefault();
        var fullOtp = getOtpValue(inputs);
        if (e.clipboardData) {
          e.clipboardData.setData("text/plain", fullOtp);
        }
        for (var ct = 0; ct < OTP_LENGTH; ct++) {
          inputs[ct].value = "";
        }
        inputs[0].focus();
        updateClasses(inputs);
        syncToVerificationCode(inputs, verificationInput);
        pushHistory();
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
        pushHistory();
        autoSubmitIfComplete(inputs);
      });

      // Drop: arrastar texto numérico para o campo
      input.addEventListener("drop", function (e) {
        e.preventDefault();
        var data = e.dataTransfer
          ? e.dataTransfer.getData("text/plain") ||
            e.dataTransfer.getData("Text")
          : "";
        var digits = sanitize(data);
        if (digits.length === 0) return;

        distributeDigits(inputs, digits, idx);
        updateClasses(inputs);
        syncToVerificationCode(inputs, verificationInput);
        pushHistory();
        autoSubmitIfComplete(inputs);
      });

      // Previne o comportamento padrão de dragover para permitir drop
      input.addEventListener("dragover", function (e) {
        e.preventDefault();
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

  /**
   * Observa o DOM para detectar quando o Azure B2C confirma a verificação do MFA
   * e dispara automaticamente o click no botão #continue.
   *
   * Sinais monitorados:
   *  - Mensagem de sucesso visível (ex: ".verificationSuccessText", texto "verified")
   *  - Container OTP / seção de verificação ocultos
   *  - Botão de verificar código oculto ou removido
   */
  function watchForMfaCompletion() {
    var CONTINUE_BUTTON_ID = "continue";
    var alreadyClicked = false;

    console.log(
      "[MFA-Watcher] Iniciando observação do DOM para conclusão do MFA...",
    );

    function isHidden(el) {
      if (!el) return true;
      var style = window.getComputedStyle(el);
      return (
        style.display === "none" ||
        style.visibility === "hidden" ||
        el.offsetParent === null ||
        el.getAttribute("aria-hidden") === "true"
      );
    }

    function checkSuccessMessage() {
      // Azure B2C usa .verificationSuccessText ou .verificationInfoText com texto de sucesso
      var successEl = document.querySelector(
        ".verificationSuccessText, .verification-success, .verificationInfoText.success",
      );
      if (
        successEl &&
        !isHidden(successEl) &&
        successEl.textContent.trim().length > 0
      ) {
        console.log(
          "[MFA-Watcher] ✅ Mensagem de sucesso detectada:",
          successEl.textContent.trim(),
        );
        return true;
      }

      // Busca genérica por texto de sucesso no bloco de verificação
      var verificationControl = document.getElementById(
        "emailVerificationControl",
      );
      if (verificationControl) {
        var allText = verificationControl.innerText || "";
        if (
          /verif(ied|icado)|success|sucesso|confirmed|confirmado/i.test(allText)
        ) {
          console.log(
            "[MFA-Watcher] ✅ Texto de sucesso encontrado no bloco de verificação:",
            allText.substring(0, 80),
          );
          return true;
        }
      }

      return false;
    }

    function checkOtpHidden() {
      var otpContainer = document.getElementById(CONTAINER_ID);
      var verificationInput = document.getElementById(VERIFICATION_INPUT_ID);
      var verificationSection = document.getElementById(
        "emailVerificationControl",
      );

      // Se a seção inteira de verificação sumiu ou está oculta
      if (verificationSection && isHidden(verificationSection)) {
        console.log(
          "[MFA-Watcher] ✅ Seção de verificação (#emailVerificationControl) está oculta.",
        );
        return true;
      }

      // Se o container OTP e o input original sumiram
      if (
        (otpContainer && isHidden(otpContainer)) ||
        (!otpContainer && verificationInput && isHidden(verificationInput))
      ) {
        console.log(
          "[MFA-Watcher] ✅ Container OTP / input de verificação está oculto.",
        );
        return true;
      }

      return false;
    }

    function checkVerifyButtonHidden() {
      var verifyBtn = document.getElementById(SUBMIT_BUTTON_ID);
      if (verifyBtn && isHidden(verifyBtn)) {
        console.log("[MFA-Watcher] ✅ Botão de verificar código está oculto.");
        return true;
      }
      if (!verifyBtn) {
        console.log(
          "[MFA-Watcher] ✅ Botão de verificar código foi removido do DOM.",
        );
        return true;
      }
      return false;
    }

    function tryContinue() {
      if (alreadyClicked) return;

      var hasSuccess = checkSuccessMessage();
      var otpHidden = checkOtpHidden();
      var verifyHidden = checkVerifyButtonHidden();

      console.log(
        "[MFA-Watcher] Estado atual — sucesso:",
        hasSuccess,
        "| OTP oculto:",
        otpHidden,
        "| botão verificar oculto:",
        verifyHidden,
      );

      // Dispara se pelo menos 2 dos 3 sinais forem verdadeiros
      var signals =
        (hasSuccess ? 1 : 0) + (otpHidden ? 1 : 0) + (verifyHidden ? 1 : 0);
      if (signals >= 2) {
        var continueBtn = document.getElementById(CONTINUE_BUTTON_ID);
        if (continueBtn && !isHidden(continueBtn) && !continueBtn.disabled) {
          alreadyClicked = true;
          console.log(
            "[MFA-Watcher] 🎯 MFA verificado! Clicando automaticamente no botão #continue...",
          );
          setTimeout(function () {
            continueBtn.click();
            console.log(
              "[MFA-Watcher] ✅ Click no #continue executado com sucesso.",
            );
          }, 300);
        } else {
          console.log(
            "[MFA-Watcher] ⏳ Sinais de MFA detectados, mas botão #continue ainda não está disponível.",
          );
        }
      }
    }

    // MutationObserver para reagir a mudanças no DOM em tempo real
    var mfaObserver = new MutationObserver(function (mutations) {
      if (alreadyClicked) return;

      var domChanged = mutations.some(function (m) {
        return (
          m.type === "childList" ||
          (m.type === "attributes" &&
            (m.attributeName === "style" ||
              m.attributeName === "class" ||
              m.attributeName === "aria-hidden" ||
              m.attributeName === "disabled"))
        );
      });

      if (domChanged) {
        console.log(
          "[MFA-Watcher] 🔄 Mudança no DOM detectada, verificando estado do MFA...",
        );
        tryContinue();
      }
    });

    mfaObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "aria-hidden", "disabled"],
    });

    // Polling como fallback (para mudanças que o Observer não captura)
    var pollInterval = setInterval(function () {
      if (alreadyClicked) {
        clearInterval(pollInterval);
        mfaObserver.disconnect();
        console.log(
          "[MFA-Watcher] 🛑 Observação encerrada (continue já foi clicado).",
        );
        return;
      }
      tryContinue();
    }, 1000);
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      watchForMfaCompletion();
    });
  } else {
    init();
    watchForMfaCompletion();
  }
}
