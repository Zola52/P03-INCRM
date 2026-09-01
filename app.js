// ============================================
// سیستم مدیریت ارتباط با مشتریان (CRM)
// نسخه: 1.0
// زبان: فارسی - راست‌چین
// ============================================

// ============================================
// متغیرهای سراسری
// ============================================

let currentEditingContactId = null;
let currentEditingLeadId = null;
let currentEditingTaskId = null;
let currentCalendarTargetField = null;
let currentCalendarDate = null;

// ============================================
// آبجکت‌های داده‌ای
// ============================================

const DB = {
    contacts: [],
    leads: [],
    tasks: [],
    lastId: {
        contact: 0,
        lead: 0,
        task: 0
    }
};

// ============================================
// تابع‌های تبدیل تاریخ میلادی به شمسی
// ============================================

function gregorianToJalali(gy, gm, gd) {
    let g_d_n = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
    for (let i = 0; i < gm; ++i) g_d_n += [31, 28 + (gy % 4 == 0 && (gy % 100 != 0 || gy % 400 == 0) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
    let j_d_n = g_d_n - 79;
    let j_np = Math.floor(j_d_n / 12053);
    j_d_n %= 12053;
    let jy = 979 + 33 * j_np + 4 * Math.floor(j_d_n / 1461);
    j_d_n %= 1461;
    if (j_d_n >= 366) { jy += Math.floor((j_d_n - 1) / 365); j_d_n = (j_d_n - 1) % 365; }
    let jm = 1;
    let monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    for (let i = 0; i < 12; i++) {
        if (j_d_n < monthDays[i]) break;
        j_d_n -= monthDays[i];
        jm++;
    }
    return [jy, jm, j_d_n + 1];
}

function jalaliToGregorian(jy, jm, jd) {
    let jy_x = jy + 1474; if (jm > 12) { jy_x += Math.floor(jm / 13); jm = ((jm - 1) % 12) + 1; } if (jm < 1) { jy_x += Math.floor((jm - 1) / 12); jm = ((jm - 1) % 12) + 13; } let gd_n = 365 * jy_x + Math.floor((jy_x) / 33) * 8 + Math.floor(((jy_x) % 33 + 3) / 4) + jd + 83 + (jm - 1 > 0 ? [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29].slice(0, jm - 1).reduce((a, b) => a + b) : 0);
    let gy = 400 * Math.floor(gd_n / 146097); gd_n %= 146097; let flag = true; if (gd_n >= 36525) { gd_n--; gy += 100 * Math.floor(gd_n / 36524); gd_n %= 36524; if (gd_n >= 365) gd_n++; flag = false; } gy += 4 * Math.floor(gd_n / 1461); gd_n %= 1461; if (flag) { if (gd_n >= 366) { gd_n--; gy += Math.floor(gd_n / 365); gd_n = (gd_n % 365); } } else { gy += Math.floor(gd_n / 365); gd_n = gd_n % 365; } let gm = 1; let monthDays = [31, 28 + (gy % 4 == 0 && (gy % 100 != 0 || gy % 400 == 0) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; for (let i = 0; i < 12; i++) { if (gd_n < monthDays[i]) break; gd_n -= monthDays[i]; gm++; } return [gy, gm, gd_n + 1];
}

// ============================================
// تابع‌های راهنما (Utility Functions)
// ============================================

function getCurrentPersianDate() {
    const now = new Date();
    const [y, m, d] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { year: y, month: m, day: d, date: `${d}/${m}/${y}` };
}

function formatPersianDate(date) {
    if (typeof date === 'string') {
        const [d, m, y] = date.split('/');
        return `${parseInt(d)}/${parseInt(m)}/${parseInt(y)}`;
    }
    return date;
}

function parsePersianDate(dateStr) {
    const [d, m, y] = dateStr.split('/').map(x => parseInt(x));
    return { day: d, month: m, year: y };
}

function getStatusBadge(status) {
    const statusMap = {
        'calling': { text: '🟡 تلاش برای تماس', class: 'status-calling' },
        'meeting': { text: '🟣 جلسه حضوری', class: 'status-meeting' },
        'sold': { text: '🏆 فروش موفق', class: 'status-sold' },
        'callback': { text: '🔵 پیگیری مجدد', class: 'status-callback' },
        'archived': { text: '🔴 بایگانی', class: 'status-archived' }
    };
    return statusMap[status] || { text: status, class: '' };
}

function getPersianMonthName(month) {
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    return months[month - 1] || '';
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type}">
            ${message}
        </div>
    `;
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) alert.remove();
    }, 4000);
}

// ============================================
// تابع‌های LocalStorage (ذخیره داده‌ها)
// ============================================

function loadFromStorage() {
    try {
        const stored = localStorage.getItem('crm-database');
        if (stored) {
            const data = JSON.parse(stored);
            DB.contacts = data.contacts || [];
            DB.leads = data.leads || [];
            DB.tasks = data.tasks || [];
            DB.lastId = data.lastId || { contact: 0, lead: 0, task: 0 };
        }
    } catch (e) {
        console.error('خطا در بارگذاری داده‌ها:', e);
    }
}

function saveToStorage() {
    try {
        localStorage.setItem('crm-database', JSON.stringify(DB));
    } catch (e) {
        console.error('خطا در ذخیره داده‌ها:', e);
    }
}

function exportLeadsToJSON() {
    const dataStr = JSON.stringify(DB, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `crm-backup-${new Date().getTime()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showAlert('✅ داده‌های سیستم با موفقیت دانلود شد', 'success');
}

// ============================================
// مدیریت تب‌ها
// ============================================

function switchTab(tabName) {
    // مخفی کردن تمام تب‌ها
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));

    // فعال کردن تب انتخابی
    const tabElement = document.getElementById(tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // به‌روزرسانی دکمه‌های تب
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // بروزرسانی محتوای تب
    if (tabName === 'contacts') {
        renderContacts();
    } else if (tabName === 'leads') {
        renderLeadsKanban();
    } else if (tabName === 'tasks') {
        renderTasks();
    } else if (tabName === 'reports') {
        updateReports();
    } else if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// ============================================
// مدیریت مشتریان
// ============================================

function openAddContactModal() {
    currentEditingContactId = null;
    document.getElementById('contactModalTitle').textContent = 'مشتری جدید';
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactSubject').value = '';
    document.getElementById('contactNotes').value = '';
    document.getElementById('contactModal').classList.add('active');
}

function saveContact(event) {
    event.preventDefault();

    const name = document.getElementById('contactName').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const subject = document.getElementById('contactSubject').value.trim();
    const notes = document.getElementById('contactNotes').value.trim();

    if (!name || !phone) {
        showAlert('لطفاً نام و شماره تماس را وارد کنید', 'error');
        return;
    }

    if (currentEditingContactId) {
        // ویرایش مشتری موجود
        const contact = DB.contacts.find(c => c.id === currentEditingContactId);
        if (contact) {
            contact.name = name;
            contact.phone = phone;
            contact.email = email;
            contact.subject = subject;
            contact.notes = notes;
            showAlert('✅ مشتری با موفقیت بروزرسانی شد', 'success');
        }
    } else {
        // افزودن مشتری جدید
        const newContact = {
            id: ++DB.lastId.contact,
            name,
            phone,
            email,
            subject,
            notes,
            createdAt: getCurrentPersianDate().date
        };
        DB.contacts.push(newContact);
        showAlert('✅ مشتری جدید با موفقیت اضافه شد', 'success');
    }

    saveToStorage();
    closeModal(null, 'contactModal');
    renderContacts();
    updateLeadSelectOptions();
}

function renderContacts() {
    const tbody = document.getElementById('contactsTable');
    const contacts = DB.contacts;

    if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-6">هیچ مشتری ثبت نشده</td></tr>';
        return;
    }

    tbody.innerHTML = contacts.map(contact => `
        <tr>
            <td>${contact.name}</td>
            <td>${contact.phone}</td>
            <td>${contact.email || '-'}</td>
            <td>${contact.subject || '-'}</td>
            <td>${contact.createdAt}</td>
            <td>
                <div class="flex-row">
                    <button class="btn-primary" onclick="editContact(${contact.id})">✏️ ویرایش</button>
                    <button class="btn-danger" onclick="deleteContact(${contact.id})">🗑️ حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterContacts() {
    const searchTerm = document.getElementById('contactSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#contactsTable tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 1) {
            const text = Array.from(cells).slice(0, -1).map(c => c.textContent).join(' ').toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        }
    });
}

function editContact(contactId) {
    const contact = DB.contacts.find(c => c.id === contactId);
    if (!contact) return;

    currentEditingContactId = contactId;
    document.getElementById('contactModalTitle').textContent = 'ویرایش مشتری';
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactPhone').value = contact.phone;
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactSubject').value = contact.subject || '';
    document.getElementById('contactNotes').value = contact.notes || '';
    document.getElementById('contactModal').classList.add('active');
}

function deleteContact(contactId) {
    if (confirm('آیا از حذف این مشتری اطمینان دارید؟')) {
        DB.contacts = DB.contacts.filter(c => c.id !== contactId);
        DB.leads = DB.leads.filter(l => l.contactId !== contactId);
        saveToStorage();
        renderContacts();
        updateLeadSelectOptions();
        showAlert('✅ مشتری حذف شد', 'success');
    }
}

// ============================================
// مدیریت سرنخ‌ها
// ============================================

function openAddLeadModal() {
    currentEditingLeadId = null;
    document.getElementById('leadContactId').value = '';
    document.getElementById('leadStatus').value = 'calling';
    document.getElementById('leadNotes').value = '';
    document.getElementById('leadModal').classList.add('active');
}

function updateLeadSelectOptions() {
    const select = document.getElementById('leadContactId');
    const taskSelect = document.getElementById('taskLeadId');
    
    select.innerHTML = '<option value="">انتخاب مشتری...</option>';
    taskSelect.innerHTML = '<option value="">بدون ارتباط</option>';

    DB.contacts.forEach(contact => {
        select.innerHTML += `<option value="${contact.id}">${contact.name} (${contact.phone})</option>`;
        taskSelect.innerHTML += `<option value="${contact.id}">${contact.name}</option>`;
    });
}

function saveLead(event) {
    event.preventDefault();

    const contactId = parseInt(document.getElementById('leadContactId').value);
    const status = document.getElementById('leadStatus').value;
    const notes = document.getElementById('leadNotes').value.trim();

    if (!contactId) {
        showAlert('لطفاً مشتری را انتخاب کنید', 'error');
        return;
    }

    const contact = DB.contacts.find(c => c.id === contactId);
    if (!contact) {
        showAlert('مشتری انتخاب شده یافت نشد', 'error');
        return;
    }

    if (currentEditingLeadId) {
        const lead = DB.leads.find(l => l.id === currentEditingLeadId);
        if (lead) {
            lead.contactId = contactId;
            lead.status = status;
            lead.notes = notes;
            lead.updatedAt = getCurrentPersianDate().date;
            showAlert('✅ سرنخ بروزرسانی شد', 'success');
        }
    } else {
        const newLead = {
            id: ++DB.lastId.lead,
            contactId,
            contactName: contact.name,
            contactPhone: contact.phone,
            status,
            notes,
            failureCount: 0,
            createdAt: getCurrentPersianDate().date,
            updatedAt: getCurrentPersianDate().date,
            lastCallDate: getCurrentPersianDate().date
        };
        DB.leads.push(newLead);
        showAlert('✅ سرنخ جدید اضافه شد', 'success');
    }

    saveToStorage();
    closeModal(null, 'leadModal');
    renderLeadsKanban();
    updateDashboard();
}

function renderLeadsKanban() {
    const container = document.getElementById('leadsKanban');
    const statusList = [
        { key: 'calling', title: '🟡 تلاش برای تماس', color: 'bg-yellow-50' },
        { key: 'meeting', title: '🟣 جلسه حضوری', color: 'bg-purple-50' },
        { key: 'sold', title: '🏆 فروش موفق', color: 'bg-green-50' },
        { key: 'callback', title: '🔵 پیگیری مجدد', color: 'bg-blue-50' },
        { key: 'archived', title: '🔴 بایگانی', color: 'bg-red-50' }
    ];

    container.innerHTML = '';

    statusList.forEach(status => {
        const leads = DB.leads.filter(l => l.status === status.key);
        const column = document.createElement('div');
        column.className = `${status.color} p-4 rounded-lg border-2 border-gray-200`;
        column.innerHTML = `
            <div class="text-lg font-bold mb-3 text-gray-800">${status.title}</div>
            <div class="space-y-2">
                ${leads.length === 0 ? '<p class="text-gray-400 text-sm text-center py-4">خالی</p>' : leads.map(lead => `
                    <div class="bg-white p-3 rounded border border-gray-300 cursor-pointer hover:shadow-md transition" onclick="openLeadActionModal(${lead.id})">
                        <div class="font-semibold text-gray-800">${lead.contactName}</div>
                        <div class="text-xs text-gray-500">${lead.contactPhone}</div>
                        <div class="text-xs text-gray-400 mt-1">آخرین تماس: ${lead.lastCallDate}</div>
                        ${lead.failureCount > 0 ? `<div class="text-xs text-orange-600 mt-1">❌ ${lead.failureCount} بار پاسخ نداد</div>` : ''}
                        <div class="flex gap-1 mt-2">
                            <button class="text-xs px-2 py-1 bg-blue-500 text-white rounded" onclick="event.stopPropagation(); openLeadActionModal(${lead.id})">📞 تماس</button>
                            <button class="text-xs px-2 py-1 bg-red-500 text-white rounded" onclick="event.stopPropagation(); deleteLead(${lead.id})">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(column);
    });
}

function filterLeads() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchFilter = document.getElementById('leadSearchInput').value.toLowerCase();

    const leads = DB.leads.filter(lead => {
        const statusMatch = !statusFilter || lead.status === statusFilter;
        const searchMatch = !searchFilter || lead.contactName.toLowerCase().includes(searchFilter);
        return statusMatch && searchMatch;
    });

    const container = document.getElementById('leadsKanban');
    if (leads.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">سرنخی یافت نشد</div>';
        return;
    }

    renderLeadsKanban();
}

function deleteLead(leadId) {
    if (confirm('آیا از حذف این سرنخ اطمینان دارید؟')) {
        DB.leads = DB.leads.filter(l => l.id !== leadId);
        saveToStorage();
        renderLeadsKanban();
        updateDashboard();
        showAlert('✅ سرنخ حذف شد', 'success');
    }
}

function openLeadActionModal(leadId) {
    const lead = DB.leads.find(l => l.id === leadId);
    if (!lead) return;

    currentEditingLeadId = leadId;
    const infoDiv = document.getElementById('currentLeadInfo');
    infoDiv.innerHTML = `
        <div class="font-semibold text-lg">${lead.contactName}</div>
        <div class="text-sm text-gray-600">${lead.contactPhone}</div>
        <div class="text-xs text-gray-500 mt-1">وضعیت: ${getStatusBadge(lead.status).text}</div>
    `;

    document.getElementById('callOutcome').value = '';
    document.getElementById('actionNotes').value = '';
    document.getElementById('rejectionReason').value = '';
    document.getElementById('meetingDate').value = '';
    document.getElementById('callbackDate').value = '';

    document.getElementById('leadActionModal').classList.add('active');
}

function updateOutcomeFields() {
    const outcome = document.getElementById('callOutcome').value;
    document.getElementById('meetingDateField').style.display = outcome === 'meeting' ? 'block' : 'none';
    document.getElementById('callbackDateField').style.display = outcome === 'callback' ? 'block' : 'none';
    document.getElementById('reasonField').style.display = outcome === 'rejected' ? 'block' : 'none';
}

function updateLeadStatus(event) {
    event.preventDefault();

    const lead = DB.leads.find(l => l.id === currentEditingLeadId);
    if (!lead) return;

    const outcome = document.getElementById('callOutcome').value;
    const notes = document.getElementById('actionNotes').value;

    if (!outcome) {
        showAlert('لطفاً نتیجه تماس را انتخاب کنید', 'error');
        return;
    }

    const today = getCurrentPersianDate().date;

    switch(outcome) {
        case 'no_answer':
            lead.failureCount++;
            lead.lastCallDate = today;
            
            if (lead.failureCount >= 4) {
                lead.status = 'archived';
                showAlert('⚠️ این سرنخ به دلیل عدم پاسخ 4 بار خودکار بایگانی شد', 'error');
            } else {
                const daysLater = Math.pow(2, lead.failureCount);
                const nextCallDate = addDaysToJalaliDate(today, daysLater);
                lead.status = 'callback';
                
                // ایجاد وظیفه خودکار
                const task = {
                    id: ++DB.lastId.task,
                    title: `تماس مجدد با ${lead.contactName}`,
                    leadId: lead.id,
                    contactId: lead.contactId,
                    dueDate: nextCallDate,
                    status: 'pending',
                    priority: 'normal',
                    description: `تماس مجدد (تلاش ${lead.failureCount}) - تماس‌های قبلی بی‌پاسخ`,
                    createdAt: today
                };
                DB.tasks.push(task);
                showAlert(`✅ پیگیری برای ${daysLater} روز بعد برنامه‌ریزی شد`, 'success');
            }
            break;

        case 'meeting':
            const meetingDate = document.getElementById('meetingDate').value;
            if (!meetingDate) {
                showAlert('لطفاً تاریخ جلسه را انتخاب کنید', 'error');
                return;
            }
            lead.status = 'meeting';
            lead.meetingDate = meetingDate;
            lead.failureCount = 0;
            
            const meetingTask = {
                id: ++DB.lastId.task,
                title: `جلسه حضوری با ${lead.contactName}`,
                leadId: lead.id,
                contactId: lead.contactId,
                dueDate: meetingDate,
                status: 'pending',
                priority: 'high',
                description: `جلسه حضوری برای بررسی و صدور بیمه‌نامه`,
                createdAt: today
            };
            DB.tasks.push(meetingTask);
            showAlert('✅ جلسه برنامه‌ریزی شد', 'success');
            break;

        case 'sold':
            lead.status = 'sold';
            lead.failureCount = 0;
            lead.soldDate = today;
            showAlert('🎉 تبریک! فروش با موفقیت ثبت شد', 'success');
            break;

        case 'callback':
            const callbackDate = document.getElementById('callbackDate').value;
            if (!callbackDate) {
                showAlert('لطفاً تاریخ پیگیری را انتخاب کنید', 'error');
                return;
            }
            lead.status = 'callback';
            lead.nextCallDate = callbackDate;
            lead.failureCount = 0;
            
            const callbackTask = {
                id: ++DB.lastId.task,
                title: `پیگیری ${lead.contactName}`,
                leadId: lead.id,
                contactId: lead.contactId,
                dueDate: callbackDate,
                status: 'pending',
                priority: 'normal',
                description: notes || 'پیگیری مشتری',
                createdAt: today
            };
            DB.tasks.push(callbackTask);
            showAlert('✅ پیگیری برنامه‌ریزی شد', 'success');
            break;

        case 'rejected':
            const reason = document.getElementById('rejectionReason').value;
            lead.status = 'archived';
            lead.rejectionReason = reason || 'عدم تمایل';
            showAlert('✅ سرنخ بایگانی شد', 'success');
            break;
    }

    if (notes) {
        lead.notes = (lead.notes || '') + `\n[${today}]: ${notes}`;
    }
    lead.lastCallDate = today;
    lead.updatedAt = today;

    saveToStorage();
    closeModal(null, 'leadActionModal');
    renderLeadsKanban();
    updateDashboard();
    renderTasks();
}

function addDaysToJalaliDate(dateStr, days) {
    const [d, m, y] = dateStr.split('/').map(x => parseInt(x));
    const gregorian = jalaliToGregorian(y, m, d);
    const date = new Date(gregorian[0], gregorian[1] - 1, gregorian[2]);
    date.setDate(date.getDate() + days);
    const newJalali = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return `${newJalali[2]}/${newJalali[1]}/${newJalali[0]}`;
}

// ============================================
// مدیریت وظایف
// ============================================

function openAddTaskModal() {
    currentEditingTaskId = null;
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskLeadId').value = '';
    document.getElementById('taskDate').value = '';
    document.getElementById('taskPriority').value = 'normal';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskModal').classList.add('active');
}

function saveTask(event) {
    event.preventDefault();

    const title = document.getElementById('taskTitle').value.trim();
    const leadId = document.getElementById('taskLeadId').value;
    const dueDate = document.getElementById('taskDate').value;
    const priority = document.getElementById('taskPriority').value;
    const description = document.getElementById('taskDescription').value.trim();

    if (!title || !dueDate) {
        showAlert('لطفاً عنوان و تاریخ را وارد کنید', 'error');
        return;
    }

    if (currentEditingTaskId) {
        const task = DB.tasks.find(t => t.id === currentEditingTaskId);
        if (task) {
            task.title = title;
            task.leadId = leadId || null;
            task.dueDate = dueDate;
            task.priority = priority;
            task.description = description;
            showAlert('✅ وظیفه بروزرسانی شد', 'success');
        }
    } else {
        const newTask = {
            id: ++DB.lastId.task,
            title,
            leadId: leadId ? parseInt(leadId) : null,
            contactId: leadId ? parseInt(leadId) : null,
            dueDate,
            status: 'pending',
            priority,
            description,
            createdAt: getCurrentPersianDate().date
        };
        DB.tasks.push(newTask);
        showAlert('✅ وظیفه جدید اضافه شد', 'success');
    }

    saveToStorage();
    closeModal(null, 'taskModal');
    renderTasks();
}

function renderTasks() {
    const tbody = document.getElementById('tasksTable');
    const tasks = DB.tasks;

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-6">هیچ وظیفه‌ای ثبت نشده</td></tr>';
        return;
    }

    const today = getCurrentPersianDate();
    const todayStr = today.date;

    tbody.innerHTML = tasks.map(task => {
        let statusBadge = '⏳ درانتظار';
        let statusClass = '';
        
        if (task.status === 'completed') {
            statusBadge = '✅ تکمیل شده';
            statusClass = 'text-green-600';
        } else if (comparePersianDates(task.dueDate, todayStr) < 0) {
            statusBadge = '⚠️ تأخیر';
            statusClass = 'text-red-600';
        }

        const lead = task.leadId ? DB.leads.find(l => l.id === task.leadId) : null;
        const relatedName = lead ? lead.contactName : '-';

        const priorityClass = {
            'normal': 'bg-blue-100 text-blue-800',
            'high': 'bg-yellow-100 text-yellow-800',
            'critical': 'bg-red-100 text-red-800'
        }[task.priority] || '';

        return `
            <tr>
                <td>${task.title}</td>
                <td>${relatedName}</td>
                <td>${task.dueDate}</td>
                <td class="${statusClass}">${statusBadge}</td>
                <td><span class="${priorityClass} px-2 py-1 rounded">${task.priority === 'normal' ? 'عادی' : task.priority === 'high' ? 'بالا' : 'فوری'}</span></td>
                <td>
                    <div class="flex-row">
                        <button class="btn-success" onclick="toggleTaskComplete(${task.id})">✅</button>
                        <button class="btn-danger" onclick="deleteTask(${task.id})">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterTasks() {
    const statusFilter = document.getElementById('taskStatusFilter').value;
    const searchFilter = document.getElementById('taskSearchInput').value.toLowerCase();

    const tasks = DB.tasks.filter(task => {
        const statusMatch = !statusFilter || task.status === statusFilter;
        const searchMatch = !searchFilter || task.title.toLowerCase().includes(searchFilter);
        return statusMatch && searchMatch;
    });

    if (tasks.length === 0) {
        document.getElementById('tasksTable').innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-6">وظیفه‌ای یافت نشد</td></tr>';
        return;
    }

    renderTasks();
}

function toggleTaskComplete(taskId) {
    const task = DB.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        saveToStorage();
        renderTasks();
        updateDashboard();
    }
}

function deleteTask(taskId) {
    if (confirm('آیا از حذف این وظیفه اطمینان دارید؟')) {
        DB.tasks = DB.tasks.filter(t => t.id !== taskId);
        saveToStorage();
        renderTasks();
        showAlert('✅ وظیفه حذف شد', 'success');
    }
}

function comparePersianDates(date1, date2) {
    const [d1, m1, y1] = date1.split('/').map(x => parseInt(x));
    const [d2, m2, y2] = date2.split('/').map(x => parseInt(x));
    
    if (y1 !== y2) return y1 - y2;
    if (m1 !== m2) return m1 - m2;
    return d1 - d2;
}

// ============================================
// تقویم شمسی
// ============================================

function openCalendar(fieldName) {
    currentCalendarTargetField = fieldName;
    const inputValue = document.getElementById(fieldName).value;
    
    if (inputValue) {
        const [d, m, y] = inputValue.split('/').map(x => parseInt(x));
        currentCalendarDate = { day: d, month: m, year: y };
    } else {
        currentCalendarDate = getCurrentPersianDate();
    }

    document.getElementById('calendarYear').value = currentCalendarDate.year;
    document.getElementById('calendarMonth').value = currentCalendarDate.month;
    document.getElementById('calendarDay').value = currentCalendarDate.day;

    updateCalendar();
    document.getElementById('calendarModal').classList.add('active');
}

function updateCalendar() {
    const year = parseInt(document.getElementById('calendarYear').value);
    const month = parseInt(document.getElementById('calendarMonth').value);

    if (isNaN(year) || isNaN(month) || year < 1400 || year > 1450 || month < 1 || month > 12) {
        return;
    }

    currentCalendarDate = { year, month, day: 1 };

    // محاسبه روز شروع ماه
    const [, , firstDayOfMonth] = jalaliToGregorian(year, month, 1);
    const gregorianDate = new Date(jalaliToGregorian(year, month, 1)[0], jalaliToGregorian(year, month, 1)[1] - 1, firstDayOfMonth);
    const startDayOfWeek = gregorianDate.getDay();

    // تعداد روز‌های ماه
    const daysInMonth = month <= 6 ? 31 : month <= 11 ? 30 : 29;

    // رندر تقویم
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // اضافه کردن ستون‌های خالی
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day disabled';
        grid.appendChild(emptyCell);
    }

    // اضافه کردن روز‌های ماه
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        if (day === currentCalendarDate.day && month === currentCalendarDate.month) {
            dayCell.classList.add('selected');
        }

        dayCell.onclick = () => {
            document.getElementById('calendarDay').value = day;
            updateCalendarSelection();
        };

        grid.appendChild(dayCell);
    }

    // به‌روزرسانی عنوان ماه
    document.getElementById('currentMonthDisplay').textContent = `${getPersianMonthName(month)} ${year}`;
}

function updateCalendarSelection() {
    const day = parseInt(document.getElementById('calendarDay').value);
    const month = parseInt(document.getElementById('calendarMonth').value);
    const year = parseInt(document.getElementById('calendarYear').value);

    currentCalendarDate = { day, month, year };
    updateCalendar();
}

function previousMonth() {
    let month = parseInt(document.getElementById('calendarMonth').value);
    let year = parseInt(document.getElementById('calendarYear').value);

    month--;
    if (month < 1) {
        month = 12;
        year--;
    }

    document.getElementById('calendarMonth').value = month;
    document.getElementById('calendarYear').value = year;
    updateCalendar();
}

function nextMonth() {
    let month = parseInt(document.getElementById('calendarMonth').value);
    let year = parseInt(document.getElementById('calendarYear').value);

    month++;
    if (month > 12) {
        month = 1;
        year++;
    }

    document.getElementById('calendarMonth').value = month;
    document.getElementById('calendarYear').value = year;
    updateCalendar();
}

function confirmDateSelection() {
    const day = parseInt(document.getElementById('calendarDay').value);
    const month = parseInt(document.getElementById('calendarMonth').value);
    const year = parseInt(document.getElementById('calendarYear').value);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        showAlert('لطفاً تاریخ را مشخص کنید', 'error');
        return;
    }

    const dateStr = `${day}/${month}/${year}`;
    document.getElementById(currentCalendarTargetField).value = dateStr;

    closeModal(null, 'calendarModal');
}

// ============================================
// مدیریت مودال‌ها
// ============================================

function closeModal(event, modalId) {
    if (event) event.stopPropagation();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================
// داشبورد و گزارش‌ها
// ============================================

function updateDashboard() {
    const today = getCurrentPersianDate();

    // محاسبه آمار
    const activeLeads = DB.leads.filter(l => l.status === 'calling').length;
    const soldLeads = DB.leads.filter(l => l.status === 'sold').length;
    const callbackLeads = DB.leads.filter(l => l.status === 'callback').length;

    document.getElementById('statsActiveCalls').textContent = activeLeads;
    document.getElementById('statsSalesCount').textContent = soldLeads;
    document.getElementById('statsCallbacks').textContent = callbackLeads;

    // نمایش تاریخ امروز
    document.getElementById('currentDateDisplay').textContent = today.date;
    document.getElementById('statsDisplay').textContent = `مجموع سرنخ‌ها: ${DB.leads.length} | مشتریان: ${DB.contacts.length}`;

    // فعالیت‌های امروز
    const todayActivities = DB.tasks.filter(t => t.dueDate === today.date);
    const activitiesHtml = todayActivities.length === 0 
        ? '<p class="text-gray-500 text-center py-6">هیچ فعالیتی برای امروز ثبت نشده است</p>'
        : todayActivities.map(task => `
            <div class="bg-blue-50 border-r-4 border-blue-500 p-3 mb-2 rounded">
                <div class="font-semibold">${task.title}</div>
                <div class="text-sm text-gray-600">
                    <span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs mr-2">
                        ${task.priority === 'critical' ? '🔴 فوری' : task.priority === 'high' ? '🟡 بالا' : '🟢 عادی'}
                    </span>
                </div>
            </div>
        `).join('');

    document.getElementById('todayActivities').innerHTML = activitiesHtml;

    // سرنخ‌های منتظر تماس
    const pendingLeads = DB.leads.filter(l => l.status === 'calling' || l.status === 'callback');
    const pendingHtml = pendingLeads.length === 0
        ? '<tr><td colspan="5" class="text-center text-gray-500 py-6">سرنخی منتظر تماس نیست</td></tr>'
        : pendingLeads.map(lead => `
            <tr>
                <td>${lead.contactName}</td>
                <td>${lead.contactPhone}</td>
                <td><span class="status-badge ${getStatusBadge(lead.status).class}">${getStatusBadge(lead.status).text}</span></td>
                <td>${lead.lastCallDate}</td>
                <td><button class="btn-primary" onclick="openLeadActionModal(${lead.id})">📞 تماس</button></td>
            </tr>
        `).join('');

    document.getElementById('pendingLeadsTable').innerHTML = pendingHtml;
}

function updateReports() {
    const totalLeads = DB.leads.length;
    const soldLeads = DB.leads.filter(l => l.status === 'sold').length;
    const conversionRate = totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0;

    document.getElementById('reportTotalLeads').textContent = totalLeads;
    document.getElementById('reportConversionRate').textContent = conversionRate + '%';
    document.getElementById('reportActiveCalls').textContent = DB.leads.filter(l => l.status === 'calling').length;
    document.getElementById('reportArchived').textContent = DB.leads.filter(l => l.status === 'archived').length;

    // توزیع وضعیت‌ها
    const statusStats = {
        'calling': DB.leads.filter(l => l.status === 'calling').length,
        'meeting': DB.leads.filter(l => l.status === 'meeting').length,
        'sold': DB.leads.filter(l => l.status === 'sold').length,
        'callback': DB.leads.filter(l => l.status === 'callback').length,
        'archived': DB.leads.filter(l => l.status === 'archived').length
    };

    const statusLabels = {
        'calling': '🟡 تلاش برای تماس',
        'meeting': '🟣 جلسه حضوری',
        'sold': '🏆 فروش موفق',
        'callback': '🔵 پیگیری مجدد',
        'archived': '🔴 بایگانی'
    };

    const distributionHtml = Object.entries(statusStats).map(([key, count]) => `
        <div class="flex items-center justify-between">
            <span>${statusLabels[key]}</span>
            <span class="font-bold text-lg">${count}</span>
        </div>
    `).join('');

    document.getElementById('statusDistribution').innerHTML = distributionHtml;
}

// ============================================
// راه‌اندازی اولیه
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    updateLeadSelectOptions();
    updateDashboard();

    // نمایش تاریخ امروز در عنوان
    const today = getCurrentPersianDate();
    console.log('✅ سیستم CRM با موفقیت بارگذاری شد');
    console.log(`📅 تاریخ امروز: ${today.date}`);
});
