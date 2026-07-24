// ==========================================
// State Management
// ==========================================
let customers = JSON.parse(localStorage.getItem('susu_customers')) || [];
let transactions = JSON.parse(localStorage.getItem('susu_transactions')) || [];
let editIndex = -1;
let lastFocusedElement = null; 
let confirmCallback = null; 
let chartInitialized = false; 

// ==========================================
// DOM Elements
// ==========================================
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');
const customerModal = document.getElementById('customer-modal');
const transactionModal = document.getElementById('transaction-modal');
const customerForm = document.getElementById('customer-form');
const transactionForm = document.getElementById('transaction-form');
const customerSelect = document.getElementById('transaction-customer');

// Custom Alert DOM Elements
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-modal-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const alertCancelBtn = document.getElementById('alert-cancel-btn');
const alertTitle = document.getElementById('alert-modal-title');

// Search/Filter DOM Elements
const customerSearch = document.getElementById('customer-search');
const txnFilterType = document.getElementById('transaction-filter-type');
const txnFilterCustomer = document.getElementById('transaction-filter-customer');

// Export/Import DOM Elements
const exportBtn = document.getElementById('export-data-btn');
const importBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');

// ==========================================
// Security & Utility Functions
// ==========================================
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (char) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char];
    });
}

function roundCurrency(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function generateId(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// ==========================================
// Navigation Logic
// ==========================================
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if(target === 'analytics-screen') {
            if (!chartInitialized) {
                initChart();
                chartInitialized = true;
            } else if (window.txnChart) {
                setTimeout(() => {
                    window.txnChart.resize();
                }, 100);
            }
        }
    });
});

// ==========================================
// Modal Logic
// ==========================================
document.getElementById('add-customer-btn').addEventListener('click', () => {
    openCustomerModal();
});

document.getElementById('add-transaction-btn').addEventListener('click', () => {
    if(populateCustomerDropdown()) {
        openModal(transactionModal);
    }
});

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        closeModal(document.getElementById(modalId));
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
});

function openModal(modal) {
    lastFocusedElement = document.activeElement; 
    modal.classList.add('active');
    
    setTimeout(() => {
        const focusable = modal.querySelector('input:not([disabled]), select');
        if (focusable) focusable.focus();
    }, 100);
}

function closeModal(modal) {
    modal.classList.remove('active');
    
    if (modal.id === 'alert-modal') {
        confirmCallback = null;
    }
    
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

function openCustomerModal(index = -1) {
    editIndex = index;
    const title = document.getElementById('customer-modal-title');
    const balanceInput = document.getElementById('customer-balance');
    
    if(index !== -1) {
        title.innerText = "Edit Customer";
        const c = customers[index];
        document.getElementById('customer-index').value = index;
        document.getElementById('customer-name').value = c.name;
        document.getElementById('customer-phone').value = c.phone;
        document.getElementById('customer-location').value = c.location;
        document.getElementById('customer-balance').value = c.balance;
        balanceInput.disabled = true;
    } else {
        title.innerText = "Create New Customer";
        customerForm.reset();
        balanceInput.disabled = false;
    }
    openModal(customerModal);
}

// ==========================================
// Custom Alert/Confirm Logic
// ==========================================
function showAlert(message) {
    alertTitle.innerText = "Notice";
    alertMessage.innerText = message;
    alertCancelBtn.style.display = 'none';
    alertOkBtn.innerText = "OK";
    openModal(alertModal);
}

function showConfirm(message, callback) {
    alertTitle.innerText = "Are you sure?";
    alertMessage.innerText = message;
    alertCancelBtn.style.display = 'block';
    alertOkBtn.innerText = "Confirm";
    alertCancelBtn.innerText = "Cancel";
    confirmCallback = callback;
    openModal(alertModal);
}

alertOkBtn.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') {
        confirmCallback();
    }
    confirmCallback = null;
    closeModal(alertModal);
});

alertCancelBtn.addEventListener('click', () => {
    confirmCallback = null;
    closeModal(alertModal);
});

// ==========================================
// Customer Logic
// ==========================================
customerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const location = document.getElementById('customer-location').value;
    let balance = parseFloat(document.getElementById('customer-balance').value) || 0;
    balance = roundCurrency(balance);
    
    const accNum = editIndex !== -1 ? customers[editIndex].accountNumber : generateId('PESE');
    
    const customerData = {
        accountNumber: accNum,
        name,
        phone,
        location,
        balance: balance
    };
    
    if(editIndex !== -1) {
        customerData.balance = customers[editIndex].balance;
        customers[editIndex] = customerData;
    } else {
        customers.push(customerData);
        
        if (balance > 0) {
            transactions.push({
                id: generateId('TXN'),
                accountNumber: accNum,
                type: 'deposit',
                amount: balance,
                date: new Date().toISOString()
            });
        }
    }
    
    saveData();
    renderCustomers();
    renderTransactions(); 
    closeModal(customerModal);
});

function renderCustomers() {
    const list = document.getElementById('customer-list');
    const searchTerm = customerSearch.value.toLowerCase();
    
    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm) || 
        c.accountNumber.toLowerCase().includes(searchTerm)
    );
    
    if(filteredCustomers.length === 0) {
        list.innerHTML = `<div class="empty-state">No customers found.${searchTerm ? ' Try a different search.' : ' Click "Create New Customer" to start.'}</div>`;
        return;
    }
    
    list.innerHTML = filteredCustomers.map((c) => `
        <div class="customer-card">
            <h3>${escapeHtml(c.name)}</h3>
            <div class="customer-info">
                <p><strong>Acc Num:</strong> ${escapeHtml(c.accountNumber)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(c.phone)}</p>
                <p><strong>Location:</strong> ${escapeHtml(c.location)}</p>
                <p class="balance">Balance: ₵${Number(c.balance || 0).toFixed(2)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="openCustomerModal(${customers.indexOf(c)})">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="btn-delete" onclick="handleDeleteCustomer('${escapeHtml(c.accountNumber)}')">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function handleDeleteCustomer(accNum) {
    const customer = customers.find(c => c.accountNumber === accNum);
    if(!customer) return;
    
    showConfirm(`Are you sure you want to delete ${customer.name}?`, () => {
        customers = customers.filter(c => c.accountNumber !== accNum);
        transactions = transactions.filter(t => t.accountNumber !== accNum);
        
        saveData();
        renderCustomers();
        renderTransactions(); 
    });
}

// ==========================================
// Transaction Logic
// ==========================================
function populateCustomerDropdown() {
    if(customers.length === 0) {
        showAlert("Please create a customer first before adding transactions.");
        return false;
    }
    
    customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
    customers.forEach((c) => {
        const option = document.createElement('option');
        option.value = c.accountNumber;
        option.innerText = `${c.name} (${c.accountNumber}) - Bal: ₵${Number(c.balance || 0).toFixed(2)}`;
        customerSelect.appendChild(option);
    });
    return true;
}

function populateTransactionFilterDropdown() {
    txnFilterCustomer.innerHTML = '<option value="all">All Customers</option>';
    customers.forEach((c) => {
        const option = document.createElement('option');
        option.value = c.accountNumber;
        option.innerText = c.name;
        txnFilterCustomer.appendChild(option);
    });
}

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const accNum = document.getElementById('transaction-customer').value;
    if(!accNum) {
        showAlert("Please select a customer.");
        return;
    }
    
    const customer = customers.find(c => c.accountNumber === accNum);
    if(!customer) return;
    
    const type = document.getElementById('transaction-type').value;
    let amount = parseFloat(document.getElementById('transaction-amount').value);
    
    if (isNaN(amount) || amount <= 0) {
        showAlert("Amount must be a valid number greater than zero.");
        return;
    }
    amount = roundCurrency(amount);
    
    if(type === 'withdrawal' && amount > customer.balance) {
        showAlert(`Insufficient funds! ${customer.name} only has ₵${Number(customer.balance || 0).toFixed(2)}`);
        return;
    }
    
    if(type === 'deposit') {
        customer.balance = roundCurrency(customer.balance + amount);
    } else {
        customer.balance = roundCurrency(customer.balance - amount);
    }
    
    transactions.push({
        id: generateId('TXN'),
        accountNumber: customer.accountNumber,
        type: type,
        amount: amount,
        date: new Date().toISOString()
    });
    
    saveData();
    renderCustomers();
    renderTransactions();
    closeModal(transactionModal);
    transactionForm.reset();
});

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    populateTransactionFilterDropdown();
    
    const typeFilter = txnFilterType.value;
    const custFilter = txnFilterCustomer.value;
    
    let filteredTxns = transactions.filter(t => {
        let match = true;
        if (typeFilter !== 'all') match = match && (t.type === typeFilter);
        if (custFilter !== 'all') match = match && (t.accountNumber === custFilter);
        return match;
    });
    
    if(filteredTxns.length === 0) {
        list.innerHTML = '<div class="empty-state">No transactions found matching your filters.</div>';
        return;
    }
    
    const sortedTxns = [...filteredTxns].reverse();
    
    list.innerHTML = sortedTxns.map(t => {
        const cust = customers.find(c => c.accountNumber === t.accountNumber);
        const displayName = cust ? escapeHtml(cust.name) : 'Deleted Customer';
        const txDate = t.date ? new Date(t.date).toLocaleString() : 'N/A';
        
        return `
        <div class="transaction-item">
            <div class="transaction-info">
                <h4>${displayName}</h4>
                <p>ID: ${escapeHtml(t.id)}</p>
                <p>Acc: ${escapeHtml(t.accountNumber)}</p>
                <p>Type: ${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</p>
                <p>Date: ${txDate}</p>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'deposit' ? '+' : '-'}₵${Number(t.amount || 0).toFixed(2)}
            </div>
            <!-- NEW: Delete Button for Transactions -->
            <button class="btn-delete" onclick="handleDeleteTransaction('${escapeHtml(t.id)}')" style="width: auto; padding: 8px 12px; margin-top: 0; margin-left: 10px; flex-shrink: 0;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        `;
    }).join('');
}

// NEW: Handle deletion of transactions and reverse balance
function handleDeleteTransaction(txnId) {
    const txn = transactions.find(t => t.id === txnId);
    if(!txn) return;
    
    showConfirm(`Are you sure you want to delete this transaction? This will automatically adjust the customer's balance.`, () => {
        // 1. Reverse the balance change on the customer
        const customer = customers.find(c => c.accountNumber === txn.accountNumber);
        if (customer) {
            if (txn.type === 'deposit') {
                customer.balance = roundCurrency(customer.balance - txn.amount);
            } else if (txn.type === 'withdrawal') {
                customer.balance = roundCurrency(customer.balance + txn.amount);
            }
        }
        
        // 2. Remove the transaction
        transactions = transactions.filter(t => t.id !== txnId);
        
        // 3. Save and refresh UI
        saveData();
        renderCustomers();
        renderTransactions();
    });
}

// ==========================================
// Analytics Chart Logic
// ==========================================
function initChart() {
    const ctx = document.getElementById('transactionsChart').getContext('2d');
    
    const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => roundCurrency(sum + Number(t.amount || 0)), 0);
    const withdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => roundCurrency(sum + Number(t.amount || 0)), 0);
    
    window.txnChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Deposits', 'Total Withdrawals'],
            datasets: [{
                data: [deposits, withdrawals],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 14 }, padding: 20 }
                }
            }
        }
    });
}

function updateChart() {
    if(!window.txnChart) return;
    
    const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => roundCurrency(sum + Number(t.amount || 0)), 0);
    const withdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => roundCurrency(sum + Number(t.amount || 0)), 0);
    
    window.txnChart.data.datasets[0].data = [deposits, withdrawals];
    window.txnChart.update();
}

// ==========================================
// Data Export / Import Logic
// ==========================================
exportBtn.addEventListener('click', () => {
    window.print();
});

importBtn.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.customers && data.transactions) {
                showConfirm("Importing will overwrite ALL current data. Are you sure you want to continue?", () => {
                    customers = data.customers;
                    transactions = data.transactions;
                    saveData();
                    renderCustomers();
                    renderTransactions();
                    showAlert("Data imported successfully!");
                });
            } else {
                showAlert("Invalid backup file format.");
            }
        } catch (err) {
            showAlert("Error reading file. Please ensure it is a valid JSON backup.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ==========================================
// Event Listeners for Search/Filter
// ==========================================
customerSearch.addEventListener('input', renderCustomers);
txnFilterType.addEventListener('change', renderTransactions);
txnFilterCustomer.addEventListener('change', renderTransactions);

// ==========================================
// Persistence
// ==========================================
function saveData() {
    localStorage.setItem('susu_customers', JSON.stringify(customers));
    localStorage.setItem('susu_transactions', JSON.stringify(transactions));
    updateChart(); 
}

// ==========================================
// Initialization
// ==========================================
function init() {
    renderCustomers();
    renderTransactions();
}

init();
