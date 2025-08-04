document.addEventListener('DOMContentLoaded', () => {
    // --- CACHE DOM ELEMENTS ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const monthlyWorkingDaysInput = document.getElementById('monthly-working-days');
    const resourceLeavesContainer = document.getElementById('resource-leaves-container');
    const summaryTableBody = document.getElementById('summary-table-body');
    const summaryMonthYear = document.getElementById('summary-month-year');
    const updateAllBtn = document.getElementById('update-all-btn');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const userSecurityWarning = document.getElementById('user-security-warning');
    const userChangePasswordBtn = document.getElementById('user-change-password-btn');
    const userChangePasswordError = document.getElementById('user-change-password-error');

    // --- STATE MANAGEMENT ---
    let allResources = [];
    let monthlyLeaves = [];
    let currentUser = null;

    // --- AUTHENTICATION ---
    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/auth-status');
            const result = await response.json();
            if (result.authenticated) {
                currentUser = result.user;
                usernameDisplay.textContent = currentUser.username;
                return true;
            } else {
                window.location.href = '/login';
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login';
            return false;
        }
    };

    // Logout functionality
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = '/login';
        }
    });

    // --- USER SECURITY FUNCTIONS ---
    const checkUserSecurityStatus = async () => {
        try {
            const response = await fetch('/api/user/security-status');
            const status = await response.json();
            
            if (status.mustChangePassword) {
                userSecurityWarning.style.display = 'block';
            } else {
                userSecurityWarning.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to check user security status:', error);
        }
    };

    const checkUserPasswordStrength = (password) => {
        const strengthIndicator = document.getElementById('user-password-strength');
        if (!password) {
            strengthIndicator.textContent = 'Not set';
            strengthIndicator.className = '';
            return;
        }
        
        let score = 0;
        if (password.length >= 6) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        if (score < 2) {
            strengthIndicator.textContent = 'Weak';
            strengthIndicator.className = 'text-danger';
        } else if (score < 3) {
            strengthIndicator.textContent = 'Fair';
            strengthIndicator.className = 'text-warning';
        } else {
            strengthIndicator.textContent = 'Good';
            strengthIndicator.className = 'text-success';
        }
    };

    const changeUserPassword = async () => {
        const currentPassword = document.getElementById('user-current-password').value;
        const newPassword = document.getElementById('user-new-password').value;
        const confirmPassword = document.getElementById('user-confirm-password').value;

        userChangePasswordError.style.display = 'none';

        if (!currentPassword || !newPassword || !confirmPassword) {
            userChangePasswordError.textContent = 'Please fill in all fields';
            userChangePasswordError.style.display = 'block';
            return;
        }

        if (newPassword !== confirmPassword) {
            userChangePasswordError.textContent = 'New passwords do not match';
            userChangePasswordError.style.display = 'block';
            return;
        }

        if (newPassword.length < 6) {
            userChangePasswordError.textContent = 'New password must be at least 6 characters long';
            userChangePasswordError.style.display = 'block';
            return;
        }

        if (newPassword === currentPassword) {
            userChangePasswordError.textContent = 'New password must be different from current password';
            userChangePasswordError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json();

            if (result.success) {
                // Hide modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('userChangePasswordModal'));
                modal.hide();
                document.getElementById('user-change-password-form').reset();
                userSecurityWarning.style.display = 'none';
                alert('Password changed successfully! Your account is now more secure.');
            } else {
                userChangePasswordError.textContent = result.error || 'Failed to change password';
                userChangePasswordError.style.display = 'block';
            }
        } catch (error) {
            userChangePasswordError.textContent = 'Connection error. Please try again.';
            userChangePasswordError.style.display = 'block';
        }
    };

    // --- RENDER FUNCTIONS ---
    const renderSummaryTable = () => {
        summaryMonthYear.textContent = `${monthSelect.options[monthSelect.selectedIndex].text} ${yearSelect.value}`;
        summaryTableBody.innerHTML = '';
        
        // Only show summary if user has entered working days
        const workingDaysValue = parseInt(monthlyWorkingDaysInput.value, 10);
        if (!workingDaysValue || workingDaysValue === 0) {
            summaryTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Enter working days to see summary.</td></tr>';
            return;
        }
        
        // Since resources are now month-specific, just show all resources for this month
        const resourcesToShow = allResources;
        
        if (resourcesToShow.length === 0) {
            summaryTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No resources for this month.</td></tr>';
            return;
        }
        
        resourcesToShow.forEach(resource => {
            const leaveEntry = monthlyLeaves.find(l => l.resource_id === resource.id);
            const leaveDays = leaveEntry ? leaveEntry.leave_days : 0;
            const workingDays = workingDaysValue; // Use actual entered value, no default
            const billableDays = Math.max(0, workingDays - leaveDays);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${resource.name}</strong></td>
                <td>${workingDays}</td>
                <td>${leaveDays}</td>
                <td><strong>${billableDays}</strong></td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm remove-btn" data-id="${resource.id}">
                        Remove
                    </button>
                </td>
            `;
            summaryTableBody.appendChild(row);
        });
    };

    const renderResourceLeaves = () => {
        resourceLeavesContainer.innerHTML = '';
        
        // Only show resources if user has entered working days
        const workingDaysValue = parseInt(monthlyWorkingDaysInput.value, 10);
        if (!workingDaysValue || workingDaysValue === 0) {
            resourceLeavesContainer.innerHTML = '<p class="text-center">Enter working days above to manage leave data.</p>';
            renderSummaryTable();
            return;
        }
        
        // Show resources in the leave input section
        if (allResources.length === 0) {
            resourceLeavesContainer.innerHTML = '<p class="text-center">No resources for this month.</p>';
            renderSummaryTable();
            return;
        }
        
        allResources.forEach(resource => {
            const leaveEntry = monthlyLeaves.find(l => l.resource_id === resource.id);
            const leaveDays = leaveEntry ? leaveEntry.leave_days : '';
            const resourceDiv = document.createElement('div');
            resourceDiv.className = 'form-group row align-items-center';
            resourceDiv.innerHTML = `
                <label class="col-sm-3 col-form-label">${resource.name}</label>
                <div class="col-sm-9">
                    <input type="number" class="form-control leaves-input" value="${leaveDays}" data-resource-id="${resource.id}" min="0" placeholder="Enter leave days">
                </div>
            `;
            resourceLeavesContainer.appendChild(resourceDiv);
        });
        renderSummaryTable();
    };

    // --- DATA & API LOGIC ---
    const loadDataForSelectedMonth = async () => {
        const month = monthSelect.value;
        const year = yearSelect.value;

        try {
            const [monthlyRes, resourcesRes] = await Promise.all([
                fetch(`/api/monthly-data?month=${month}&year=${year}`),
                fetch(`/api/resources?month=${month}&year=${year}`)
            ]);

            const monthlyData = await monthlyRes.json();
            allResources = await resourcesRes.json();
            monthlyLeaves = monthlyData.leaves;
            monthlyWorkingDaysInput.value = monthlyData.working_days || '';

        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            renderResourceLeaves();
        }
    };

    const initializePage = () => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const currentYear = new Date().getFullYear();
        months.forEach((month, index) => { monthSelect.add(new Option(month, index)); });
        for (let i = currentYear - 5; i <= currentYear + 5; i++) { yearSelect.add(new Option(i, i)); }
        
        const currentDate = new Date();
        monthSelect.value = currentDate.getMonth();
        yearSelect.value = currentDate.getFullYear();

        loadDataForSelectedMonth();
    };

    // --- EVENT LISTENERS ---
    // Resources are now auto-created on login with username
    
    summaryTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const resourceId = parseInt(e.target.dataset.id);
            if (confirm('Are you sure you want to remove this resource? This will remove all their leave data as well.')) {
                const response = await fetch(`/api/resources/${resourceId}`, { method: 'DELETE' });
                if (response.ok) {
                    loadDataForSelectedMonth();
                } else {
                    alert('Failed to remove resource.');
                }
            }
        }
    });

    updateAllBtn.addEventListener('click', async () => {
        const leaves = [];
        resourceLeavesContainer.querySelectorAll('.leaves-input').forEach(input => {
            leaves.push({ resource_id: parseInt(input.dataset.resourceId), leave_days: parseInt(input.value) || 0 });
        });

        const dataToSave = {
            month: monthSelect.value,
            year: yearSelect.value,
            working_days: parseInt(monthlyWorkingDaysInput.value),
            leaves: leaves
        };

        const response = await fetch('/api/monthly-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) });
        if (response.ok) {
            alert('Data updated successfully!');
            loadDataForSelectedMonth();
        } else {
            alert('Failed to update data.');
        }
    });

    monthlyWorkingDaysInput.addEventListener('input', renderSummaryTable);
    resourceLeavesContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('leaves-input')) {
            renderSummaryTable();
        }
    });
    monthSelect.addEventListener('change', loadDataForSelectedMonth);
    yearSelect.addEventListener('change', loadDataForSelectedMonth);
    
    // Update interface when working days are entered
    monthlyWorkingDaysInput.addEventListener('input', () => {
        renderResourceLeaves();
    });

    // --- INITIALIZE ---
    // --- USER PASSWORD EVENT LISTENERS ---
    userChangePasswordBtn.addEventListener('click', changeUserPassword);
    
    document.getElementById('user-new-password').addEventListener('input', (e) => {
        checkUserPasswordStrength(e.target.value);
    });
    
    document.getElementById('user-change-password-form').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            changeUserPassword();
        }
    });
    
    document.getElementById('userChangePasswordModal').addEventListener('hidden.bs.modal', () => {
        userChangePasswordError.style.display = 'none';
        document.getElementById('user-change-password-form').reset();
        checkUserPasswordStrength('');
    });

    const init = async () => {
        const isAuthenticated = await checkAuthStatus();
        if (isAuthenticated) {
            initializePage();
            checkUserSecurityStatus();
        }
    };
    
    init();
});
