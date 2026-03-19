/**
 * MFA Success Observer - Azure B2C
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo INDEPENDENTE do initOtp6Digits.
 *
 * Responsabilidade única: detectar quando o Azure B2C confirmar a validação
 * do MFA e, nesse momento, disparar automaticamente o click em #continue.
 *
 * Como usar:
 *   Chame initMfaSuccessObserver() uma vez, após o componente OTP estar montado.
 *   Exemplo: no final da sua função bootstrap(), adicione:
 *
 *     initMfaSuccessObserver();
 *
 * Nenhuma dependência de initOtp6Digits. Pode ser chamado de qualquer contexto.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  // ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────

  var MFA_CONFIG = {
    // Botão que deve ser clicado após o MFA ser validado
    continueButtonId: "continue",

    // Botão de "Verificar código" do B2C (sinal: some após validação)
    submitButtonId: "emailVerificationControl_but_verify_code",

    // Container pai do bloco OTP (class .attrEntry que envolve o formulário)
    // Usado tanto como alvo do observer quanto como sinal de ocultação
    otpContainerClass: "attrEntry",

    // ID do container OTP customizado criado pelo initOtp6Digits
    customOtpContainerId: "otp-container",

    // Tempo (ms) para aguardar o DOM estabilizar após uma mutação antes de checar
    debounceMs: 300,

    // Tempo máximo (ms) que o observer fica ativo — segurança contra leak
    timeoutMs: 60000,
  };

  // ─── UTILITÁRIOS ───────────────────────────────────────────────────────────

  /**
   * Retorna true se o elemento não existe no DOM ou está visualmente oculto.
   * Cobre: display:none, visibility:hidden, atributo hidden, aria-hidden="true".
   */
  function isHidden(el) {
    if (!el) {
      return true;
    }
    if (el.hidden) {
      return true;
    }
    if (el.getAttribute("aria-hidden") === "true") {
      return true;
    }
    var computed = window.getComputedStyle(el);
    if (computed.display === "none") {
      return true;
    }
    if (computed.visibility === "hidden") {
      return true;
    }
    return false;
  }

  /**
   * Retorna true se o elemento existe, está visível e não está desabilitado.
   */
  function isReady(el) {
    if (!el) {
      return false;
    }
    if (isHidden(el)) {
      return false;
    }
    if (el.disabled) {
      return false;
    }
    return true;
  }

  /**
   * Encontra o container .attrEntry que envolve o bloco OTP.
   * Estratégia: pega o primeiro .attrEntry que contém o #VerificationCode
   * ou o #otp-container. Fallback: primeiro .attrEntry encontrado.
   */
  function findOtpAttrEntry() {
    var verificationInput = document.getElementById("VerificationCode");
    var customOtp = document.getElementById(MFA_CONFIG.customOtpContainerId);

    var reference = customOtp || verificationInput;

    if (reference) {
      var el = reference.closest("." + MFA_CONFIG.otpContainerClass);
      if (el) {
        return el;
      }
    }

    // Fallback: primeiro .attrEntry encontrado
    return document.querySelector("." + MFA_CONFIG.otpContainerClass);
  }

  // ─── LÓGICA DE VALIDAÇÃO ───────────────────────────────────────────────────

  /**
   * Checa se TODAS as condições de sucesso do MFA estão satisfeitas.
   *
   * Condições (AND — todas devem ser verdadeiras):
   *   1. O container .attrEntry do OTP está oculto
   *   2. O botão de verificar está oculto ou desabilitado
   *   3. O botão #continue existe, está visível e está habilitado
   *
   * Retorna true apenas se as três condições forem satisfeitas simultaneamente.
   */
  function checkMfaValidated() {
    var otpEntry = findOtpAttrEntry();
    var submitBtn = document.getElementById(MFA_CONFIG.submitButtonId);
    var continueBtn = document.getElementById(MFA_CONFIG.continueButtonId);

    var c1 = isHidden(otpEntry);
    var c2 = isHidden(submitBtn) || (submitBtn !== null && submitBtn.disabled);
    var c3 = isReady(continueBtn);

    console.log(
      "[MFA Observer] ── Checando condições de sucesso ──────────────",
    );
    console.log(
      "[MFA Observer]   C1 · .attrEntry (bloco OTP) oculto?    ",
      c1,
      "→",
      otpEntry,
    );
    console.log(
      "[MFA Observer]   C2 · botão verificar oculto/disabled?  ",
      c2,
      "→",
      submitBtn,
    );
    console.log(
      "[MFA Observer]   C3 · #continue visível e habilitado?   ",
      c3,
      "→",
      continueBtn,
    );
    console.log(
      "[MFA Observer]   Resultado: ",
      c1 && c2 && c3 ? "✅ MFA validado" : "⏳ aguardando",
    );

    return c1 && c2 && c3;
  }

  // ─── AÇÃO ──────────────────────────────────────────────────────────────────

  /**
   * Dispara o click no botão #continue de forma segura:
   *   - Verifica o flag para garantir disparo único
   *   - Re-valida o DOM no exato momento do click (defesa contra race condition)
   *   - Loga cada etapa para facilitar o debug
   *
   * @param {Object} state - Objeto de estado compartilhado { fired: boolean }
   */
  function triggerContinue(state) {
    console.log("[MFA Observer] triggerContinue() chamado.");

    if (state.fired) {
      console.log(
        "[MFA Observer] ⚠ Auto-click ignorado: já foi disparado anteriormente.",
      );
      return;
    }

    // Re-validação final antes do click — não confia apenas na mutação
    console.log("[MFA Observer] Re-validando DOM antes do click...");
    if (!checkMfaValidated()) {
      console.warn(
        "[MFA Observer] ✖ Re-validação falhou. Click abortado para evitar falso positivo.",
      );
      return;
    }

    var continueBtn = document.getElementById(MFA_CONFIG.continueButtonId);
    if (!continueBtn) {
      console.error(
        "[MFA Observer] ✖ Botão #continue não encontrado no momento do click.",
      );
      return;
    }

    state.fired = true;
    console.log(
      "[MFA Observer] ✅ Todas as condições confirmadas. Disparando click em #continue...",
    );
    continueBtn.click();
    console.log("[MFA Observer] 🚀 Click disparado com sucesso.");
  }

  // ─── OBSERVER ──────────────────────────────────────────────────────────────

  /**
   * Inicializa o MutationObserver que monitora o DOM do B2C.
   *
   * Estratégia de observação:
   *   - Alvo preferencial: o container pai do B2C (#api) ou o .attrEntry do OTP
   *   - Fallback: document.body
   *   - Atributos monitorados: style, class, hidden, disabled, aria-hidden
   *     (cobre todas as formas que o B2C usa para ocultar elementos)
   *
   * Proteções:
   *   - Debounce: aguarda DOM estabilizar antes de checar (evita chegar em rajada)
   *   - Flag state.fired: garante disparo único do click
   *   - Timeout de segurança: desconecta após MFA_CONFIG.timeoutMs ms
   *   - Re-validação no momento do click
   */
  function startObserver(state) {
    var debounceTimer = null;
    var safetyTimer = null;

    // Alvo do observer: #api (container padrão do B2C) → .attrEntry → body
    var target =
      document.getElementById("api") || findOtpAttrEntry() || document.body;

    console.log(
      "[MFA Observer] Observer iniciado. Alvo:",
      target.id || target.className || "body",
    );

    var observer = new MutationObserver(function (mutations) {
      console.log(
        "[MFA Observer] Mutação detectada. Total neste batch:",
        mutations.length,
      );

      // Debounce — aguarda o DOM estabilizar
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        console.log(
          "[MFA Observer] Debounce concluído (" +
            MFA_CONFIG.debounceMs +
            "ms). Avaliando estado...",
        );

        if (checkMfaValidated()) {
          console.log(
            "[MFA Observer] Condições satisfeitas. Desconectando observer...",
          );
          observer.disconnect();
          clearTimeout(safetyTimer);
          triggerContinue(state);
        }
      }, MFA_CONFIG.debounceMs);
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "disabled", "aria-hidden"],
    });

    // Timeout de segurança
    safetyTimer = setTimeout(function () {
      observer.disconnect();
      clearTimeout(debounceTimer);
      console.warn(
        "[MFA Observer] ⚠ Timeout atingido (" +
          MFA_CONFIG.timeoutMs / 1000 +
          "s). Observer desconectado sem detectar sucesso do MFA.",
      );
    }, MFA_CONFIG.timeoutMs);

    console.log(
      "[MFA Observer] Timeout de segurança: " +
        MFA_CONFIG.timeoutMs / 1000 +
        "s",
    );

    return observer;
  }

  // ─── PONTO DE ENTRADA PÚBLICO ──────────────────────────────────────────────

  /**
   * Inicializa o módulo de detecção de sucesso do MFA.
   *
   * Chame esta função uma vez, após o componente OTP estar montado.
   * Totalmente independente de initOtp6Digits.
   *
   * Exemplo de uso:
   *   initMfaSuccessObserver();
   */
  function initMfaSuccessObserver() {
    console.log(
      "[MFA Observer] ════════════════════════════════════════════════",
    );
    console.log("[MFA Observer] initMfaSuccessObserver() chamado.");
    console.log("[MFA Observer] Config:", JSON.stringify(MFA_CONFIG, null, 2));

    // Estado compartilhado entre as funções — garante disparo único
    var state = { fired: false };

    // Checa imediatamente caso o B2C já tenha validado antes do observer subir
    console.log("[MFA Observer] Checando estado inicial do DOM...");
    if (checkMfaValidated()) {
      console.log(
        "[MFA Observer] MFA já validado no estado inicial. Disparando click...",
      );
      triggerContinue(state);
      return;
    }

    console.log("[MFA Observer] MFA ainda não validado. Iniciando observer...");
    startObserver(state);
  }

  // Expõe globalmente para ser chamado de qualquer contexto
  window.initMfaSuccessObserver = initMfaSuccessObserver;
})();
