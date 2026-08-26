// PAYAMAKE Admin JavaScript

const API_BASE = "";

const PREAUTH_KEY = "payamake_preauth_token";
const MFA_METHODS_KEY = "payamake_mfa_methods";
const MFA_METHOD_ID_KEY = "payamake_mfa_method_id";
const MFA_CHALLENGE_ID_KEY = "payamake_mfa_challenge_id";


/* =========================================================
   ROUTER
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (
        path.endsWith("/admin/login.html") ||
        path.endsWith("/admin/login")
    ) {
        initLogin();
        return;
    }

    if (
        path.endsWith("/admin/mfa-setup.html") ||
        path.endsWith("/admin/mfa-setup")
    ) {
        initMfaSetup();
        return;
    }

    if (
        path.endsWith("/admin/mfa.html") ||
        path.endsWith("/admin/mfa")
    ) {
        initMfa();
        return;
    }

    if (
        path.endsWith("/admin/") ||
        path.endsWith("/admin/index.html")
    ) {
        initDashboard();
    }
});


/* =========================================================
   STORAGE
========================================================= */

function getPreauthToken() {
    return sessionStorage.getItem(PREAUTH_KEY) || "";
}


function savePreauthToken(token) {
    if (!token) {
        return false;
    }

    sessionStorage.setItem(
        PREAUTH_KEY,
        String(token)
    );

    return true;
}


function clearPreauthToken() {
    sessionStorage.removeItem(PREAUTH_KEY);
}


function saveMfaMethods(methods) {
    if (!Array.isArray(methods)) {
        return;
    }

    sessionStorage.setItem(
        MFA_METHODS_KEY,
        JSON.stringify(methods)
    );
}


function loadStoredMfaMethods() {
    try {
        const raw =
            sessionStorage.getItem(MFA_METHODS_KEY);

        if (!raw) {
            return [];
        }

        const methods = JSON.parse(raw);

        return Array.isArray(methods)
            ? methods
            : [];

    } catch {
        return [];
    }
}


function clearMfaState() {
    sessionStorage.removeItem(
        MFA_METHODS_KEY
    );

    sessionStorage.removeItem(
        MFA_METHOD_ID_KEY
    );

    sessionStorage.removeItem(
        MFA_CHALLENGE_ID_KEY
    );
}


/* =========================================================
   HELPERS
========================================================= */

function showMessage(
    element,
    message,
    type = ""
) {
    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.className =
        "form-message";

    if (type) {
        element.classList.add(type);
    }
}


function normalizeMfaCode(value) {
    const raw =
        String(value || "")
            .trim()
            .toUpperCase();

    if (/^\d{6}$/.test(raw)) {
        return raw;
    }

    return raw
        .replace(/\s+/g, "")
        .slice(0, 9);
}


async function parseResponse(response) {
    try {
        return await response.json();
    } catch {
        return {
            success: false,
            error: "پاسخ نامعتبر از سرور دریافت شد."
        };
    }
}


async function postJson(
    path,
    data
) {
    const response =
        await fetch(
            `${API_BASE}${path}`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(data)
            }
        );

    const result =
        await parseResponse(response);

    return {
        ok: response.ok,
        status: response.status,
        ...result
    };
}


async function getJson(path) {
    const response =
        await fetch(
            `${API_BASE}${path}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

    const result =
        await parseResponse(response);

    return {
        ok: response.ok,
        status: response.status,
        ...result
    };
}


function setButtonLoading(
    button,
    loadingText
) {
    if (!button) {
        return;
    }

    button.disabled = true;

    if (!button.dataset.originalText) {
        button.dataset.originalText =
            button.textContent;
    }

    button.textContent =
        loadingText;
}


function restoreButton(button) {
    if (!button) {
        return;
    }

    button.disabled = false;

    if (button.dataset.originalText) {
        button.textContent =
            button.dataset.originalText;

        delete button.dataset.originalText;
    }
}


function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   LOGIN
========================================================= */

function initLogin() {
    const form =
        document.getElementById(
            "loginForm"
        );

    const message =
        document.getElementById(
            "loginMessage"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const emailInput =
                form.elements.email;

            const passwordInput =
                form.elements.password;

            const button =
                form.querySelector(
                    "button[type='submit']"
                );

            const email =
                String(
                    emailInput?.value || ""
                )
                    .trim()
                    .toLowerCase();

            const password =
                String(
                    passwordInput?.value || ""
                );

            if (!email || !password) {
                showMessage(
                    message,
                    "ایمیل و رمز عبور را وارد کنید."
                );

                return;
            }

            setButtonLoading(
                button,
                "در حال ورود..."
            );

            showMessage(
                message,
                ""
            );

            try {
                const result =
                    await postJson(
                        "/api/admin/login",
                        {
                            email,
                            password
                        }
                    );

                /*
                 * Successful login without MFA.
                 */
                if (
                    result.success === true &&
                    result.authenticated === true
                ) {
                    clearPreauthToken();
                    clearMfaState();

                    window.location.href =
                        "/admin/";

                    return;
                }

                /*
                 * MFA is already configured.
                 *
                 * Current backend response:
                 *
                 * authenticated: false
                 * mfaRequired: true
                 * preauthToken
                 * methods[]
                 */
                if (
                    result.mfaRequired === true &&
                    result.preauthToken
                ) {
                    savePreauthToken(
                        result.preauthToken
                    );

                    saveMfaMethods(
                        result.methods || []
                    );

                    sessionStorage.removeItem(
                        MFA_METHOD_ID_KEY
                    );

                    sessionStorage.removeItem(
                        MFA_CHALLENGE_ID_KEY
                    );

                    window.location.href =
                        "/admin/mfa.html";

                    return;
                }

                /*
                 * First login / MFA setup required.
                 */
                if (
                    result.code ===
                        "MFA_SETUP_REQUIRED" &&
                    result.preauthToken
                ) {
                    savePreauthToken(
                        result.preauthToken
                    );

                    sessionStorage.removeItem(
                        MFA_METHODS_KEY
                    );

                    sessionStorage.removeItem(
                        MFA_METHOD_ID_KEY
                    );

                    sessionStorage.removeItem(
                        MFA_CHALLENGE_ID_KEY
                    );

                    window.location.href =
                        "/admin/mfa-setup.html";

                    return;
                }

                showMessage(
                    message,
                    result.error ||
                        "ورود انجام نشد."
                );

            } catch (error) {
                console.error(error);

                showMessage(
                    message,
                    "ارتباط با سرور برقرار نشد."
                );

            } finally {
                restoreButton(button);
            }
        }
    );
}


/* =========================================================
   MFA SETUP
========================================================= */

function initMfaSetup() {
    const preauthToken =
        getPreauthToken();

    if (!preauthToken) {
        window.location.href =
            "/admin/login.html";

        return;
    }

    /*
     * These IDs match the current
     * admin/mfa-setup.html.
     */
    const message =
        document.getElementById(
            "setupMessage"
        );

    const content =
        document.getElementById(
            "setupContent"
        );

    const secretElement =
        document.getElementById(
            "secret"
        );

    const accountElement =
        document.getElementById(
            "account"
        );

    const issuerElement =
        document.getElementById(
            "issuer"
        );

    const codeInput =
        document.getElementById(
            "code"
        );

    const button =
        document.getElementById(
            "verifySetupButton"
        );

    if (
        !message ||
        !content ||
        !secretElement ||
        !accountElement ||
        !issuerElement ||
        !codeInput ||
        !button
    ) {
        return;
    }

    /*
     * Create MFA setup immediately.
     */
    createMfaSetup({
        preauthToken,
        message,
        content,
        secretElement,
        accountElement,
        issuerElement,
        button
    });

    /*
     * Verify setup button.
     *
     * Current HTML uses a button[type=button],
     * therefore we listen directly to click.
     */
    button.addEventListener(
        "click",
        async () => {
            const methodId =
                Number(
                    button.dataset.methodId || 0
                );

            const code =
                normalizeMfaCode(codeInput.value);

            if (!methodId) {
                showMessage(
                    message,
                    "اطلاعات راه‌اندازی MFA آماده نیست."
                );

                return;
            }

            const isTotpCode =
                /^\d{6}$/.test(code);

            const isRecoveryCode =
                /^[A-F0-9]{4}-[A-F0-9]{4}$/.test(code);

            if (!isTotpCode && !isRecoveryCode) {
                showMessage(
                    message,
                    "کد ۶ رقمی یا کد بازیابی XXXX-XXXX را وارد کنید."
                );

                codeInput.focus();

                return;
            }

            setButtonLoading(
                button,
                "در حال تأیید..."
            );

            showMessage(
                message,
                ""
            );

            try {
                const result =
                    await postJson(
                        "/api/admin/mfa/setup/verify",
                        {
                            preauthToken,
                            methodId,
                            code
                        }
                    );

                if (
                    result.success === true &&
                    result.verified === true
                ) {
                    const recoveryCodes =
                        Array.isArray(result.recoveryCodes)
                            ? result.recoveryCodes
                            : [];

                    if (!recoveryCodes.length) {
                        showMessage(
                            message,
                            "MFA فعال شد، اما کدهای بازیابی از سرور دریافت نشد.",
                            "error"
                        );

                        return;
                    }

                    showRecoveryCodes(recoveryCodes);

                    clearPreauthToken();
                    clearMfaState();

                    return;
                }

                showMessage(
                    message,
                    result.error ||
                        "تأیید MFA انجام نشد."
                );

            } catch (error) {
                console.error(error);

                showMessage(
                    message,
                    "ارتباط با سرور برقرار نشد."
                );

            } finally {
                restoreButton(button);
            }
        }
    );

    /*
     * Keep code numeric.
     */
    codeInput.addEventListener(
        "input",
        () => {
            codeInput.value =
                normalizeMfaCode(codeInput.value);
        }
    );
}


function showRecoveryCodes(recoveryCodes) {
    const section =
        document.getElementById(
            "recoveryCodesSection"
        );

    const list =
        document.getElementById(
            "recoveryCodesList"
        );

    const copyButton =
        document.getElementById(
            "copyRecoveryCodesButton"
        );

    const continueButton =
        document.getElementById(
            "continueAfterRecoveryButton"
        );

    if (
        !section ||
        !list ||
        !copyButton ||
        !continueButton
    ) {
        throw new Error(
            "Recovery codes UI elements not found"
        );
    }

    list.innerHTML = "";

    recoveryCodes.forEach((code) => {
        const item =
            document.createElement("div");

        item.className =
            "recovery-code";

        item.textContent =
            String(code);

        list.appendChild(item);
    });

    const text =
        recoveryCodes.join("\n");

    copyButton.onclick =
        async () => {
            try {
                await navigator.clipboard.writeText(
                    text
                );

                copyButton.textContent =
                    "کپی شد";

                setTimeout(() => {
                    copyButton.textContent =
                        "کپی کدها";
                }, 1500);

            } catch {
                window.prompt(
                    "کدهای بازیابی را کپی کنید:",
                    text
                );
            }
        };

    continueButton.onclick =
        () => {
            window.location.href =
                "/admin/login.html";
        };

    section.hidden = false;

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


async function createMfaSetup({
    preauthToken,
    message,
    content,
    secretElement,
    accountElement,
    issuerElement,
    button
}) {
    setButtonLoading(
        button,
        "در حال آماده‌سازی..."
    );

    showMessage(
        message,
        "در حال ایجاد تنظیمات MFA...",
        "info"
    );

    try {
        const result =
            await postJson(
                "/api/admin/mfa/setup",
                {
                    preauthToken
                }
            );

        if (!result.success) {
            showMessage(
                message,
                result.error ||
                    "راه‌اندازی MFA انجام نشد."
            );

            if (
                result.status === 401 ||
                result.status === 403
            ) {
                clearPreauthToken();
                clearMfaState();

                setTimeout(() => {
                    window.location.href =
                        "/admin/login.html";
                }, 800);
            }

            return;
        }

        /*
         * Store method ID on the button.
         *
         * mfa-setup.html does not have
         * a hidden methodId input.
         */
        button.dataset.methodId =
            String(
                result.methodId || ""
            );

        /*
         * Current HTML uses input elements,
         * so .value is required.
         */
        secretElement.value =
            result.secret || "";

        accountElement.value =
            result.account || "";

        issuerElement.value =
            result.issuer ||
            "PAYAMAKE";

        content.hidden = false;

        showMessage(
            message,
            "Secret را در Google Authenticator اضافه کنید و سپس کد ۶ رقمی را وارد کنید.",
            "info"
        );

        /*
         * Focus the verification code.
         */
        codeInputFocus();

    } catch (error) {
        console.error(error);

        showMessage(
            message,
            "ارتباط با سرور برقرار نشد."
        );

    } finally {
        restoreButton(button);
    }
}


function codeInputFocus() {
    const codeInput =
        document.getElementById("code");

    if (codeInput) {
        codeInput.focus();
    }
}


/* =========================================================
   MFA LOGIN
========================================================= */

async function initMfa() {
    const preauthToken =
        getPreauthToken();

    if (!preauthToken) {
        window.location.href =
            "/admin/login.html";

        return;
    }

    const form =
        document.getElementById(
            "mfaForm"
        );

    const message =
        document.getElementById(
            "mfaMessage"
        );

    const methodsContainer =
        document.getElementById(
            "mfaMethods"
        );

    const methodIdInput =
        document.getElementById(
            "mfaMethodId"
        );

    const challengeIdInput =
        document.getElementById(
            "mfaChallengeId"
        );

    const codeInput =
        document.getElementById(
            "mfaCode"
        );

    if (
        !form ||
        !message ||
        !methodsContainer ||
        !methodIdInput ||
        !challengeIdInput ||
        !codeInput
    ) {
        return;
    }

    const button =
        form.querySelector(
            "button[type='submit']"
        );

    const methods =
        loadStoredMfaMethods();

    if (!methods.length) {
        showMessage(
            message,
            "روش احراز هویت در دسترس نیست. لطفاً دوباره وارد شوید."
        );

        clearPreauthToken();
        clearMfaState();

        setTimeout(() => {
            window.location.href =
                "/admin/login.html";
        }, 900);

        return;
    }

    /*
     * Render available MFA methods.
     */
    renderMfaMethods(
        methodsContainer,
        methods,
        methodIdInput,
        challengeIdInput,
        message
    );

    /*
     * Restore previously selected method
     * or use primary method.
     */
    const savedMethodId =
        Number(
            sessionStorage.getItem(
                MFA_METHOD_ID_KEY
            ) || 0
        );

    const selected =
        methods.find(
            (method) =>
                Number(method.id) ===
                savedMethodId
        ) ||
        methods.find(
            (method) =>
                Boolean(method.primary)
        ) ||
        methods[0];

    if (!selected) {
        showMessage(
            message,
            "روش احراز هویت معتبر پیدا نشد."
        );

        return;
    }

    const selectedButton =
        methodsContainer.querySelector(
            `[data-method-id="${CSS.escape(
                String(selected.id)
            )}"]`
        );

    selectMfaMethod(
        methodsContainer,
        selectedButton,
        methodIdInput,
        selected.id
    );

    await prepareSelectedMfaMethod({
        preauthToken,
        selected,
        methodIdInput,
        challengeIdInput,
        message
    });

    /*
     * MFA verification.
     */
    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const methodId =
                Number(
                    methodIdInput.value || 0
                );

            const code =
                normalizeMfaCode(codeInput.value);

            if (!methodId) {
                showMessage(
                    message,
                    "روش احراز هویت را انتخاب کنید."
                );

                return;
            }

            const isTotpCode =
                /^\d{6}$/.test(code);

            const isRecoveryCode =
                /^[A-F0-9]{4}-[A-F0-9]{4}$/.test(code);

            if (!isTotpCode && !isRecoveryCode) {
                showMessage(
                    message,
                    "کد ۶ رقمی یا کد بازیابی XXXX-XXXX را وارد کنید."
                );

                codeInput.focus();

                return;
            }

            const selectedMethod =
                methods.find(
                    (method) =>
                        Number(method.id) ===
                        methodId
                );

            if (
                selectedMethod &&
                selectedMethod.type !== "totp" &&
                !challengeIdInput.value
            ) {
                showMessage(
                    message,
                    "ابتدا درخواست ارسال کد را انجام دهید."
                );

                return;
            }

            setButtonLoading(
                button,
                "در حال تأیید..."
            );

            showMessage(
                message,
                ""
            );

            try {
                const result =
                    await postJson(
                        "/api/admin/mfa/verify",
                        {
                            preauthToken,
                            methodId,
                            challengeId:
                                challengeIdInput.value ||
                                "",
                            code
                        }
                    );

                if (
                    result.success === true &&
                    result.authenticated === true
                ) {
                    clearPreauthToken();
                    clearMfaState();

                    window.location.href =
                        "/admin/";

                    return;
                }

                showMessage(
                    message,
                    result.error ||
                        "کد احراز هویت صحیح نیست."
                );

            } catch (error) {
                console.error(error);

                showMessage(
                    message,
                    "ارتباط با سرور برقرار نشد."
                );

            } finally {
                restoreButton(button);
            }
        }
    );

    /*
     * Keep MFA code numeric.
     */
    codeInput.addEventListener(
        "input",
        () => {
            codeInput.value =
                normalizeMfaCode(codeInput.value);
        }
    );
}


/* =========================================================
   MFA METHODS UI
========================================================= */

function renderMfaMethods(
    container,
    methods,
    methodIdInput,
    challengeIdInput,
    message
) {
    container.innerHTML = "";

    methods.forEach((method) => {
        const button =
            document.createElement(
                "button"
            );

        button.type = "button";
        button.className =
            "mfa-method";

        button.dataset.methodId =
            String(method.id);

        const title =
            method.type === "totp"
                ? "Google Authenticator"
                : method.type === "sms_otp"
                    ? "پیامک"
                    : "ایمیل";

        const destination =
            method.destination ||
            "";

        button.innerHTML = `
            <span class="mfa-method-icon">
                ${
                    method.type === "totp"
                        ? "◈"
                        : "✉"
                }
            </span>

            <span class="mfa-method-content">
                <strong>
                    ${escapeHtml(title)}
                </strong>

                ${
                    destination
                        ? `
                            <small>
                                ${escapeHtml(
                                    destination
                                )}
                            </small>
                        `
                        : ""
                }
            </span>
        `;

        button.addEventListener(
            "click",
            async () => {
                selectMfaMethod(
                    container,
                    button,
                    methodIdInput,
                    method.id
                );

                await prepareSelectedMfaMethod({
                    preauthToken:
                        getPreauthToken(),
                    selected: method,
                    methodIdInput,
                    challengeIdInput,
                    message
                });
            }
        );

        container.appendChild(
            button
        );
    });
}


function selectMfaMethod(
    container,
    button,
    methodIdInput,
    methodId
) {
    if (container) {
        container
            .querySelectorAll(
                ".mfa-method"
            )
            .forEach((item) => {
                item.classList.remove(
                    "active"
                );
            });
    }

    if (button) {
        button.classList.add(
            "active"
        );
    }

    if (methodIdInput) {
        methodIdInput.value =
            String(methodId);
    }

    sessionStorage.setItem(
        MFA_METHOD_ID_KEY,
        String(methodId)
    );
}


/* =========================================================
   PREPARE MFA METHOD
========================================================= */

async function prepareSelectedMfaMethod({
    preauthToken,
    selected,
    methodIdInput,
    challengeIdInput,
    message
}) {
    if (!selected) {
        return;
    }

    if (methodIdInput) {
        methodIdInput.value =
            String(selected.id);
    }

    /*
     * TOTP:
     * No OTP request is required.
     */
    if (
        selected.type === "totp"
    ) {
        if (challengeIdInput) {
            challengeIdInput.value =
                "";
        }

        sessionStorage.removeItem(
            MFA_CHALLENGE_ID_KEY
        );

        showMessage(
            message,
            "کد نمایش‌داده‌شده در Google Authenticator را وارد کنید.",
            "info"
        );

        return;
    }

    /*
     * SMS / Email OTP.
     */
    if (challengeIdInput) {
        challengeIdInput.value =
            "";
    }

    sessionStorage.removeItem(
        MFA_CHALLENGE_ID_KEY
    );

    showMessage(
        message,
        "در حال ارسال کد تأیید...",
        "info"
    );

    try {
        const result =
            await postJson(
                "/api/admin/mfa/send",
                {
                    preauthToken,
                    methodId:
                        selected.id
                }
            );

        if (
            result.success &&
            result.challengeId
        ) {
            if (challengeIdInput) {
                challengeIdInput.value =
                    result.challengeId;
            }

            sessionStorage.setItem(
                MFA_CHALLENGE_ID_KEY,
                result.challengeId
            );

            showMessage(
                message,
                "کد تأیید برای شما ارسال شد.",
                "info"
            );

            return;
        }

        showMessage(
            message,
            result.error ||
                "ارسال کد تأیید انجام نشد."
        );

    } catch (error) {
        console.error(error);

        showMessage(
            message,
            "ارتباط با سرور برقرار نشد."
        );
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

async function initDashboard() {
    const adminName =
        document.getElementById(
            "adminName"
        );

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    try {
        const result =
            await getJson(
                "/api/admin/me"
            );

        if (
            !result.ok ||
            !result.authenticated
        ) {
            window.location.href =
                "/admin/login.html";

            return;
        }

        document.body.classList.remove(
            "admin-auth-pending"
        );

        if (
            result.admin &&
            adminName
        ) {
            adminName.textContent =
                result.admin.fullName ||
                result.admin.full_name ||
                result.admin.email ||
                "مدیر سیستم";
        }

        if (logoutButton) {
            logoutButton.addEventListener(
                "click",
                logout
            );
        }

    } catch (error) {
        console.error(error);

        window.location.href =
            "/admin/login.html";
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
    const button =
        document.getElementById(
            "logoutButton"
        );

    if (button) {
        setButtonLoading(
            button,
            "در حال خروج..."
        );
    }

    try {
        await postJson(
            "/api/admin/logout",
            {}
        );
    } catch (error) {
        console.error(error);
    }

    clearPreauthToken();
    clearMfaState();

    window.location.href =
        "/admin/login.html";
}