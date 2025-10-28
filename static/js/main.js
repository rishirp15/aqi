// Global toast function
window.showToast = (message, isError = false) => {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error("Toast element not found!");
        return;
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
};

document.addEventListener('DOMContentLoaded', () => {
    // Intercept all forms *except* the profile update form
    document.querySelectorAll('form:not([action="/profile"])').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Ignore predictor forms, they are handled by predictor.js
            if (form.id === 'predict-form' || form.id === 'forecast-form') {
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: new FormData(form),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                }

                if (data.success) {
                    showToast(data.message || 'Success!');
                    if (data.redirect) {
                        setTimeout(() => window.location.href = data.redirect, 1000);
                    }
                } else {
                    throw new Error(data.error || 'An unknown error occurred.');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                showToast(error.message, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    });
});