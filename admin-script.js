document.addEventListener('DOMContentLoaded', () => {
    // --- CACHE DOM ELEMENTS ---
    const adminUsername = document.getElementById('admin-username');
    const logoutBtn = document.getElementById('logout-btn');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const statsContainer = document.getElementById('stats-container');
    const consolidatedTableBody = document.getElementById('consolidated-table-body');
    const reportMonthYear = document.getElementById('report-month-year');
    const userDetailsModal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
    const createUserModal = new bootstrap.Modal(document.getElementById('createUserModal'));
    const changePasswordModal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    const usersTableBody = document.getElementById('users-table-body');
    const createUserBtn = document.getElementById('create-user-btn');
    const createUserError = document.getElementById('create-user-error');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePasswordError = document.getElementById('change-password-error');
    const securityWarning = document.getElementById('security-warning');

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let allUsers = [];
    let consolidatedData = [];
    let allResources = [];

    // --- AUTHENTICATION ---
    const checkAdminAuth = async () => {
        try {
            const response = await fetch('/api/auth-status');
            const result = await response.json();
            if (result.authenticated && result.user.role === 'admin') {
                currentUser = result.user;
                adminUsername.textContent = currentUser.username;
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

    // --- DATA LOADING ---
    const loadConsolidatedData = async () => {
        const month = monthSelect.value;
        const year = yearSelect.value;

        try {
            const [usersRes, consolidatedRes, resourcesRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch(`/api/admin/monthly-data?month=${month}&year=${year}`),
                fetch(`/api/admin/all-resources?month=${month}&year=${year}`)
            ]);

            allUsers = await usersRes.json();
            consolidatedData = await consolidatedRes.json();
            allResources = await resourcesRes.json();

            renderStats();
            renderConsolidatedTable();
            renderUsersTable();
            checkSecurityStatus();
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    // --- SECURITY FUNCTIONS ---
    const checkSecurityStatus = async () => {
        try {
            const response = await fetch('/api/admin/security-status');
            const status = await response.json();
            
            if (status.isDefaultPassword) {
                securityWarning.style.display = 'block';
            } else {
                securityWarning.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to check security status:', error);
        }
    };

    const checkPasswordStrength = (password) => {
        const strengthIndicator = document.getElementById('password-strength');
        if (!password) {
            strengthIndicator.textContent = 'Not set';
            strengthIndicator.className = '';
            return;
        }
        
        let score = 0;
        if (password.length >= 8) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        if (score < 2) {
            strengthIndicator.textContent = 'Weak';
            strengthIndicator.className = 'text-danger';
        } else if (score < 4) {
            strengthIndicator.textContent = 'Medium';
            strengthIndicator.className = 'text-warning';
        } else {
            strengthIndicator.textContent = 'Strong';
            strengthIndicator.className = 'text-success';
        }
    };

    const changeAdminPassword = async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-admin-password').value;
        const confirmPassword = document.getElementById('confirm-admin-password').value;

        changePasswordError.style.display = 'none';

        if (!currentPassword || !newPassword || !confirmPassword) {
            changePasswordError.textContent = 'Please fill in all fields';
            changePasswordError.style.display = 'block';
            return;
        }

        if (newPassword !== confirmPassword) {
            changePasswordError.textContent = 'New passwords do not match';
            changePasswordError.style.display = 'block';
            return;
        }

        if (newPassword.length < 8) {
            changePasswordError.textContent = 'New password must be at least 8 characters long';
            changePasswordError.style.display = 'block';
            return;
        }

        if (newPassword === currentPassword) {
            changePasswordError.textContent = 'New password must be different from current password';
            changePasswordError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json();

            if (result.success) {
                changePasswordModal.hide();
                document.getElementById('change-password-form').reset();
                securityWarning.style.display = 'none';
                alert('Password changed successfully! Your admin account is now more secure.');
            } else {
                changePasswordError.textContent = result.error || 'Failed to change password';
                changePasswordError.style.display = 'block';
            }
        } catch (error) {
            changePasswordError.textContent = 'Connection error. Please try again.';
            changePasswordError.style.display = 'block';
        }
    };

    // --- RENDER FUNCTIONS ---
    const renderStats = () => {
        const totalUsers = allUsers.length;
        const totalResources = allResources.length; // Use month-specific resources
        const totalLeaves = consolidatedData.reduce((sum, user) => sum + user.total_leaves, 0);
        const totalBillableDays = consolidatedData.reduce((sum, user) => sum + user.billable_days, 0);

        statsContainer.innerHTML = `
            <div class="col-md-3">
                <div class="stats-card">
                    <h3>${totalUsers}</h3>
                    <p class="mb-0">👥 Total Users</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card">
                    <h3>${totalResources}</h3>
                    <p class="mb-0">🏢 Total Resources</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card">
                    <h3>${totalLeaves}</h3>
                    <p class="mb-0">🏖️ Total Leave Days</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stats-card">
                    <h3>${totalBillableDays}</h3>
                    <p class="mb-0">💼 Total Billable Days</p>
                </div>
            </div>
        `;
    };

    const renderConsolidatedTable = () => {
        reportMonthYear.textContent = `${monthSelect.options[monthSelect.selectedIndex].text} ${yearSelect.value}`;
        consolidatedTableBody.innerHTML = '';

        if (consolidatedData.length === 0) {
            consolidatedTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No data available for the selected month.</td></tr>';
            return;
        }

        consolidatedData.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${user.working_days}</td>
                <td>${user.total_resources}</td>
                <td>${user.total_leaves}</td>
                <td><strong>${user.billable_days}</strong></td>
                <td>
                    <button type="button" class="btn btn-sm btn-primary" onclick="viewUserDetails(${user.user_id})">
                        View Details
                    </button>
                </td>
            `;
            consolidatedTableBody.appendChild(row);
        });
    };

    // --- USER DETAILS ---
    window.viewUserDetails = async (userId) => {
        const month = monthSelect.value;
        const year = yearSelect.value;

        try {
            const response = await fetch(`/api/admin/user-details/${userId}?month=${month}&year=${year}`);
            const userDetails = await response.json();

            document.getElementById('modal-username').textContent = userDetails.user.username;
            
            let detailsHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Working Days: <span class="badge bg-primary">${userDetails.working_days}</span></h6>
                    </div>
                    <div class="col-md-6">
                        <h6>Total Resources: <span class="badge bg-info">${userDetails.resources.length}</span></h6>
                    </div>
                </div>
                <hr>
                <h6>Resources & Leave Details:</h6>
            `;

            if (userDetails.resources.length === 0) {
                detailsHTML += '<p class="text-muted">No resources added by this user.</p>';
            } else {
                detailsHTML += '<div class="table-responsive"><table class="table table-sm">';
                detailsHTML += '<thead><tr><th>Resource Name</th><th>Leave Days</th><th>Billable Days</th></tr></thead><tbody>';
                
                userDetails.resources.forEach(resource => {
                    const leave = userDetails.leaves.find(l => l.resource_id === resource.id);
                    const leaveDays = leave ? leave.leave_days : 0;
                    const billableDays = userDetails.working_days - leaveDays;
                    
                    detailsHTML += `
                        <tr>
                            <td>${resource.name}</td>
                            <td>${leaveDays}</td>
                            <td><strong>${billableDays}</strong></td>
                        </tr>
                    `;
                });
                
                detailsHTML += '</tbody></table></div>';
            }

            document.getElementById('user-details-content').innerHTML = detailsHTML;
            userDetailsModal.show();
        } catch (error) {
            console.error('Failed to load user details:', error);
            alert('Failed to load user details');
        }
    };

    // --- INITIALIZATION ---
    const initializePage = () => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const currentYear = new Date().getFullYear();
        
        months.forEach((month, index) => {
            monthSelect.add(new Option(month, index));
        });
        
        for (let i = currentYear - 5; i <= currentYear + 5; i++) {
            yearSelect.add(new Option(i, i));
        }
        
        const currentDate = new Date();
        monthSelect.value = currentDate.getMonth();
        yearSelect.value = currentDate.getFullYear();

        loadConsolidatedData();
    };

    // --- USER MANAGEMENT ---
    const renderUsersTable = () => {
        usersTableBody.innerHTML = '';

        if (allUsers.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No employees found.</td></tr>';
            return;
        }

        allUsers.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td><span class="badge bg-primary">${user.role}</span></td>
                <td><span class="badge bg-success">Active</span></td>
                <td>
                    <button type="button" class="btn btn-sm btn-primary me-2" onclick="viewUserDetails(${user.id})">
                        View Details
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                        Delete
                    </button>
                </td>
            `;
            usersTableBody.appendChild(row);
        });
    };

    const createNewUser = async () => {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        createUserError.style.display = 'none';

        if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
            createUserError.textContent = 'Please fill in all fields';
            createUserError.style.display = 'block';
            return;
        }

        if (password !== confirmPassword) {
            createUserError.textContent = 'Passwords do not match';
            createUserError.style.display = 'block';
            return;
        }

        if (password.length < 4) {
            createUserError.textContent = 'Password must be at least 4 characters long';
            createUserError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password })
            });

            const result = await response.json();

            if (result.success) {
                createUserModal.hide();
                document.getElementById('create-user-form').reset();
                loadConsolidatedData();
                alert(`Employee account created successfully!\n\nUsername: ${result.user.username}\nPassword: ${password}\n\nPlease share these credentials with the new employee.`);
            } else {
                createUserError.textContent = result.error || 'Failed to create user';
                createUserError.style.display = 'block';
            }
        } catch (error) {
            createUserError.textContent = 'Connection error. Please try again.';
            createUserError.style.display = 'block';
        }
    };

    window.deleteUser = async (userId, username) => {
        if (confirm(`Are you sure you want to delete the employee account for "${username}"?\n\nThis will permanently delete:\n- The user account\n- All their resources\n- All their monthly data\n\nThis action cannot be undone.`)) {
            try {
                const response = await fetch(`/api/admin/delete-user/${userId}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (result.success) {
                    loadConsolidatedData();
                    alert(`Employee account "${username}" has been deleted successfully.`);
                } else {
                    alert('Failed to delete user: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Connection error. Please try again.');
            }
        }
    };

    // --- EVENT LISTENERS ---
    changePasswordBtn.addEventListener('click', changeAdminPassword);
    
    document.getElementById('new-admin-password').addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
    });
    
    document.getElementById('change-password-form').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            changeAdminPassword();
        }
    });
    
    document.getElementById('changePasswordModal').addEventListener('hidden.bs.modal', () => {
        changePasswordError.style.display = 'none';
        document.getElementById('change-password-form').reset();
        checkPasswordStrength('');
    });
    
    createUserBtn.addEventListener('click', createNewUser);
    
    document.getElementById('create-user-form').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createNewUser();
        }
    });
    
    document.getElementById('createUserModal').addEventListener('hidden.bs.modal', () => {
        createUserError.style.display = 'none';
        document.getElementById('create-user-form').reset();
    });
    
    monthSelect.addEventListener('change', loadConsolidatedData);
    yearSelect.addEventListener('change', loadConsolidatedData);

    // --- INITIALIZE ---
    const init = async () => {
        const isAdmin = await checkAdminAuth();
        if (isAdmin) {
            initializePage();
        }
    };
    
    init();
});
