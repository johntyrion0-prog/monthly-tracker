const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const alasql = require('alasql');

const app = express();
const port = process.env.PORT || 8000;

// --- Middleware Setup ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add json parser for API requests

// Session middleware for user authentication
app.use(session({
    secret: 'monthly-tracker-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
};

// --- Main Routes ---
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        if (req.session.userRole === 'admin') {
            res.sendFile(path.join(__dirname, 'admin.html'));
        } else {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});

app.get('/admin', (req, res) => {
    if (req.session && req.session.userId && req.session.userRole === 'admin') {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// --- Authentication API Routes ---
// Registration disabled for security - only pre-created employee accounts allowed
app.post('/api/register', (req, res) => {
    res.status(403).json({ error: 'Registration is disabled. Please contact your administrator for access.' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if user exists and password matches
    const user = alasql('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (user.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    req.session.userId = user[0].id;
    req.session.username = user[0].username;
    req.session.userRole = user[0].role || 'user';
    
    // Auto-create resource with username for regular users (not admin) - for current month only
    if (user[0].role !== 'admin') {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth(); // 0-based (0 = January)
        const currentYear = currentDate.getFullYear();
        
        // Check if user already has a resource with their username for current month
        const existingResource = alasql('SELECT * FROM resources WHERE user_id = ? AND name = ? AND month = ? AND year = ?', [user[0].id, username, currentMonth, currentYear]);
        if (existingResource.length === 0) {
            // Create resource with username for current month/year only (no default data)
            const resourceId = (alasql('SELECT MAX(id) as id FROM resources')[0].id || 0) + 1;
            alasql('INSERT INTO resources VALUES (?, ?, ?, ?, ?)', [resourceId, username, user[0].id, currentMonth, currentYear]);
            console.log(`Auto-created resource '${username}' for user ${username} (${currentMonth + 1}/${currentYear})`);
        }
    }
    
    res.json({ success: true, user: { id: user[0].id, username: user[0].username, role: user[0].role || 'user' } });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth-status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, user: { id: req.session.userId, username: req.session.username, role: req.session.userRole || 'user' } });
    } else {
        res.json({ authenticated: false });
    }
});

// --- API Routes ---

// Resources - User-specific and Month-specific
app.get('/api/resources', requireAuth, (req, res) => {
    const { month, year } = req.query;
    if (month && year) {
        // Get resources for specific month/year
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        let resources = alasql('SELECT * FROM resources WHERE user_id = ? AND month = ? AND year = ?', [req.session.userId, monthInt, yearInt]);
        
        // Auto-create resource with username if none exists for this month (for regular users only)
        if (resources.length === 0 && req.session.userRole !== 'admin') {
            const resourceId = (alasql('SELECT MAX(id) as id FROM resources')[0].id || 0) + 1;
            alasql('INSERT INTO resources VALUES (?, ?, ?, ?, ?)', [resourceId, req.session.username, req.session.userId, monthInt, yearInt]);
            console.log(`Auto-created resource '${req.session.username}' for month ${monthInt + 1}/${yearInt}`);
            // Re-fetch resources after creation
            resources = alasql('SELECT * FROM resources WHERE user_id = ? AND month = ? AND year = ?', [req.session.userId, monthInt, yearInt]);
        }
        
        res.json(resources);
    } else {
        // Get all resources for user (for admin purposes)
        const resources = alasql('SELECT * FROM resources WHERE user_id = ?', [req.session.userId]);
        res.json(resources);
    }
});

app.post('/api/resources', requireAuth, (req, res) => {
    try {
        const { name, month, year } = req.body;
        if (!name || !month || !year) {
            return res.status(400).send('Resource name, month, and year are required.');
        }
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        const id = (alasql('SELECT MAX(id) as id FROM resources')[0].id || 0) + 1;
        alasql('INSERT INTO resources VALUES (?, ?, ?, ?, ?)', [id, name, req.session.userId, monthInt, yearInt]);
        res.json({ id, name, user_id: req.session.userId, month: monthInt, year: yearInt });
    } catch (err) {
        console.error('Error adding resource:', err);
        res.status(500).send('Server error while adding resource.');
    }
});

app.delete('/api/resources/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const resourceId = parseInt(id);
    
    // Check if resource belongs to the current user
    const resource = alasql('SELECT * FROM resources WHERE id = ? AND user_id = ?', [resourceId, req.session.userId]);
    if (resource.length === 0) {
        return res.status(403).json({ error: 'Access denied: You can only delete your own resources' });
    }
    
    alasql('DELETE FROM resources WHERE id = ? AND user_id = ?', [resourceId, req.session.userId]);
    // Also remove related leave entries
    alasql('DELETE FROM leaves WHERE resource_id = ? AND user_id = ?', [resourceId, req.session.userId]);
    res.status(204).send();
});

// Monthly Data (Working Days and Leaves) - User-specific
app.get('/api/monthly-data', requireAuth, (req, res) => {
    const { month, year } = req.query;
    // Correctly parse month and year to ensure accurate database lookup.
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    const workingDaysData = alasql('SELECT * FROM monthly_working_days WHERE month = ? AND year = ? AND user_id = ?', [monthInt, yearInt, req.session.userId]);
    const leavesData = alasql('SELECT * FROM leaves WHERE month = ? AND year = ? AND user_id = ?', [monthInt, yearInt, req.session.userId]);
    
    res.json({
        working_days: workingDaysData.length > 0 ? workingDaysData[0].working_days : 0,
        leaves: leavesData
    });
});

app.post('/api/monthly-data', requireAuth, (req, res) => {
    try {
        const { month, year, working_days, leaves } = req.body; // leaves is an array of {resource_id, leave_days}
        
        // Correctly parse month, which is the source of the bug.
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        const workingDaysInt = parseInt(working_days, 10);

        // Update working days for current user
        const wdExists = alasql('SELECT * FROM monthly_working_days WHERE month = ? AND year = ? AND user_id = ?', [monthInt, yearInt, req.session.userId]);
        if (wdExists.length > 0) {
            alasql('UPDATE monthly_working_days SET working_days = ? WHERE month = ? AND year = ? AND user_id = ?', [workingDaysInt, monthInt, yearInt, req.session.userId]);
        } else {
            alasql('INSERT INTO monthly_working_days VALUES (?, ?, ?, ?)', [monthInt, yearInt, workingDaysInt, req.session.userId]);
        }

        // Atomically update leaves: delete all for the month and user, then re-insert.
        alasql('DELETE FROM leaves WHERE month = ? AND year = ? AND user_id = ?', [monthInt, yearInt, req.session.userId]);
        leaves.forEach(leave => {
            const resourceIdInt = parseInt(leave.resource_id);
            const leaveDaysInt = parseInt(leave.leave_days);
            
            // Verify that the resource belongs to the current user
            const resourceCheck = alasql('SELECT * FROM resources WHERE id = ? AND user_id = ?', [resourceIdInt, req.session.userId]);
            if (resourceCheck.length > 0) {
                // Always insert the new value, even if it's 0, to correctly overwrite old data.
                alasql('INSERT INTO leaves VALUES (?, ?, ?, ?, ?)', [monthInt, yearInt, resourceIdInt, leaveDaysInt, req.session.userId]);
            }
        });

        res.status(200).send('Data updated');
    } catch (err) {
        console.error('Error updating monthly data:', err);
        res.status(500).send('Server error during data update.');
    }
});

// --- Admin API Routes (Admin Only) ---
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.userRole === 'admin') {
        return next();
    } else {
        return res.status(403).json({ error: 'Admin access required' });
    }
};

// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = alasql('SELECT id, username, role FROM users WHERE role != ?', ['admin']);
    res.json(users);
});

// Get all resources from all users for specific month/year (admin only)
app.get('/api/admin/all-resources', requireAdmin, (req, res) => {
    const { month, year } = req.query;
    
    if (month && year) {
        // Get resources for specific month/year
        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        const resources = alasql(`
            SELECT r.id, r.name, r.user_id, u.username, r.month, r.year
            FROM resources r 
            JOIN users u ON r.user_id = u.id 
            WHERE u.role != 'admin' AND r.month = ? AND r.year = ?
            ORDER BY u.username, r.name
        `, [monthInt, yearInt]);
        res.json(resources);
    } else {
        // Get all resources (for general admin purposes)
        const resources = alasql(`
            SELECT r.id, r.name, r.user_id, u.username, r.month, r.year
            FROM resources r 
            JOIN users u ON r.user_id = u.id 
            WHERE u.role != 'admin'
            ORDER BY u.username, r.name
        `);
        res.json(resources);
    }
});

// Get consolidated monthly data (admin only)
app.get('/api/admin/monthly-data', requireAdmin, (req, res) => {
    const { month, year } = req.query;
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);
    
    const consolidatedData = alasql(`
        SELECT 
            u.username,
            u.id as user_id,
            COALESCE(wd.working_days, 0) as working_days,
            (
                SELECT COUNT(*) 
                FROM resources r 
                WHERE r.user_id = u.id AND r.month = ? AND r.year = ?
            ) as total_resources,
            (
                SELECT COALESCE(SUM(l.leave_days), 0) 
                FROM leaves l 
                WHERE l.user_id = u.id AND l.month = ? AND l.year = ?
            ) as total_leaves
        FROM users u
        LEFT JOIN monthly_working_days wd ON u.id = wd.user_id AND wd.month = ? AND wd.year = ?
        WHERE u.role != 'admin'
        ORDER BY u.username
    `, [monthInt, yearInt, monthInt, yearInt, monthInt, yearInt]);
    
    // Calculate billable days for each user and filter out users with no data for this month
    const result = consolidatedData
        .filter(user => user.total_resources > 0 || user.working_days > 0)
        .map(user => ({
            ...user,
            billable_days: (user.working_days * user.total_resources) - user.total_leaves
        }));
    
    res.json(result);
});

// Get detailed user data (admin only)
app.get('/api/admin/user-details/:userId', requireAdmin, (req, res) => {
    const { userId } = req.params;
    const { month, year } = req.query;
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);
    const userIdInt = parseInt(userId, 10);
    
    const user = alasql('SELECT id, username FROM users WHERE id = ?', [userIdInt])[0];
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const resources = alasql('SELECT * FROM resources WHERE user_id = ?', [userIdInt]);
    const workingDays = alasql('SELECT working_days FROM monthly_working_days WHERE user_id = ? AND month = ? AND year = ?', [userIdInt, monthInt, yearInt]);
    const leaves = alasql('SELECT * FROM leaves WHERE user_id = ? AND month = ? AND year = ?', [userIdInt, monthInt, yearInt]);
    
    res.json({
        user,
        resources,
        working_days: workingDays.length > 0 ? workingDays[0].working_days : 22,
        leaves
    });
});

// Create new employee account (admin only)
app.post('/api/admin/create-user', requireAdmin, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Create new employee account (duplicate usernames allowed)
    const userId = (alasql('SELECT MAX(id) as id FROM users')[0].id || 0) + 1;
    alasql('INSERT INTO users VALUES (?, ?, ?, ?, ?)', [userId, username, password, 'user', false]);
    
    console.log(`Admin created new employee account: ${username}`);
    res.json({ success: true, user: { id: userId, username: username, role: 'user' } });
});

// Delete employee account (admin only)
app.delete('/api/admin/delete-user/:userId', requireAdmin, (req, res) => {
    const { userId } = req.params;
    const userIdInt = parseInt(userId, 10);
    
    // Check if user exists and is not admin
    const user = alasql('SELECT * FROM users WHERE id = ? AND role != ?', [userIdInt, 'admin']);
    if (user.length === 0) {
        return res.status(404).json({ error: 'User not found or cannot delete admin user' });
    }
    
    // Delete user and all their data
    alasql('DELETE FROM users WHERE id = ?', [userIdInt]);
    alasql('DELETE FROM resources WHERE user_id = ?', [userIdInt]);
    alasql('DELETE FROM monthly_working_days WHERE user_id = ?', [userIdInt]);
    alasql('DELETE FROM leaves WHERE user_id = ?', [userIdInt]);
    
    console.log(`Admin deleted employee account: ${user[0].username}`);
    res.json({ success: true, message: 'User and all associated data deleted successfully' });
});

// Change admin password (admin only)
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }
    
    // Verify current password
    const admin = alasql('SELECT * FROM users WHERE id = ? AND password = ?', [req.session.userId, currentPassword]);
    if (admin.length === 0) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    alasql('UPDATE users SET password = ? WHERE id = ?', [newPassword, req.session.userId]);
    
    console.log('Admin password changed successfully');
    res.json({ success: true, message: 'Password changed successfully' });
});

// Get admin security status
app.get('/api/admin/security-status', requireAdmin, (req, res) => {
    const admin = alasql('SELECT username, password FROM users WHERE id = ?', [req.session.userId])[0];
    const isDefaultPassword = admin.password === 'admin123';
    
    res.json({
        username: admin.username,
        isDefaultPassword: isDefaultPassword,
        passwordStrength: admin.password.length >= 8 ? 'Strong' : 'Weak'
    });
});

// --- User API Routes (Regular Users) ---
// Change user password (authenticated users)
app.post('/api/user/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    // Verify current password
    const user = alasql('SELECT * FROM users WHERE id = ? AND password = ?', [req.session.userId, currentPassword]);
    if (user.length === 0) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password and mark as changed
    alasql('UPDATE users SET password = ?, password_changed = ? WHERE id = ?', [newPassword, true, req.session.userId]);
    
    console.log(`User ${req.session.username} changed their password`);
    res.json({ success: true, message: 'Password changed successfully' });
});

// Get user security status
app.get('/api/user/security-status', requireAuth, (req, res) => {
    const user = alasql('SELECT username, password, password_changed FROM users WHERE id = ?', [req.session.userId])[0];
    const isDefaultPassword = user.password === 'emp123' || !user.password_changed;
    
    res.json({
        username: user.username,
        isDefaultPassword: isDefaultPassword,
        mustChangePassword: isDefaultPassword,
        passwordStrength: user.password.length >= 6 ? 'Good' : 'Weak'
    });
});

// --- Static Assets ---
app.use(express.static(path.join(__dirname)));

// --- Database and Server Initialization ---
// Clear any existing data for clean start
alasql('DROP TABLE IF EXISTS users');
alasql('DROP TABLE IF EXISTS resources');
alasql('DROP TABLE IF EXISTS monthly_working_days');
alasql('DROP TABLE IF EXISTS leaves');

// Create fresh tables
alasql('CREATE TABLE users (id INT PRIMARY KEY, username STRING, password STRING, role STRING, password_changed BOOLEAN)');
alasql('CREATE TABLE resources (id INT PRIMARY KEY, name STRING, user_id INT, month INT, year INT)');
alasql('CREATE TABLE monthly_working_days (month INT, year INT, working_days INT, user_id INT)');
alasql('CREATE TABLE leaves (month INT, year INT, resource_id INT, leave_days INT, user_id INT)');

// Create default admin user if it doesn't exist
const adminExists = alasql('SELECT * FROM users WHERE username = ?', ['admin']);
if (adminExists.length === 0) {
    alasql('INSERT INTO users VALUES (?, ?, ?, ?, ?)', [1, 'admin', 'admin123', 'admin', false]);
    console.log('Default admin user created: username=admin, password=admin123');
}

// No pre-created employee accounts - Admin will create users as needed
console.log('\n=== SYSTEM READY ===');
console.log('Admin can create employee accounts via the dashboard');
console.log('Login as admin with: admin / admin123');
console.log('====================\n');

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}/`);
    console.log(`\n🌐 EXTERNAL ACCESS:`);
    console.log(`Share this URL with testers: http://192.168.0.108:${port}/`);
    console.log(`Admin login: admin / admin123`);
    console.log(`==========================================\n`);
});
