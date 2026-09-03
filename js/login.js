(function() {
    const SUPABASE_URL = 'https://xesofmxgvsnpldrjtxur.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CbaMneYIuVFIvUNiTtTgHQ_ouUMzmI5';
    const AUTH_SESSION_KEY = 'u2_auth_session_v1';
    const AUTH_LOGOUT_EVENT_KEY = 'u2_auth_logout_event_v1';
    const OLD_ACTIVATION_KEY = 'u2_activation_granted_v1';
    const AUTH_REQUEST_TIMEOUT_MS = 12000;
    const AUTH_RECOVERY_DELAYS = [1000, 3000, 8000, 15000, 30000];
    const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
    const ACTIVATION_CODE_PATTERN = /^U2(?:-[A-Z2-9]{4}){4}$/;

    let dom = null;
    let mode = 'signin';
    let currentSession = null;
    let loginFocusTimer = null;
    let authRecoveryPromise = null;
    let authRecoveryTimer = null;
    let authRecoveryAttempt = 0;

    function collectDom() {
        return {
            screen: document.getElementById('u2-login-screen'),
            title: document.getElementById('u2-login-title'),
            form: document.getElementById('u2-login-form'),
            signinMode: document.getElementById('u2-login-mode-signin'),
            registerMode: document.getElementById('u2-login-mode-register'),
            accountField: document.getElementById('u2-login-account-field'),
            accountInput: document.getElementById('u2-login-account'),
            passwordField: document.getElementById('u2-login-password-field'),
            passwordInput: document.getElementById('u2-login-password'),
            passwordToggle: document.getElementById('u2-login-password-toggle'),
            confirmField: document.getElementById('u2-login-confirm-field'),
            confirmInput: document.getElementById('u2-login-confirm'),
            codeField: document.getElementById('u2-login-code-field'),
            codeInput: document.getElementById('u2-login-code'),
            noticeRow: document.getElementById('u2-login-notice-row'),
            noticeAccepted: document.getElementById('u2-login-notice-accepted'),
            noticeLink: document.getElementById('u2-login-notice-link'),
            error: document.getElementById('u2-login-error'),
            submit: document.getElementById('u2-login-submit'),
            submitLabel: document.getElementById('u2-login-submit-label')
        };
    }

    function normalizeUsername(value) {
        return String(value || '').trim().toLowerCase();
    }

    function normalizeActivationCode(value) {
        const raw = String(value || '').trim().toUpperCase();
        const compact = raw.replace(/[^A-Z0-9]/g, '');
        if (!compact.startsWith('U2')) return raw;
        const groups = compact.slice(2, 18).match(/.{1,4}/g) || [];
        return ['U2', ...groups].join('-');
    }

    function setLoginLocked(locked) {
        document.body?.classList.toggle('u2-login-locked', !!locked);
    }

    function showLoginScreen(options = {}) {
        if (!dom?.screen) return;
        clearTimeout(loginFocusTimer);
        dom.screen.classList.remove('is-checking', 'is-hidden');
        dom.screen.inert = false;
        dom.screen.setAttribute('aria-hidden', 'false');
        setLoginLocked(true);
        if (options.focus !== false) {
            loginFocusTimer = setTimeout(() => {
                if (!dom?.screen?.classList.contains('is-hidden')) dom.accountInput?.focus();
            }, 80);
        }
    }

    function hideLoginScreen() {
        if (!dom?.screen) return;
        clearTimeout(loginFocusTimer);
        if (dom.screen.contains(document.activeElement)) document.activeElement.blur();
        dom.screen.inert = true;
        dom.screen.setAttribute('aria-hidden', 'true');
        dom.screen.classList.remove('is-checking');
        dom.screen.classList.add('is-hidden');
        setLoginLocked(false);
        window.dispatchEvent(new CustomEvent('u2:main-interface-ready', {
            detail: { username: currentSession?.username || readSession()?.username || '' }
        }));
    }

    function readSession() {
        try {
            const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.access_token || !parsed?.refresh_token) return null;
            return parsed;
        } catch {
            return null;
        }
    }

    function saveSession(session, username = '') {
        currentSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: Number(session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600)),
            token_type: session.token_type || 'bearer',
            username: normalizeUsername(username || currentSession?.username)
        };
        window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentSession));
        window.localStorage.removeItem(OLD_ACTIVATION_KEY);
        return currentSession;
    }

    function clearSession() {
        currentSession = null;
        window.localStorage.removeItem(AUTH_SESSION_KEY);
        window.localStorage.removeItem(OLD_ACTIVATION_KEY);
    }

    async function request(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs) || AUTH_REQUEST_TIMEOUT_MS);
        const headers = {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        let response;
        try {
            response = await fetch(`${SUPABASE_URL}${path}`, {
                method: options.method || 'POST',
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                signal: controller.signal
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                const timeoutError = new Error('AUTH_REQUEST_TIMEOUT');
                timeoutError.code = 'AUTH_REQUEST_TIMEOUT';
                timeoutError.cause = error;
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
        let payload = {};
        try {
            payload = await response.json();
        } catch {
            payload = {};
        }
        if (!response.ok) {
            const error = new Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || `HTTP ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }
        return payload;
    }

    function internalEmail(username) {
        return `${normalizeUsername(username)}@accounts.u2phone.invalid`;
    }

    async function signIn(username, password) {
        const data = await request('/auth/v1/token?grant_type=password', {
            body: { email: internalEmail(username), password }
        });
        return saveSession(data, username);
    }

    async function refreshSession(session) {
        try {
            const data = await request('/auth/v1/token?grant_type=refresh_token', {
                body: { refresh_token: session.refresh_token }
            });
            return saveSession(data, session.username);
        } catch (error) {
            error.authPhase = 'refresh';
            throw error;
        }
    }

    async function ensureFreshSession(session) {
        const expiresAt = Number(session?.expires_at || 0);
        if (expiresAt > Math.floor(Date.now() / 1000) + 60) return session;
        return refreshSession(session);
    }

    async function checkAccountAccess(session) {
        return request('/rest/v1/rpc/u2_check_device', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: { p_device_hash: null }
        });
    }

    async function authorizeSession(session) {
        const freshSession = await ensureFreshSession(session);
        const state = await checkAccountAccess(freshSession);
        if (!state?.allowed) {
            const error = new Error(state?.reason || 'AUTHORIZATION_FAILED');
            error.code = state?.reason || 'AUTHORIZATION_FAILED';
            throw error;
        }
        if (state.username && state.username !== freshSession.username) saveSession(freshSession, state.username);
        return state;
    }

    function isPermanentSessionError(error) {
        const code = error?.code || error?.payload?.code || '';
        if (['ACCOUNT_DISABLED', 'ACCOUNT_EXPIRED', 'PROFILE_MISSING', 'NOT_AUTHENTICATED'].includes(code)) return true;
        if (Number(error?.status) === 401) return true;
        return error?.authPhase === 'refresh' && Number(error?.status) === 400;
    }

    function cancelAuthRecovery() {
        clearTimeout(authRecoveryTimer);
        authRecoveryTimer = null;
        authRecoveryAttempt = 0;
    }

    function scheduleAuthRecovery() {
        if (authRecoveryTimer || !(currentSession || readSession())) return;
        const delay = AUTH_RECOVERY_DELAYS[Math.min(authRecoveryAttempt, AUTH_RECOVERY_DELAYS.length - 1)];
        authRecoveryAttempt += 1;
        authRecoveryTimer = setTimeout(() => {
            authRecoveryTimer = null;
            if (document.visibilityState === 'hidden') return;
            recoverSession({ releaseGateOnTransient: false });
        }, delay);
    }

    async function recoverSession(options = {}) {
        if (authRecoveryPromise) return authRecoveryPromise;
        const session = currentSession || readSession();
        if (!session) {
            if (options.showLoginWhenMissing !== false) showLoginScreen({ focus: false });
            return false;
        }

        currentSession = session;
        authRecoveryPromise = (async () => {
            try {
                await authorizeSession(currentSession || session);
                cancelAuthRecovery();
                hideLoginScreen();
                return true;
            } catch (error) {
                if (isPermanentSessionError(error)) {
                    cancelAuthRecovery();
                    clearSession();
                    showLoginScreen({ focus: false });
                    setMode('signin', { focus: false });
                    setMessage(messageForError(error));
                    return false;
                }

                currentSession = readSession() || currentSession || session;
                if (options.releaseGateOnTransient) hideLoginScreen();
                scheduleAuthRecovery();
                console.warn('[auth] Temporary authorization failure; session retained:', error);
                return false;
            } finally {
                authRecoveryPromise = null;
            }
        })();
        return authRecoveryPromise;
    }

    function setBusy(busy) {
        [
            dom?.submit,
            dom?.signinMode,
            dom?.registerMode,
            dom?.accountInput,
            dom?.passwordInput,
            dom?.confirmInput,
            dom?.codeInput,
            dom?.noticeAccepted
        ].forEach((element) => {
            if (element) element.disabled = !!busy;
        });
    }

    function setMessage(message = '', success = false) {
        if (!dom?.error) return;
        dom.error.textContent = message;
        dom.error.classList.toggle('is-success', !!success);
    }

    function clearValidation() {
        [dom?.accountField, dom?.passwordField, dom?.confirmField, dom?.codeField, dom?.noticeRow]
            .forEach((element) => element?.classList.remove('is-invalid'));
        setMessage('');
    }

    function setMode(nextMode, options = {}) {
        mode = nextMode === 'register' ? 'register' : 'signin';
        const registering = mode === 'register';
        dom?.screen?.classList.toggle('is-register-mode', registering);
        dom?.signinMode?.classList.toggle('is-active', !registering);
        dom?.registerMode?.classList.toggle('is-active', registering);
        dom?.signinMode?.setAttribute('aria-selected', String(!registering));
        dom?.registerMode?.setAttribute('aria-selected', String(registering));
        if (dom?.title) dom.title.textContent = registering ? '创建账号' : '欢迎回来';
        if (dom?.submitLabel) dom.submitLabel.textContent = registering ? '注册并进入' : '登录';
        if (dom?.passwordInput) dom.passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
        clearValidation();
        clearTimeout(loginFocusTimer);
        if (options.focus !== false) {
            loginFocusTimer = setTimeout(() => {
                if (!dom?.screen?.classList.contains('is-hidden')) dom.accountInput?.focus();
            }, 30);
        }
    }

    function messageForError(error) {
        const code = error?.code || error?.payload?.code || '';
        const messages = {
            USERNAME_INVALID: '账号需为 3–24 位小写字母、数字或下划线。',
            USERNAME_TAKEN: '这个账号已经被注册。',
            PASSWORD_INVALID: '密码长度需为 6–72 位。',
            CODE_INVALID: '激活码无效，请检查后重试。',
            CODE_DISABLED: '这个激活码已被停用。',
            CODE_USED: '这个激活码已经被使用。',
            CODE_EXPIRED: '这个激活码已经过期。',
            ACCOUNT_DISABLED: '账号已被停用，请联系管理员。',
            ACCOUNT_EXPIRED: '账号已到期，请联系管理员。',
            PROFILE_MISSING: '账号尚未完成激活，请联系管理员。',
            NOT_AUTHENTICATED: '登录状态已失效，请重新登录。',
            AUTH_REQUEST_TIMEOUT: '授权服务响应较慢，请稍后重试。'
        };
        if (messages[code]) return messages[code];
        if (error?.status === 400 && /credentials|login/i.test(error.message || '')) return '账号或密码错误。';
        if (/Invalid login credentials/i.test(error?.message || '')) return '账号或密码错误。';
        if (error instanceof TypeError || /fetch|network|failed/i.test(error?.message || '')) return '无法连接授权服务，请检查网络后重试。';
        return '操作失败，请稍后重试。';
    }

    function validateInputs() {
        const username = normalizeUsername(dom?.accountInput?.value);
        const password = String(dom?.passwordInput?.value || '');
        if (dom?.accountInput) dom.accountInput.value = username;

        if (!USERNAME_PATTERN.test(username)) {
            dom?.accountField?.classList.add('is-invalid');
            dom?.accountInput?.focus();
            throw Object.assign(new Error('USERNAME_INVALID'), { code: 'USERNAME_INVALID' });
        }
        if (password.length < 6 || password.length > 72) {
            dom?.passwordField?.classList.add('is-invalid');
            dom?.passwordInput?.focus();
            throw Object.assign(new Error('PASSWORD_INVALID'), { code: 'PASSWORD_INVALID' });
        }

        if (mode !== 'register') return { username, password };

        const confirmPassword = String(dom?.confirmInput?.value || '');
        const activationCode = normalizeActivationCode(dom?.codeInput?.value);
        if (dom?.codeInput) dom.codeInput.value = activationCode;

        if (password !== confirmPassword) {
            dom?.confirmField?.classList.add('is-invalid');
            dom?.confirmInput?.focus();
            throw Object.assign(new Error('PASSWORD_MISMATCH'), { code: 'PASSWORD_MISMATCH' });
        }
        if (!ACTIVATION_CODE_PATTERN.test(activationCode)) {
            dom?.codeField?.classList.add('is-invalid');
            dom?.codeInput?.focus();
            throw Object.assign(new Error('CODE_INVALID'), { code: 'CODE_INVALID' });
        }
        if (!dom?.noticeAccepted?.checked) {
            dom?.noticeRow?.classList.add('is-invalid');
            dom?.noticeAccepted?.focus();
            throw Object.assign(new Error('NOTICE_REQUIRED'), { code: 'NOTICE_REQUIRED' });
        }
        return { username, password, activationCode };
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearValidation();

        let values;
        try {
            values = validateInputs();
        } catch (error) {
            if (error?.code === 'PASSWORD_MISMATCH') setMessage('两次输入的密码不一致。');
            else if (error?.code === 'NOTICE_REQUIRED') setMessage('请先阅读并勾选《JW入住声明》。');
            else setMessage(messageForError(error));
            return;
        }

        setBusy(true);
        try {
            if (mode === 'register') {
                const result = await request('/functions/v1/register-account', {
                    body: values
                });
                if (!result?.ok) throw Object.assign(new Error(result?.code || 'REGISTRATION_FAILED'), { code: result?.code });
                if (result.session) {
                    saveSession(result.session, values.username);
                } else {
                    await signIn(values.username, values.password);
                }
            } else {
                await signIn(values.username, values.password);
            }

            await authorizeSession(currentSession);
            if (dom?.passwordInput) dom.passwordInput.value = '';
            if (dom?.confirmInput) dom.confirmInput.value = '';
            if (dom?.codeInput) dom.codeInput.value = '';
            if (dom?.noticeAccepted) dom.noticeAccepted.checked = false;
            hideLoginScreen();
        } catch (error) {
            console.error('[auth] Authentication failed:', error);
            clearSession();
            setMessage(messageForError(error));
        } finally {
            setBusy(false);
        }
    }

    async function logout() {
        const session = currentSession || readSession();
        clearSession();
        window.localStorage.setItem(AUTH_LOGOUT_EVENT_KEY, JSON.stringify({ at: Date.now() }));
        showLoginScreen();
        setMode('signin');
        if (!session?.access_token) return;
        try {
            await request('/auth/v1/logout?scope=local', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: {}
            });
        } catch (error) {
            console.warn('[auth] Remote sign out failed:', error);
        }
    }

    function bindEvents() {
        dom?.form?.addEventListener('submit', handleSubmit);
        dom?.signinMode?.addEventListener('click', () => setMode('signin'));
        dom?.registerMode?.addEventListener('click', () => setMode('register'));
        dom?.passwordToggle?.addEventListener('click', () => {
            const reveal = dom.passwordInput?.type === 'password';
            if (dom.passwordInput) dom.passwordInput.type = reveal ? 'text' : 'password';
            const icon = dom.passwordToggle.querySelector?.('i');
            icon?.classList.toggle('fa-eye', !reveal);
            icon?.classList.toggle('fa-eye-slash', reveal);
            dom.passwordToggle.setAttribute('aria-label', reveal ? '隐藏密码' : '显示密码');
        });
        dom?.accountInput?.addEventListener('input', () => {
            dom.accountField?.classList.remove('is-invalid');
            setMessage('');
        });
        dom?.codeInput?.addEventListener('input', () => {
            const normalized = normalizeActivationCode(dom.codeInput.value);
            if (normalized !== dom.codeInput.value) dom.codeInput.value = normalized;
            dom.codeField?.classList.remove('is-invalid');
            setMessage('');
        });
        [dom?.passwordInput, dom?.confirmInput].forEach((input) => input?.addEventListener('input', () => setMessage('')));
        dom?.noticeAccepted?.addEventListener('change', () => {
            dom.noticeRow?.classList.remove('is-invalid');
            setMessage('');
        });
        dom?.noticeLink?.addEventListener('click', () => window.u2AboutInfoModal?.open('disclaimer'));
        window.addEventListener('storage', (event) => {
            if (event.key === AUTH_SESSION_KEY && event.newValue) {
                currentSession = readSession();
                return;
            }
            if (event.key === AUTH_LOGOUT_EVENT_KEY && event.newValue) {
                cancelAuthRecovery();
                clearSession();
                showLoginScreen();
                setMode('signin');
            }
        });

        const resumeAuth = () => {
            if (!(currentSession || readSession())) return;
            recoverSession({ releaseGateOnTransient: false, showLoginWhenMissing: false });
        };
        window.addEventListener('pageshow', resumeAuth);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') resumeAuth();
        });
    }

    async function initializeAuthGate() {
        dom = collectDom();
        if (!dom.screen || !dom.form || !dom.accountInput || !dom.passwordInput) {
            window.markAuthGateSettled?.();
            return;
        }

        setLoginLocked(true);
        bindEvents();
        setMode('signin', { focus: false });

        try {
            const savedSession = readSession();
            if (!savedSession) {
                showLoginScreen();
                return;
            }
            currentSession = savedSession;
            await recoverSession({ releaseGateOnTransient: true });
        } finally {
            window.markAuthGateSettled?.();
        }
    }

    window.u2Auth = {
        logout,
        getSession: () => currentSession || readSession(),
        isLoggedIn: () => !!(currentSession || readSession()),
        showLoginScreen,
        hideLoginScreen
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthGate, { once: true });
    } else {
        initializeAuthGate();
    }
})();
