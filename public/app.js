'use strict';

(function () {
  const form = document.getElementById('signup-form');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  const terms = document.getElementById('terms');
  const submitBtn = document.getElementById('submit-btn');
  const formError = document.getElementById('form-error');
  const strengthBar = document.getElementById('strength-bar');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MIN_LENGTH = 8;

  function setError(input, message) {
    const el = document.getElementById(input.id + '-error');
    el.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateEmail() {
    const value = email.value.trim();
    if (!value) return setError(email, 'Ingresá tu email.'), false;
    if (!EMAIL_RE.test(value)) return setError(email, 'Revisá el formato del email (ej: nombre@gmail.com).'), false;
    setError(email, '');
    return true;
  }

  function validatePassword() {
    if (!password.value) return setError(password, 'Creá una contraseña.'), false;
    if (password.value.length < MIN_LENGTH) {
      return setError(password, 'La contraseña debe tener al menos ' + MIN_LENGTH + ' caracteres.'), false;
    }
    setError(password, '');
    return true;
  }

  function validateConfirm() {
    if (!confirm.value) return setError(confirm, 'Repetí tu contraseña.'), false;
    if (confirm.value !== password.value) return setError(confirm, 'Las contraseñas no coinciden.'), false;
    setError(confirm, '');
    return true;
  }

  function validateTerms() {
    if (!terms.checked) return setError(terms, 'Necesitás aceptar los términos para continuar.'), false;
    setError(terms, '');
    return true;
  }

  function passwordStrength(value) {
    if (!value) return 0;
    let score = 0;
    if (value.length >= MIN_LENGTH) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
    return Math.max(1, score);
  }

  // Validación en vivo: solo después de que el campo fue tocado.
  email.addEventListener('blur', () => email.value && validateEmail());
  email.addEventListener('input', () => email.getAttribute('aria-invalid') === 'true' && validateEmail());

  password.addEventListener('input', () => {
    strengthBar.dataset.level = passwordStrength(password.value);
    if (password.getAttribute('aria-invalid') === 'true') validatePassword();
    if (confirm.value) validateConfirm();
  });
  password.addEventListener('blur', () => password.value && validatePassword());

  confirm.addEventListener('input', () => confirm.getAttribute('aria-invalid') === 'true' && validateConfirm());
  confirm.addEventListener('blur', () => confirm.value && validateConfirm());

  terms.addEventListener('change', validateTerms);

  document.querySelectorAll('.password__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Ver';
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';

    const checks = [validateEmail(), validatePassword(), validateConfirm(), validateTerms()];
    if (checks.includes(false)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          password: password.value,
          aceptaTerminos: terms.checked,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        if (response.status === 409) {
          setError(email, data.error);
          email.focus();
        } else {
          formError.textContent = data.error || 'No pudimos crear tu cuenta. Probá de nuevo.';
        }
        return;
      }

      document.getElementById('success-email').textContent = email.value.trim().toLowerCase();
      document.getElementById('form-view').hidden = true;
      document.getElementById('success-view').hidden = false;
      form.reset();
    } catch {
      formError.textContent = 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.';
    } finally {
      setLoading(false);
    }
  });
})();
