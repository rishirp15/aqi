document.addEventListener('DOMContentLoaded', () => {
    
    // --- Form Validation Logic ---
    // This will only run if a form with the ID 'signup-form' is on the current page.
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        initializeSignupFormValidation();
    }

    // This will only run if a form with the ID 'signin-form' is on the current page.
    const signinForm = document.getElementById('signin-form');
    if (signinForm) {
        initializeSigninFormValidation();
    }

    // --- Dashboard Chart Initialization ---
    // This will only run if an element with the ID 'dashboard-page' is on the current page.
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) {
        // Check if Chart.js is loaded before initializing charts
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded. Make sure to include the script tag on the dashboard page.');
        } else {
            initializeCharts();
        }
    }
});


// --- Helper Functions for Form Validation ---

// Helper function to show an error
const showError = (input, message) => {
    const errorElement = document.getElementById(`${input.id}-error`);
    input.classList.add('border-red-500');
    input.classList.remove('border-gray-300');
    if (errorElement) errorElement.textContent = message;
};

// Helper function for terms checkbox
const showTermsError = (message) => {
    const errorElement = document.getElementById('terms-error');
    if (errorElement) errorElement.textContent = message;
}

// Helper function to clear an error
const clearError = (input) => {
    const errorElement = document.getElementById(`${input.id}-error`);
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-300');
    if (errorElement) errorElement.textContent = '';
};

const clearTermsError = () => {
    const errorElement = document.getElementById('terms-error');
    if (errorElement) errorElement.textContent = '';
}

// Helper function to validate email format
const isValidEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};


// --- Sign Up Form Validation ---
function initializeSignupFormValidation() {
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        const name = document.getElementById('signup-name');
        const email = document.getElementById('signup-email');
        const password = document.getElementById('signup-password');
        const confirmPassword = document.getElementById('signup-confirm-password');
        const terms = document.getElementById('terms');
        
        // Clear previous errors
        [name, email, password, confirmPassword].forEach(clearError);
        clearTermsError();

        // Name validation
        if (name.value.trim() === '') {
            showError(name, 'Full name is required.');
            isValid = false;
        }

        // Email validation
        if (email.value.trim() === '') {
            showError(email, 'Email is required.');
            isValid = false;
        } else if (!isValidEmail(email.value)) {
            showError(email, 'Please enter a valid email address.');
            isValid = false;
        }

        // Password validation
        const passwordValue = password.value;
        let passwordIsValid = true;
        let passwordErrorMessage = '';

        if (passwordValue.trim() === '') {
            passwordErrorMessage = 'Password is required.';
            passwordIsValid = false;
        } else if (passwordValue.length < 8) {
            passwordErrorMessage = 'Password must be at least 8 characters long.';
            passwordIsValid = false;
        } else if (!/[A-Z]/.test(passwordValue)) {
            passwordErrorMessage = 'Password must contain at least one uppercase letter.';
            passwordIsValid = false;
        } else if (!/\d/.test(passwordValue)) {
            passwordErrorMessage = 'Password must contain at least one digit.';
            passwordIsValid = false;
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordValue)) {
            passwordErrorMessage = 'Password must contain at least one special character.';
            passwordIsValid = false;
        }

        if (!passwordIsValid) {
            showError(password, passwordErrorMessage);
            isValid = false;
        }

        // Confirm password validation
        if (confirmPassword.value.trim() === '') {
            showError(confirmPassword, 'Please confirm your password.');
            isValid = false;
        } else if (password.value !== confirmPassword.value) {
            showError(confirmPassword, 'Passwords do not match.');
            isValid = false;
        }
        
        // Terms validation
        if (!terms.checked) {
            showTermsError('You must agree to the terms and conditions.');
            isValid = false;
        }

        if (isValid) {
            console.log('Sign up form is valid. Redirecting to dashboard.');
            // In a real app, you would send data to a server here.
            // For this example, we'll just redirect to the dashboard.
            window.location.href = 'dashboard.html';
        }
    });
}


// --- Sign In Form Validation ---
function initializeSigninFormValidation() {
    const signinForm = document.getElementById('signin-form');
    signinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        const email = document.getElementById('signin-email');
        const password = document.getElementById('signin-password');
        
        // Clear previous errors
        [email, password].forEach(clearError);

        // Email validation
        if (email.value.trim() === '') {
            showError(email, 'Email is required.');
            isValid = false;
        } else if (!isValidEmail(email.value)) {
            showError(email, 'Please enter a valid email address.');
            isValid = false;
        }

        // Password validation
        if (password.value.trim() === '') {
            showError(password, 'Password is required.');
            isValid = false;
        }

        if (isValid) {
            console.log('Sign in form is valid. Redirecting to dashboard.');
            // In a real app, you would verify credentials with a server here.
            // For this example, we'll just redirect to the dashboard.
            window.location.href = 'dashboard.html';
        }
    });
}


// --- Chart.js Initialization ---
function initializeCharts() {
    // 1. Weekly AQI Trend Chart
    const weeklyAqiCtx = document.getElementById('weeklyAqiChart').getContext('2d');
    new Chart(weeklyAqiCtx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'AQI',
                data: [75, 90, 110, 125, 105, 85, 95],
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                fill: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });

    // 2. Today's Hourly AQI Chart
    const hourlyAqiCtx = document.getElementById('hourlyAqiChart').getContext('2d');
    new Chart(hourlyAqiCtx, {
        type: 'line',
        data: {
            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            datasets: [{
                label: 'AQI',
                data: [80, 75, 90, 115, 125, 120, 110, 100],
                borderColor: '#4ade80',
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });

    // 3. Pollutant Breakdown Pie Chart
    const pollutantPieCtx = document.getElementById('pollutantPieChart').getContext('2d');
    new Chart(pollutantPieCtx, {
        type: 'pie',
        data: {
            labels: ['PM2.5', 'PM10', 'O3', 'NO2', 'SO2', 'CO'],
            datasets: [{
                data: [42, 35, 10, 5, 5, 3],
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6', '#64748b'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });

    // 4. Weekly Pollutant Levels Bar Chart
    const weeklyPollutantCtx = document.getElementById('weeklyPollutantChart').getContext('2d');
    new Chart(weeklyPollutantCtx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                {
                    label: 'PM2.5',
                    data: [40, 45, 55, 60, 50, 42, 48],
                    backgroundColor: '#ef4444',
                },
                {
                    label: 'PM10',
                    data: [80, 90, 100, 110, 95, 85, 92],
                    backgroundColor: '#f97316',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}
