// State Management
let customers = JSON.parse(localStorage.getItem('susu_customers')) || [];
let transactions = JSON.parse(localStorage.getItem('susu_transactions')) || [];
let editIndex = -1;

// DOM Elements
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');
const customerModal = document.getElementById('customer-modal');
const transactionModal = document.getElementById('transaction-modal');
const customerForm = document.getElementById('customer-form');
const transactionForm = document.getElementById('transaction-form');
const customerSelect = document.getElementById('transaction-customer');

// --- Navigation Logic ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Resize chart when analytics tab is opened
        if(target === 'analytics-screen' && window.txnChart) {
            window.txnChart.resize();
        }
    });
});

// --- Modal Logic ---
document.getElementById('add-customer-btn').addEventListener('click', () => {
    openCustomerModal();
});

document.getElementById('add-transaction-btn').addEventListener('click', () => {
    populateCustomerDropdown();
    openModal(transactionModal);
});

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        document.getElementById(modalId).classList.remove('active');
    });
});

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function openCustomerModal(index = -1) {
    editIndex = index;
    const title = document.getElementById('customer-modal-title');
    
    if(index !== -1) {
        title.innerText = "Edit Customer";
        const c = customers[index];
        document.getElementById('customer-index').value = index;
        document.getElementById('customer-name').value = c.name;
        document.getElementById('customer-phone').value = c.phone;
        document.getElementById('customer-location').value = c.location;
        document.getElementById('customer-balance').value = c.balance;
    } else {
        title.innerText = "Create New Customer";
        customerForm.reset();
    }
    openModal(customerModal);
}

// --- Customer Logic ---
customerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const location = document.getElementById('customer-location').value;
    const balance = parseFloat(document.getElementById('customer-balance').value);
    
    // Generate Account Number if new
    const accNum = editIndex !== -1 ? customers[editIndex].accountNumber : 'SUS' + Date.now().toString().slice(-6);
    
    const customerData = {
        accountNumber: accNum,
        name,
        phone,
        location,
        balance: balance
    };
    
    if(editIndex !== -1) {
        customers[editIndex] = customerData;
    } else {
        customers.push(customerData);
    }
    
    saveData();
    renderCustomers();
    closeModal(customerModal);
});

function renderCustomers() {
    const list = document.getElementById('customer-list');
    if(customers.length === 0) {
        list.innerHTML = '<div class="empty-state">No customers yet. Click "Create New Customer" to start.</div>';
        return;
    }
    
    list.innerHTML = customers.map((c, index) => `
        <div class="customer-card">
            <h3>${c.name}</h3>
            <div class="customer-info">
                <p><strong>Acc Num:</strong> ${c.accountNumber}</p>
                <p><strong>Phone:</strong> ${c.phone}</p>
                <p><strong>Location:</strong> ${c.location}</p>
                <p class="balance">Balance: ₵${c.balance.toFixed(2)}</p>
            </div>
            <button class="btn-edit" onclick="openCustomerModal(${index})">
                <i class="fa-solid fa-pen-to-square"></i> Edit Customer
            </button>
        </div>
    `).join('');
}

// --- Transaction Logic ---
function populateCustomerDropdown() {
    if(customers.length === 0) {
        alert("Please create a customer first.");
        return false;
    }
    
    customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
    customers.forEach((c, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.innerText = `${c.name} (${c.accountNumber}) - Bal: ₵${c.balance.toFixed(2)}`;
        customerSelect.appendChild(option);
    });
    return true;
}

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const custIndex = parseInt(document.getElementById('transaction-customer').value);
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    
    if(isNaN(custIndex)) {
        alert("Please select a customer.");
        return;
    }
    
    const customer = customers[custIndex];
    
    // Business Logic: Prevent overdraft
    if(type === 'withdrawal' && amount > customer.balance) {
        alert(`Insufficient funds! ${customer.name} only has ₵${customer.balance.toFixed(2)}`);
        return;
    }
    
    // Update Customer Balance
    if(type === 'deposit') {
        customer.balance += amount;
    } else {
        customer.balance -= amount;
    }
    
    // Generate Transaction ID
    const txnId = 'TXN' + Date.now().toString().slice(-8);
    
    // Save Transaction
    transactions.push({
        id: txnId,
        accountNumber: customer.accountNumber,
        customerName: customer.name,
        type: type,
        amount: amount
    });
    
    saveData();
    renderCustomers();
    renderTransactions();
    closeModal(transactionModal);
    transactionForm.reset();
});

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    if(transactions.length === 0) {
        list.innerHTML = '<div class="empty-state">No transactions yet. Click "Add New Transaction" to start.</div>';
        return;
    }
    
    // Sort by newest first
    const sortedTxns = [...transactions].reverse();
    
    list.innerHTML = sortedTxns.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <h4>${t.customerName}</h4>
                <p>ID: ${t.id}</p>
                <p>Acc: ${t.accountNumber}</p>
                <p>Type: ${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</p>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'deposit' ? '+' : '-'}₵${t.amount.toFixed(2)}
            </div>
        </div>
    `).join('');
}

// --- Analytics Chart Logic ---
function initChart() {
    const ctx = document.getElementById('transactionsChart').getContext('2d');
    
    const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
    const withdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);
    
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
    
    const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
    const withdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);
    
    window.txnChart.data.datasets[0].data = [deposits, withdrawals];
    window.txnChart.update();
}

// --- Persistence ---
function saveData() {
    localStorage.setItem('susu_customers', JSON.stringify(customers));
    localStorage.setItem('susu_transactions', JSON.stringify(transactions));
    updateChart(); // Update chart whenever data changes
}

// --- Initialization ---
function init() {
    renderCustomers();
    renderTransactions();
    initChart();
}

init();