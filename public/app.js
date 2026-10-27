'use strict';

(function () {
  const form = document.getElementById('login-form');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const terms = document.getElementById('terms');
  const submitBtn = document.getElementById('submit-btn');
  const formError = document.getElementById('form-error');

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
    if (!password.value) return setError(password, 'Ingresá tu contraseña.'), false;
    if (password.value.length < MIN_LENGTH) {
      return setError(password, 'La contraseña debe tener al menos ' + MIN_LENGTH + ' caracteres.'), false;
    }
    setError(password, '');
    return true;
  }

  function validateTerms() {
    if (!terms.checked) return setError(terms, 'Necesitás aceptar los términos para continuar.'), false;
    setError(terms, '');
    return true;
  }

  // Validación en vivo: solo después de que el campo fue tocado.
  email.addEventListener('blur', () => email.value && validateEmail());
  email.addEventListener('input', () => email.getAttribute('aria-invalid') === 'true' && validateEmail());

  password.addEventListener('input', () => password.getAttribute('aria-invalid') === 'true' && validatePassword());
  password.addEventListener('blur', () => password.value && validatePassword());

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

  function showSuccess(isNew, address) {
    document.getElementById('success-email').textContent = address;
    if (!isNew) {
      document.getElementById('success-title').textContent = '¡Hola de nuevo!';
      document.getElementById('success-text').firstChild.textContent = 'Ingresaste a tu Plan de Yoga Facial con el email ';
    }
    document.getElementById('form-view').hidden = true;
    document.getElementById('success-view').hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';

    const checks = [validateEmail(), validatePassword(), validateTerms()];
    if (checks.includes(false)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ingresar', {
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
        formError.textContent = data.error || 'No pudimos iniciar tu sesión. Probá de nuevo.';
        if (response.status === 401) {
          password.value = '';
          password.focus();
        }
        return;
      }

      showSuccess(data.nuevo, email.value.trim().toLowerCase());
      form.reset();
    } catch {
      formError.textContent = 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.';
    } finally {
      setLoading(false);
    }
  });
})();
