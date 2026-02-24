// ========== GOOGLE SHEETS CONFIGURATION ==========
const SHEET_ID = '1ylBjNdwEdB75RQJEHI4dviYS5NgB1A0bpa9ILGQFeIc';
const SHEET_GID = '0';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// IMPORTANT: You need to create a Google Apps Script Web App URL for saving
// For now, we'll use localStorage as backup until you set this up
const WEB_APP_URL = ''; // Leave empty for now - we'll focus on reading first

// ========== MANAGER LOGIN ==========
const managerUser = 'Lebo';
const managerPassword = 'Lebo2026';
const currentUserKey = 'manager_logged_in';

// In-memory cache of entries
let entriesCache = [];

// Login function
function login() {
    console.log('Login button clicked');
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (username === 'Lebo' && password === 'Lebo2026') {
        console.log('Login successful');
        localStorage.setItem(currentUserKey, 'true');
        
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('user-info').innerHTML = '👤 Logged in as: Lebo';
        
        clearForm();
        loadFromSheets(); // Load data from Google Sheets on login
    } else {
        document.getElementById('login-message').innerHTML = 'Invalid username or password';
    }
}

// Logout
function logout() {
    localStorage.removeItem(currentUserKey);
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('login-username').value = 'Lebo';
    document.getElementById('login-password').value = '';
    document.getElementById('login-message').innerHTML = '';
}

// Check if already logged in
function checkLogin() {
    const isLoggedIn = localStorage.getItem(currentUserKey);
    if (isLoggedIn === 'true') {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('user-info').innerHTML = '👤 Logged in as: Lebo';
        loadFromSheets();
    }
}

// ========== GOOGLE SHEETS FUNCTIONS ==========

// Load data from Google Sheets
async function loadFromSheets() {
    document.getElementById('sync-status').innerHTML = '🔄 Syncing...';
    
    try {
        // Add cache-busting parameter to avoid cached responses
        const url = `${SHEET_CSV_URL}&_=${Date.now()}`;
        console.log('Fetching from:', url);
        
        // Fetch CSV data from published sheet
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('CSV text received, length:', csvText.length);
        
        if (csvText.length === 0) {
            throw new Error('Empty response from Google Sheets');
        }
        
        // Parse CSV
        PapaParse.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                console.log('Parse complete. Rows found:', results.data.length);
                
                // Filter out empty rows and ensure each has an id
                entriesCache = results.data.filter(row => row.id && row.id.trim() !== '');
                console.log('Valid entries:', entriesCache.length);
                
                document.getElementById('sync-status').innerHTML = '✅ Google Sheets Connected';
                
                // Also save to localStorage as backup
                localStorage.setItem('timesheet_entries', JSON.stringify(entriesCache));
                
                // Refresh current view if needed
                const activeTab = document.querySelector('.tab.active')?.id.replace('tab-', '');
                if (activeTab === 'view') displayEntries();
                else if (activeTab === 'report') {
                    const staff = document.getElementById('report-staff').value;
                    const month = document.getElementById('report-month').value;
                    if (staff && month) generateReport();
                }
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
                document.getElementById('sync-status').innerHTML = '❌ Parse Failed';
                
                // Fallback to localStorage
                loadFromLocalStorage();
            }
        });
    } catch (error) {
        console.error('Error loading from Sheets:', error);
        document.getElementById('sync-status').innerHTML = '❌ Fetch Failed';
        
        // Fallback to localStorage
        loadFromLocalStorage();
    }
}

// Fallback function to load from localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('timesheet_entries');
    if (saved) {
        entriesCache = JSON.parse(saved);
        document.getElementById('sync-status').innerHTML = '📁 Using Local Backup';
        console.log('Loaded from localStorage:', entriesCache.length);
        
        const activeTab = document.querySelector('.tab.active')?.id.replace('tab-', '');
        if (activeTab === 'view') displayEntries();
    } else {
        document.getElementById('sync-status').innerHTML = '⚠️ No Data Found';
    }
}

// Refresh from sheets (manual trigger)
function refreshFromSheets() {
    loadFromSheets();
}

// Save entry to Google Sheets (via Web App) - simplified for now
async function saveToSheets(entry) {
    console.log('Saving entry locally:', entry);
    
    // Update cache
    const existingIndex = entriesCache.findIndex(e => e.id === entry.id);
    if (existingIndex >= 0) {
        entriesCache[existingIndex] = entry;
    } else {
        entriesCache.push(entry);
    }
    
    // Save to localStorage as backup
    localStorage.setItem('timesheet_entries', JSON.stringify(entriesCache));
    
    document.getElementById('sync-status').innerHTML = '✅ Saved Locally';
    
    // Note: For now, we're only saving locally
    // To enable cloud saving, you'll need to set up a Google Apps Script Web App
    
    return true;
}

// Get entries (from cache)
function getEntries() {
    return entriesCache;
}

// ========== TAB SWITCHING ==========
function showTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    document.getElementById('entry-view').style.display = 'none';
    document.getElementById('view-view').style.display = 'none';
    document.getElementById('report-view').style.display = 'none';
    
    document.getElementById(`${tab}-view`).style.display = 'block';
    
    if (tab === 'view') displayEntries();
}

// ========== SAVE ENTRY ==========
async function saveEntry(event) {
    event.preventDefault();
    
    const staff = document.getElementById('staff-select').value;
    if (!staff) {
        alert('Please select a staff member');
        return;
    }
    
    const date = document.getElementById('entry-date').value;
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    const editId = document.getElementById('edit-id').value;
    
    const entry = {
        id: editId || Date.now().toString(),
        staff: staff,
        date: date,
        inbound_calls: parseInt(document.getElementById('inbound-calls').value) || 0,
        whatsapp_chats: parseInt(document.getElementById('whatsapp-chats').value) || 0,
        emails: parseInt(document.getElementById('emails').value) || 0,
        gen_logged: parseInt(document.getElementById('gen-logged').value) || 0,
        gen_resolved: parseInt(document.getElementById('gen-resolved').value) || 0,
        net_logged: parseInt(document.getElementById('net-logged').value) || 0,
        net_resolved: parseInt(document.getElementById('net-resolved').value) || 0,
        fibre_logged: parseInt(document.getElementById('fibre-logged').value) || 0,
        fibre_resolved: parseInt(document.getElementById('fibre-resolved').value) || 0,
        installations: parseInt(document.getElementById('installations').value) || 0,
        fibre_bookings: parseInt(document.getElementById('fibre-bookings').value) || 0,
        toc_sent: parseInt(document.getElementById('toc-sent').value) || 0,
        leads_received: parseInt(document.getElementById('leads-received').value) || 0,
        leads_contacted: parseInt(document.getElementById('leads-contacted').value) || 0,
        leads_converted: parseInt(document.getElementById('leads-converted').value) || 0,
        system_updated: document.getElementById('system-updated').checked,
        servcraft_updated: document.getElementById('servcraft-updated').checked,
        router_updated: document.getElementById('router-updated').checked,
        ftth_tracking: document.getElementById('ftth-tracking')?.checked || false,
        daily_activities: document.getElementById('daily-activities')?.checked || false,
        notes: document.getElementById('notes').value
    };
    
    // Check for duplicates
    if (!editId) {
        const exists = entriesCache.some(e => e.staff === staff && e.date === date);
        if (exists) {
            if (!confirm('Entry already exists for this date. Do you want to update it?')) {
                return;
            }
            // Remove old entry
            const index = entriesCache.findIndex(e => e.staff === staff && e.date === date);
            if (index >= 0) entriesCache.splice(index, 1);
        }
    } else {
        // Remove old version if editing
        const index = entriesCache.findIndex(e => e.id === editId);
        if (index >= 0) entriesCache.splice(index, 1);
    }
    
    // Add to cache
    entriesCache.push(entry);
    
    // Save to localStorage (cloud saving disabled for now)
    await saveToSheets(entry);
    
    alert('Entry saved successfully!');
    clearForm();
    showTab('view');
    displayEntries();
}

// ========== CHECK TODAY'S ENTRY ==========
function checkTodayEntry() {
    const staff = document.getElementById('staff-select').value;
    if (!staff) return;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;
    
    const existing = entriesCache.find(e => e.staff === staff && e.date === today);
    
    if (existing) {
        if (confirm('Entry exists for today. Load it for editing?')) {
            loadEntryForEdit(existing);
        }
    }
}

// ========== LOAD ENTRY FOR EDIT ==========
function loadEntryForEdit(entry) {
    document.getElementById('edit-id').value = entry.id;
    document.getElementById('staff-select').value = entry.staff;
    document.getElementById('entry-date').value = entry.date;
    document.getElementById('inbound-calls').value = entry.inbound_calls;
    document.getElementById('whatsapp-chats').value = entry.whatsapp_chats;
    document.getElementById('emails').value = entry.emails;
    document.getElementById('gen-logged').value = entry.gen_logged;
    document.getElementById('gen-resolved').value = entry.gen_resolved;
    document.getElementById('net-logged').value = entry.net_logged;
    document.getElementById('net-resolved').value = entry.net_resolved;
    document.getElementById('fibre-logged').value = entry.fibre_logged;
    document.getElementById('fibre-resolved').value = entry.fibre_resolved;
    document.getElementById('installations').value = entry.installations;
    document.getElementById('fibre-bookings').value = entry.fibre_bookings;
    document.getElementById('toc-sent').value = entry.toc_sent;
    document.getElementById('leads-received').value = entry.leads_received;
    document.getElementById('leads-contacted').value = entry.leads_contacted;
    document.getElementById('leads-converted').value = entry.leads_converted;
    document.getElementById('system-updated').checked = entry.system_updated;
    document.getElementById('servcraft-updated').checked = entry.servcraft_updated;
    document.getElementById('router-updated').checked = entry.router_updated;
    if (document.getElementById('ftth-tracking')) 
        document.getElementById('ftth-tracking').checked = entry.ftth_tracking;
    if (document.getElementById('daily-activities')) 
        document.getElementById('daily-activities').checked = entry.daily_activities;
    document.getElementById('notes').value = entry.notes || '';
    
    showTab('entry');
}

// ========== DISPLAY ENTRIES ==========
function displayEntries() {
    let entries = [...entriesCache];
    const staffFilter = document.getElementById('filter-staff').value;
    const dateFilter = document.getElementById('filter-date').value;
    
    if (staffFilter) {
        entries = entries.filter(e => e.staff === staffFilter);
    }
    if (dateFilter) {
        entries = entries.filter(e => e.date === dateFilter);
    }
    
    entries.sort((a, b) => b.date.localeCompare(a.date));
    
    const container = document.getElementById('entries-container');
    
    if (entries.length === 0) {
        container.innerHTML = '<p>No entries found.</p>';
        return;
    }
    
    let html = '';
    entries.forEach(entry => {
        html += `
            <div class="entry-item">
                <div class="entry-header">
                    <div>
                        <span class="entry-date">${entry.date}</span> - 
                        <span style="background:#28a745; color:white; padding:3px 8px; border-radius:10px;">${entry.staff}</span>
                    </div>
                    <div class="entry-actions">
                        <button onclick='loadEntryForEdit(${JSON.stringify(entry).replace(/'/g, "\\'")})'>✏️ Edit</button>
                        <button class="danger" onclick="deleteEntry('${entry.id}')">🗑️ Delete</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;">
                    <div>📞 Calls: ${entry.inbound_calls}</div>
                    <div>💬 WhatsApp: ${entry.whatsapp_chats}</div>
                    <div>📧 Emails: ${entry.emails}</div>
                    <div>🎫 Tickets: ${entry.gen_logged}</div>
                    <div>🔧 Install: ${entry.installations}</div>
                    <div>📊 Leads: ${entry.leads_received}</div>
                </div>
                ${entry.notes ? `<div style="margin-top: 10px; color: #666;">📝 ${entry.notes}</div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ========== DELETE ENTRY ==========
async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    entriesCache = entriesCache.filter(e => e.id !== id);
    localStorage.setItem('timesheet_entries', JSON.stringify(entriesCache));
    
    displayEntries();
}

// ========== GENERATE REPORT ==========
function generateReport() {
    const staff = document.getElementById('report-staff').value;
    const month = document.getElementById('report-month').value;
    
    if (!staff || !month) {
        alert('Please select both staff member and month');
        return;
    }
    
    const entries = entriesCache;
    const [year, mon] = month.split('-');
    
    const monthEntries = entries.filter(e => 
        e.staff === staff && 
        e.date.startsWith(`${year}-${mon}`)
    );
    
    if (monthEntries.length === 0) {
        document.getElementById('report-container').innerHTML = '<p>No entries for this period.</p>';
        return;
    }
    
    // Calculate totals
    const totals = {
        inbound_calls: 0, whatsapp_chats: 0, emails: 0,
        gen_logged: 0, gen_resolved: 0, net_logged: 0,
        net_resolved: 0, fibre_logged: 0, fibre_resolved: 0,
        installations: 0, fibre_bookings: 0, toc_sent: 0,
        leads_received: 0, leads_contacted: 0, leads_converted: 0
    };
    
    monthEntries.forEach(entry => {
        Object.keys(totals).forEach(key => {
            totals[key] += parseInt(entry[key]) || 0;
        });
    });
    
    monthEntries.sort((a, b) => a.date.localeCompare(b.date));
    
    let reportHTML = `
        <div>
            <div style="text-align: center; margin-bottom: 20px;">
                <h2>Monthly Timesheet Report</h2>
                <h3>${staff} - ${month}</h3>
            </div>
            
            <div class="summary">
                <h3>📊 Summary Totals</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                    <div>
                        <h4>Communications</h4>
                        <p>Inbound Calls: ${totals.inbound_calls}</p>
                        <p>WhatsApp Chats: ${totals.whatsapp_chats}</p>
                        <p>Emails: ${totals.emails}</p>
                    </div>
                    <div>
                        <h4>Tickets</h4>
                        <p>General Logged: ${totals.gen_logged}</p>
                        <p>General Resolved: ${totals.gen_resolved}</p>
                        <p>Network Down: ${totals.net_logged}</p>
                        <p>Fibre Break: ${totals.fibre_logged}</p>
                    </div>
                    <div>
                        <h4>Installations & Leads</h4>
                        <p>Installations: ${totals.installations}</p>
                        <p>Fibre Bookings: ${totals.fibre_bookings}</p>
                        <p>Leads Received: ${totals.leads_received}</p>
                        <p>Leads Converted: ${totals.leads_converted}</p>
                    </div>
                </div>
            </div>
            
            <h3>📅 Daily Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #007bff; color: white;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Calls</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">WhatsApp</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Emails</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Tickets</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Install</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Leads</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    monthEntries.forEach(entry => {
        reportHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${entry.date}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.inbound_calls}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.whatsapp_chats}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.emails}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.gen_logged}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.installations}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${entry.leads_received}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
            <p style="margin-top: 20px;"><strong>Total Days Worked:</strong> ${monthEntries.length}</p>
        </div>
    `;
    
    document.getElementById('report-container').innerHTML = reportHTML;
}

// ========== PRINT REPORT ==========
function printReport() {
    const reportContent = document.getElementById('report-container').innerHTML;
    if (!reportContent || reportContent.includes('No entries')) {
        alert('Please generate a report first');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Timesheet Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                    th { background: #007bff; color: white; }
                    .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ========== CLEAR FORM ==========
function clearForm() {
    document.getElementById('edit-id').value = '';
    document.getElementById('entry-form').reset();
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('staff-select').value = '';
    
    document.querySelectorAll('input[type="number"]').forEach(input => input.value = '0');
    document.querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
    document.getElementById('notes').value = '';
}

// ========== CLEAR FILTER ==========
function clearFilter() {
    document.getElementById('filter-staff').value = '';
    document.getElementById('filter-date').value = '';
    displayEntries();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkLogin();
});
