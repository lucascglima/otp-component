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

  // ─── NOVOS SELETORES ────────────────────────────────────────────────────────
  const CONTINUE_BUTTON_ID = "continue";
  const VERIFY_CONTROL_ID = "emailVerificationControl"; // container pai do bloco OTP/verify
  const MFA_SUCCESS_DEBOUNCE_MS = 300; // aguarda DOM estabilizar antes de checar
  const MFA_OBSERVER_TIMEOUT_MS = 60000; // desliga o observer após 60s (segurança)
  // ────────────────────────────────────────────────────────────────────────────

  // ... (todo o código existente permanece igual) ...

  /**
   * Verifica se o bloco OTP / botão de verificar estão ocultos.
   * Aceita: display:none, visibility:hidden, atributo hidden, ou aria-hidden="true"
   */
  function isElementHidden(el) {
    if (!el) return true; // se não existe no DOM, considera oculto
    if (el.hidden) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    const style = window.getComputedStyle(el);
    if (style.display === "none") return true;
    if (style.visibility === "hidden") return true;
    return false;
  }

  /**
   * Checa se TODAS as condições de sucesso do MFA estão satisfeitas:
   *  1. Bloco de verificação OTP está oculto
   *  2. Botão de verificar está oculto ou desabilitado
   *  3. Botão #continue existe, está visível e não está desabilitado
   */
  function isMfaValidated() {
    const verifyControl = document.getElementById(VERIFY_CONTROL_ID);
    const submitBtn = document.getElementById(SUBMIT_BUTTON_ID);
    const continueBtn = document.getElementById(CONTINUE_BUTTON_ID);
    const otpContainer = document.getElementById(CONTAINER_ID);

    const condition1 = isElementHidden(verifyControl);
    const condition2 =
      isElementHidden(submitBtn) || (submitBtn && submitBtn.disabled);
    const condition3 =
      continueBtn && !isElementHidden(continueBtn) && !continueBtn.disabled;
    const condition4 = isElementHidden(otpContainer);

    console.log("[MFA Observer] Checando condições de sucesso:");
    console.log(
      "  ✔ condition1 - bloco #emailVerificationControl oculto?",
      condition1,
    );
    console.log(
      "  ✔ condition2 - botão verificar oculto/disabled?",
      condition2,
    );
    console.log(
      "  ✔ condition3 - botão #continue visível e habilitado?",
      condition3,
    );
    console.log("  ✔ condition4 - #otp-container oculto?", condition4);

    return condition1 && condition2 && condition3 && condition4;
  }

  /**
   * Dispara o click no botão #continue de forma segura:
   * Re-valida o DOM no momento do click (não confia só na mutação).
   */
  function autoClickContinue(flag) {
    if (flag.clicked) {
      console.log("[MFA Observer] Auto-click ignorado: já foi disparado.");
      return;
    }

    // Re-valida imediatamente antes de clicar (defesa contra falso positivo)
    if (!isMfaValidated()) {
      console.warn(
        "[MFA Observer] Re-validação falhou antes do click. Abortando.",
      );
      return;
    }

    flag.clicked = true;
    const continueBtn = document.getElementById(CONTINUE_BUTTON_ID);
    console.log(
      "[MFA Observer] ✅ MFA validado! Disparando click em #continue...",
    );
    continueBtn.click();
  }

  /**
   * Inicia o MutationObserver que detecta quando o B2C confirma o MFA
   * e dispara automaticamente o click em #continue.
   *
   * Estratégia defensiva:
   *  - Observa o container pai (#emailVerificationControl ou body como fallback)
   *  - Debounce de 300ms para aguardar o DOM estabilizar
   *  - Flag alreadyClicked para garantir disparo único
   *  - Timeout de segurança para desligar o observer
   *  - Re-validação no momento do click
   */
  function setupMfaSuccessObserver() {
    console.log("[MFA Observer] Iniciando observer de sucesso do MFA...");

    const flag = { clicked: false };
    let debounceTimer = null;

    // Prefere observar o container específico; fallback para body
    const observeTarget =
      document.getElementById(VERIFY_CONTROL_ID) ||
      document.getElementById("api") || // container padrão do B2C
      document.body;

    console.log(
      "[MFA Observer] Observando elemento:",
      observeTarget.id || "body",
    );

    const observer = new MutationObserver(function (mutations) {
      console.log(
        "[MFA Observer] Mutação detectada. Mutations:",
        mutations.length,
      );

      // Debounce: aguarda DOM estabilizar antes de checar
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        console.log(
          "[MFA Observer] Debounce concluído. Avaliando estado do DOM...",
        );

        if (isMfaValidated()) {
          observer.disconnect();
          clearTimeout(safetyTimeout);
          console.log("[MFA Observer] Observer desconectado após sucesso.");
          autoClickContinue(flag);
        } else {
          console.log(
            "[MFA Observer] Condições ainda não satisfeitas. Aguardando...",
          );
        }
      }, MFA_SUCCESS_DEBOUNCE_MS);
    });

    observer.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "disabled", "aria-hidden"],
    });

    // Timeout de segurança: desliga o observer para não ficar vivo eternamente
    const safetyTimeout = setTimeout(function () {
      observer.disconnect();
      console.warn(
        "[MFA Observer] ⚠ Timeout de segurança atingido (" +
          MFA_OBSERVER_TIMEOUT_MS / 1000 +
          "s). Observer desligado sem detectar sucesso.",
      );
    }, MFA_OBSERVER_TIMEOUT_MS);

    console.log(
      "[MFA Observer] Observer ativo. Timeout de segurança: " +
        MFA_OBSERVER_TIMEOUT_MS / 1000 +
        "s",
    );
  }

  // ─── PONTO DE INTEGRAÇÃO ────────────────────────────────────────────────────
  // Chame setupMfaSuccessObserver() dentro da sua função bootstrap(),
  // logo após montar o componente OTP:
  //
  //   function bootstrap() {
  //     ...código existente...
  //     setupMfaSuccessObserver(); // ← adicionar aqui
  //   }
  // ────────────────────────────────────────────────────────────────────────────
})();
