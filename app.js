/**
 * Calculate target price based on previous close and predicted change
 * Formula: targetPrice = prevClose * (1 + predictChange / 100)
 * @param {string} prevCloseStr - Previous closing price as string
 * @param {number} predictChange - Predicted change percentage (+/-)
 * @returns {string} - Formatted target price with same decimal places as prevClose
 */
function calculateTargetPrice(prevCloseStr, predictChange) {
    const targetPrice = parseFloat(prevCloseStr) * (1 + predictChange / 100);

    // Match decimal places from prevClose input string
    const decimalIndex = prevCloseStr.indexOf('.');
    const decimalPlaces = decimalIndex > -1 ? prevCloseStr.length - decimalIndex - 1 : 0;

    return targetPrice.toFixed(decimalPlaces);
}

/**
 * Calculate strike list range
 * @param {number} budgetPrice - Budget price (lower strike) - decimal value
 * @param {number} interval - Strike interval
 * @param {number} count - Number of rows to generate on each side (default 5, total 2*count+1 rows)
 * @returns {Array} - Array of objects with lower, upper, isHighlighted, and preciseLower properties
 */
function calculateStrikeList(budgetPrice, interval, count = 5) {
    // Use precise decimal value for center, floor only for display
    const centerLower = budgetPrice;  // Keep decimal for calculations
    const centerUpper = centerLower + interval;

    const lines = [];
    for (let i = -count; i <= count; i++) {
        const preciseLower = centerLower + i;  // Decimal value for calculations
        const preciseUpper = centerUpper + i;
        const displayLower = Math.floor(preciseLower);  // Integer for display
        const displayUpper = Math.floor(preciseUpper);
        lines.push({
            preciseLower: preciseLower,
            preciseUpper: preciseUpper,
            lower: displayLower,
            upper: displayUpper,
            isHighlighted: i === 0
        });
    }
    return lines;
}

/**
 * Render strike list as HTML string with stop-loss and alert prices
 * Returns object with callStrikes and putStrikes for two-column layout
 * @param {Array} strikeList - Array of strike list objects
 * @param {number} predictChange - Predicted change percentage (positive or negative)
 * @param {number} prevClose - Previous close price for change calculation
 * @param {number} targetPrice - Target price (budget price original value) for change calculation
 * @param {string} tagType - 'p' for form display, or 'text' for plain text
 * @returns {object|string} - Object with callStrikes/putStrikes HTML strings, or plain text
 */
function renderStrikeList(strikeList, predictChange, prevClose, targetPrice, tagType = 'p') {
    if (tagType === 'text') {
        return strikeList.map(item => `${item.lower}/${item.upper}`).join('\n');
    }

    // Render strike row HTML
    function renderStrikeRow(item, isCall) {
        // Calculate stop-loss and alert prices based on preciseLower (budget price with decimals)
        let stopLoss, alert;
        if (isCall) {
            // Sell CALL: fear price falls (below budget)
            alert = item.preciseLower - 2;       // 跌 2 元告警
            stopLoss = item.preciseLower - 0.5;  // 跌 0.5 元止损
        } else {
            // Sell PUT: fear price rises (above budget)
            alert = item.preciseLower + 2;       // 涨 2 元告警
            stopLoss = item.preciseLower + 0.5;  // 涨 0.5 元止损
        }

        // Get decimal places from prevClose for consistent precision
        const decimalIndex = prevClose.toString().indexOf('.');
        const decimalPlaces = decimalIndex > -1 ? prevClose.toString().length - decimalIndex - 1 : 0;

        // Calculate strike change from prevClose using strike price (item.preciseLower)
        let strikeChangeValue = 0;
        let strikeChangeSign = '';
        let strikeChangeClass = '';
        let strikeChangeHtml = '';
        if (prevClose && targetPrice && parseFloat(prevClose) > 0) {
            strikeChangeValue = ((item.preciseLower - parseFloat(prevClose)) / parseFloat(prevClose)) * 100;
            strikeChangeSign = strikeChangeValue >= 0 ? '+' : '';
            strikeChangeClass = strikeChangeValue >= 0 ? 'change-positive' : 'change-negative';
            strikeChangeHtml = `<div class="strike-change ${strikeChangeClass}">${strikeChangeSign}${strikeChangeValue.toFixed(2)}%</div>`;
        }

        // Calculate alert change from prevClose using alert price with same precision
        let alertChange = '';
        if (prevClose && targetPrice && parseFloat(prevClose) > 0) {
            const preciseAlert = parseFloat(alert.toFixed(decimalPlaces));
            const change = ((preciseAlert - parseFloat(prevClose)) / parseFloat(prevClose)) * 100;
            const sign = change >= 0 ? '+' : '';
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            alertChange = `<b class="change-badge ${changeClass}">${sign}${change.toFixed(2)}%</b>`;
        }

        // Calculate stop-loss change from prevClose using stop-loss price with same precision
        let stopLossChange = '';
        if (prevClose && targetPrice && parseFloat(prevClose) > 0) {
            const preciseStopLoss = parseFloat(stopLoss.toFixed(decimalPlaces));
            const change = ((preciseStopLoss - parseFloat(prevClose)) / parseFloat(prevClose)) * 100;
            const sign = change >= 0 ? '+' : '';
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            stopLossChange = `<b class="change-badge ${changeClass}">${sign}${change.toFixed(2)}%</b>`;
        }

        const itemClass = item.isHighlighted ? 'strike-item-highlight' : 'strike-item';
        return `<div class="${itemClass}"><div class="strike-price">${item.lower}/${item.upper}</div>${strikeChangeHtml}<div class="sl-alert-box"><b class="alert-text">告警：${alert.toFixed(1)}</b>${alertChange}<b class="stoploss-text">止损：${stopLoss.toFixed(1)}</b>${stopLossChange}</div></div>`;
    }

    // Generate CALL strikes (positive change) and PUT strikes (negative change)
    const callStrikes = strikeList.map(item => renderStrikeRow(item, true)).join('');
    const putStrikes = strikeList.map(item => renderStrikeRow(item, false)).join('');

    return { callStrikes, putStrikes };
}

/**
 * Notification component - replaces alert
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
    `;

    container.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

/**
 * Popconfirm component - replaces confirm
 * @param {string} message - Message to display
 * @param {HTMLElement} targetElement - Element to position near
 * @param {Function} onConfirm - Callback when confirmed
 */
function showPopconfirm(message, targetElement, onConfirm) {
    // Remove existing popconfirm if any
    const existing = document.querySelector('.popconfirm-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'popconfirm-overlay';
    document.body.appendChild(overlay);

    // Create popconfirm
    const popconfirm = document.createElement('div');
    popconfirm.className = 'popconfirm';
    popconfirm.innerHTML = `
        <div class="popconfirm-arrow"></div>
        <div class="popconfirm-content">${message}</div>
        <div class="popconfirm-actions">
            <button class="popconfirm-btn popconfirm-btn-cancel">取消</button>
            <button class="popconfirm-btn popconfirm-btn-confirm">确认</button>
        </div>
    `;

    // Position near target element
    const rect = targetElement.getBoundingClientRect();
    const popconfirmWidth = 250;
    const popconfirmMargin = 10;

    // Calculate horizontal position, keep within viewport
    let left = rect.left + window.scrollX + (rect.width / 2) - (popconfirmWidth / 2);

    // Adjust if would overflow left edge
    if (left < popconfirmMargin) {
        left = popconfirmMargin;
    }
    // Adjust if would overflow right edge
    if (left + popconfirmWidth > window.innerWidth - popconfirmMargin) {
        left = window.innerWidth - popconfirmWidth - popconfirmMargin;
    }

    const top = rect.bottom + window.scrollY + 10;

    popconfirm.style.top = `${top}px`;
    popconfirm.style.left = `${left}px`;

    document.body.appendChild(popconfirm);

    // Handle clicks
    const cancelBtn = popconfirm.querySelector('.popconfirm-btn-cancel');
    const confirmBtn = popconfirm.querySelector('.popconfirm-btn-confirm');

    function cleanup() {
        popconfirm.remove();
        overlay.remove();
    }

    cancelBtn.addEventListener('click', () => {
        cleanup();
    });

    confirmBtn.addEventListener('click', () => {
        cleanup();
        onConfirm();
    });

    overlay.addEventListener('click', () => {
        cleanup();
    });
}

/**
 * Format budget price display with target price
 * @param {number} budgetPrice - User input budget price
 * @param {string} targetPrice - Calculated target price
 * @returns {string} - Format: "budgetPrice(targetPrice)"
 */
function formatBudgetPrice(budgetPrice, targetPrice) {
    return `${budgetPrice}(${targetPrice})`;
}

// localStorage management
const STORAGE_KEY = 'optionChainRecords';

/**
 * Load records from localStorage
 * @returns {Array} - Array of record objects
 */
function loadRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Save records to localStorage
 * @param {Array} records - Array of record objects
 */
function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * Clear the form fields
 */
function clearForm() {
    document.getElementById('prevClose').value = '';
    document.getElementById('predictChange').value = '2';
    document.getElementById('strikeInterval').value = '8';
    document.getElementById('strikeIntervalDisplay').value = '8';
    document.getElementById('strikeCount').value = '5';
    document.getElementById('strikeCountDisplay').value = '5';
    document.getElementById('budgetPrice').textContent = '-';
    document.getElementById('strikeList').innerHTML = '-';

    // Reset strike interval dropdown selected state
    const options = document.querySelectorAll('.el-select-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === 8);
    });

    // Reset strike count dropdown selected state to 11
    const countOptions = document.querySelectorAll('#strikeCountDropdown .el-select-option');
    countOptions.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === 11);
    });
}

/**
 * Format strike list for table display (vertical layout with <p> tags)
 * @param {Array|string} strikeList - Array of strike list objects or string
 * @param {number} predictChange - Predicted change percentage for stop-loss calculation
 * @param {string} prevClose - Previous close price for change calculation
 * @param {number} targetPrice - Target price for change calculation
 * @returns {string} - HTML for table cell
 */
function formatStrikeListForTable(strikeList, predictChange = 0, prevClose = '', targetPrice = 0) {
    // Handle both array format (new) and string format (old data)
    if (Array.isArray(strikeList)) {
        return renderStrikeList(strikeList, predictChange, prevClose, targetPrice, 'p');
    }
    // Fallback for old string data - regenerate the strike list
    // This handles legacy data that was saved before array format
    return strikeList;
}

/**
 * Save a record to localStorage
 */
function saveRecord() {
    const prevClose = document.getElementById('prevClose').value;
    const predictChangeInput = document.getElementById('predictChange').value;
    const strikeInterval = document.getElementById('strikeInterval').value;
    const strikeCountInput = document.getElementById('strikeCount').value;
    const strikeListElement = document.getElementById('strikeList');

    // Validation
    if (!prevClose || !predictChangeInput || !strikeInterval || strikeListElement.innerHTML === '-') {
        showNotification('请先填写所有字段并点击计算', 'warning');
        return;
    }

    const predictChange = parseFloat(predictChangeInput);
    const strikeCount = parseInt(strikeCountInput) || 5;
    const targetPriceCall = calculateTargetPrice(prevClose, predictChange);
    const targetPricePut = calculateTargetPrice(prevClose, -predictChange);
    // Keep decimal precision for calculations (not rounded)
    const budgetPriceNumCall = parseFloat(prevClose) * (1 + predictChange / 100);
    const budgetPriceNumPut = parseFloat(prevClose) * (1 - predictChange / 100);

    const strikeListCall = calculateStrikeList(budgetPriceNumCall, parseFloat(strikeInterval), strikeCount);
    const strikeListPut = calculateStrikeList(budgetPriceNumPut, parseFloat(strikeInterval), strikeCount);

    // Display budget price with rounded integer for display
    const budgetDisplayCall = formatBudgetPrice(Math.floor(budgetPriceNumCall), targetPriceCall);
    const budgetDisplayPut = formatBudgetPrice(Math.floor(budgetPriceNumPut), targetPricePut);

    const record = {
        id: Date.now(),
        prevClose: prevClose,
        predictChange: predictChange,
        budgetPriceCall: budgetPriceNumCall,
        budgetPricePut: budgetPriceNumPut,
        strikeInterval: strikeInterval,
        strikeCount: strikeCount,
        strikeListCall: strikeListCall,
        strikeListPut: strikeListPut,
        targetPriceCall: targetPriceCall,
        targetPricePut: targetPricePut,
        budgetDisplayCall: budgetDisplayCall,
        budgetDisplayPut: budgetDisplayPut,
        savedAt: new Date().toISOString()
    };

    const records = loadRecords();
    records.push(record);
    saveRecords(records);

    renderTable();

    showNotification('记录已保存', 'success');
}

/**
 * Render records to the card list
 */
function renderTable() {
    const records = loadRecords();
    const list = document.getElementById('recordList');
    list.innerHTML = '';

    if (records.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div>暂无记录，填写表单并点击计算保存</div>
            </div>
        `;
        return;
    }

    // Sort records by id descending (newest first)
    const sortedRecords = [...records].sort((a, b) => b.id - a.id);

    sortedRecords.forEach((record, index) => {
        const time = new Date(record.savedAt).toLocaleString('zh-CN');
        const card = document.createElement('div');
        card.className = 'record-card';

        // Handle old data format compatibility
        let callResult, putResult;
        if (record.strikeListCall && record.strikeListPut) {
            // New format
            callResult = renderStrikeList(record.strikeListCall, record.predictChange, record.prevClose, parseFloat(record.targetPriceCall), 'p');
            putResult = renderStrikeList(record.strikeListPut, -record.predictChange, record.prevClose, parseFloat(record.targetPricePut), 'p');
        } else {
            // Old format - regenerate strike lists using precise values
            const budgetPriceCall = parseFloat(record.prevClose) * (1 + record.predictChange / 100);
            const budgetPricePut = parseFloat(record.prevClose) * (1 - record.predictChange / 100);
            const strikeCount = record.strikeCount || 5;  // Default to 5 for old records
            const strikeListCall = calculateStrikeList(budgetPriceCall, parseFloat(record.strikeInterval), strikeCount);
            const strikeListPut = calculateStrikeList(budgetPricePut, parseFloat(record.strikeInterval), strikeCount);
            callResult = renderStrikeList(strikeListCall, record.predictChange, record.prevClose, parseFloat(record.targetPriceCall || record.targetPrice), 'p');
            putResult = renderStrikeList(strikeListPut, -record.predictChange, record.prevClose, parseFloat(record.targetPricePut || record.targetPrice), 'p');
        }

        card.innerHTML = `
            <div class="record-card-header">
                <span class="record-card-time">${time}</span>
                <div class="record-card-actions">
                    <button class="record-card-apply btn btn-secondary" onclick="applyRecord(${record.id}, event)">应用</button>
                    <button class="record-card-delete btn btn-danger" onclick="deleteRecord(${record.id}, event)">删除</button>
                </div>
                <span class="record-card-divider"></span>
                <span class="record-card-item-inline">
                    <span class="record-card-label">昨收价</span>
                    <span class="record-card-value price">${record.prevClose}</span>
                </span>
                <span class="record-card-item-inline">
                    <span class="record-card-label">预测涨跌幅</span>
                    <span class="record-card-value price">${record.predictChange}%</span>
                </span>
                <span class="record-card-item-inline">
                    <span class="record-card-label">行权价间隔</span>
                    <span class="record-card-value price">${record.strikeInterval}</span>
                </span>
            </div>
            <div class="record-card-body">
                <div class="record-card-item strike-list-item">
                    <span class="record-card-label">列举单</span>
                    <div class="strike-list-container calculator-layout">
                        <div class="strike-column">
                            <div class="strike-column-header call">卖 CALL &nbsp;&nbsp; 昨收：${record.prevClose} &nbsp;&nbsp; 间隔：${record.strikeInterval}</div>
                            <div class="change-info call">预测涨跌幅：+${record.predictChange}% &nbsp;&nbsp; 预算价格：${record.budgetDisplayCall || formatBudgetPrice(record.budgetPriceCall, record.targetPriceCall)}</div>
                            ${callResult.callStrikes}
                        </div>
                        <div class="strike-column">
                            <div class="strike-column-header put">卖 PUT &nbsp;&nbsp; 昨收：${record.prevClose} &nbsp;&nbsp; 间隔：${record.strikeInterval}</div>
                            <div class="change-info put">预测涨跌幅：-${record.predictChange}% &nbsp;&nbsp; 预算价格：${record.budgetDisplayPut || formatBudgetPrice(record.budgetPricePut, record.targetPricePut)}</div>
                            ${putResult.putStrikes}
                        </div>
                    </div>
                </div>
            </div>
        `;

        list.appendChild(card);
    });
}

/**
 * Delete a record by id
 * @param {number} id - Record id to delete
 * @param {Event} event - Click event
 */
function deleteRecord(id, event) {
    event.stopPropagation();
    const btn = event.target;
    showPopconfirm('确定要删除这条记录吗？', btn, () => {
        const records = loadRecords().filter(r => r.id !== id);
        saveRecords(records);
        renderTable();
        showNotification('记录已删除', 'success');
    });
}

/**
 * Apply a record to the calculator form
 * @param {number} id - Record id to apply
 * @param {Event} event - Click event
 */
function applyRecord(id, event) {
    event.stopPropagation();
    const records = loadRecords();
    const record = records.find(r => r.id === id);

    if (!record) {
        showNotification('记录不存在', 'error');
        return;
    }

    // Fill form fields
    document.getElementById('prevClose').value = record.prevClose;
    document.getElementById('predictChange').value = Math.abs(record.predictChange);
    document.getElementById('strikeInterval').value = record.strikeInterval;
    document.getElementById('strikeIntervalDisplay').value = record.strikeInterval;
    document.getElementById('strikeCount').value = record.strikeCount || 5;
    document.getElementById('strikeCountDisplay').value = record.strikeCount || 5;

    // Update dropdown selected state
    const options = document.querySelectorAll('.el-select-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === parseInt(record.strikeInterval));
    });

    // Update strike count dropdown selected state
    const countOptions = document.querySelectorAll('#strikeCountDropdown .el-select-option');
    countOptions.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === (record.strikeCount || 5));
    });

    // Trigger calculation
    calculateAndFill();

    showNotification('记录已应用到计算器', 'success');
}

/**
 * Export records to JSON file
 */
function exportData() {
    const records = loadRecords();

    if (records.length === 0) {
        showNotification('没有可导出的记录', 'warning');
        return;
    }

    const dataStr = JSON.stringify(records, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `option-chain-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`已导出 ${records.length} 条记录`, 'success');
}

/**
 * Import records from JSON file
 * @param {Event} event - File input change event
 */
function importData(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedRecords = JSON.parse(e.target.result);

            if (!Array.isArray(importedRecords)) {
                alert('无效的 JSON 文件格式');
                return;
            }

            // Validate record structure
            const validRecords = importedRecords.filter(r =>
                r.id && r.prevClose && r.predictChange && r.budgetPrice
            );

            if (validRecords.length === 0) {
                showNotification('文件中没有有效记录', 'error');
                return;
            }

            // Merge with existing records (avoid duplicates by id)
            const existingRecords = loadRecords();
            const existingIds = new Set(existingRecords.map(r => r.id));

            const newRecords = validRecords.filter(r => !existingIds.has(r.id));

            if (newRecords.length === 0) {
                showNotification('所有记录已存在', 'warning');
                return;
            }

            const merged = [...existingRecords, ...newRecords];
            saveRecords(merged);
            renderTable();

            showNotification(`成功导入 ${newRecords.length} 条记录`, 'success');
        } catch (err) {
            showNotification('JSON 解析失败：' + err.message, 'error');
        }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

/**
 * Calculate and fill budgetPrice and strikeList fields
 */
function calculateAndFill() {
    const prevClose = document.getElementById('prevClose').value;
    const predictChangeInput = document.getElementById('predictChange').value;
    const strikeInterval = document.getElementById('strikeInterval').value;
    const strikeCountInput = document.getElementById('strikeCount').value;

    // Validation
    if (!prevClose || !predictChangeInput || !strikeInterval) {
        showNotification('请先填写昨收价、预测涨跌幅和行权价间隔', 'warning');
        return;
    }

    const predictChange = parseFloat(predictChangeInput);
    const strikeCount = parseInt(strikeCountInput) || 5;
    const targetPriceCall = calculateTargetPrice(prevClose, predictChange);
    const targetPricePut = calculateTargetPrice(prevClose, -predictChange);
    // Keep decimal precision for calculations (not rounded)
    const budgetPriceNumCall = parseFloat(prevClose) * (1 + predictChange / 100);
    const budgetPriceNumPut = parseFloat(prevClose) * (1 - predictChange / 100);

    const strikeListCall = calculateStrikeList(budgetPriceNumCall, parseFloat(strikeInterval), strikeCount);
    const strikeListPut = calculateStrikeList(budgetPriceNumPut, parseFloat(strikeInterval), strikeCount);

    // Display budget price with rounded integer for display
    const budgetDisplayCall = formatBudgetPrice(Math.floor(budgetPriceNumCall), targetPriceCall);
    const budgetDisplayPut = formatBudgetPrice(Math.floor(budgetPriceNumPut), targetPricePut);

    const callResult = renderStrikeList(strikeListCall, predictChange, prevClose, parseFloat(targetPriceCall), 'p');
    const putResult = renderStrikeList(strikeListPut, -predictChange, prevClose, parseFloat(targetPricePut), 'p');

    document.getElementById('strikeList').innerHTML = `
        <div class="strike-list-container calculator-layout">
            <div class="strike-column">
                <div class="strike-column-header call">卖 CALL &nbsp;&nbsp; 昨收：${prevClose} &nbsp;&nbsp; 间隔：${strikeInterval}</div>
                <div class="change-info call">预测涨跌幅：+${predictChange}% &nbsp;&nbsp; 预算价格：${budgetDisplayCall}</div>
                ${callResult.callStrikes}
            </div>
            <div class="strike-column">
                <div class="strike-column-header put">卖 PUT &nbsp;&nbsp; 昨收：${prevClose} &nbsp;&nbsp; 间隔：${strikeInterval}</div>
                <div class="change-info put">预测涨跌幅：-${predictChange}% &nbsp;&nbsp; 预算价格：${budgetDisplayPut}</div>
                ${putResult.putStrikes}
            </div>
        </div>
    `;
}

// Auto-calculate when inputs change
document.addEventListener('DOMContentLoaded', function() {
    // Initialize element-ui style strike interval dropdown (1-230, default 8)
    const strikeIntervalDropdown = document.getElementById('strikeIntervalDropdown');
    for (let i = 1; i <= 230; i++) {
        const option = document.createElement('div');
        option.className = 'el-select-option';
        option.textContent = i;
        option.dataset.value = i;
        if (i === 8) {
            option.classList.add('selected');
        }
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectStrikeInterval(i);
        });
        strikeIntervalDropdown.appendChild(option);
    }

    // Initialize strike count dropdown (preset options: 3, 5, 7, 9, 11, 15, 21, default 5)
    const strikeCountDropdown = document.getElementById('strikeCountDropdown');
    const strikeCountOptions = [3, 5, 7, 9, 11, 15, 21];
    strikeCountOptions.forEach(val => {
        const option = document.createElement('div');
        option.className = 'el-select-option';
        option.textContent = val;
        option.dataset.value = val;
        if (val === 5) {
            option.classList.add('selected');
        }
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectStrikeCount(val);
        });
        strikeCountDropdown.appendChild(option);
    });

    renderTable();

    // Set default prevClose from latest saved record
    const records = loadRecords();
    if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => b.id - a.id);
        const latestRecord = sortedRecords[0];
        document.getElementById('prevClose').value = latestRecord.prevClose;
        calculateAndFill();
    }

    // Auto-calculate when form inputs change
    document.getElementById('prevClose').addEventListener('input', calculateAndFill);
    document.getElementById('predictChange').addEventListener('input', calculateAndFill);
});

// Toggle strike interval dropdown
function toggleStrikeDropdown() {
    const dropdown = document.getElementById('strikeIntervalDropdown');
    const input = document.getElementById('strikeIntervalDisplay');
    const arrow = document.querySelector('.el-select-arrow');
    dropdown.classList.toggle('show');
    input.classList.toggle('active');
    arrow.classList.toggle('open');
}

// Select strike interval value
function selectStrikeInterval(value) {
    document.getElementById('strikeInterval').value = value;
    document.getElementById('strikeIntervalDisplay').value = value;

    // Update selected option
    const options = document.querySelectorAll('.el-select-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === value);
    });

    // Close dropdown
    closeStrikeDropdown();

    // Trigger calculation update
    calculateAndFill();
}

// Close dropdown
function closeStrikeDropdown() {
    document.getElementById('strikeIntervalDropdown').classList.remove('show');
    document.getElementById('strikeIntervalDisplay').classList.remove('active');
    document.querySelector('.el-select-arrow')?.classList.remove('open');
}

// Toggle strike count dropdown
function toggleStrikeCountDropdown() {
    const dropdown = document.getElementById('strikeCountDropdown');
    const input = document.getElementById('strikeCountDisplay');
    const arrow = document.querySelector('#strikeCountSelect .el-select-arrow');
    dropdown.classList.toggle('show');
    input.classList.toggle('active');
    arrow.classList.toggle('open');
}

// Select strike count value
function selectStrikeCount(value) {
    // Validate range (1-50)
    if (value < 1) value = 1;
    if (value > 50) value = 50;

    document.getElementById('strikeCount').value = value;
    document.getElementById('strikeCountDisplay').value = value;

    // Update selected option
    const options = document.querySelectorAll('#strikeCountDropdown .el-select-option');
    options.forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.value) === value);
    });

    // Close dropdown
    closeStrikeCountDropdown();

    // Trigger calculation update
    calculateAndFill();
}

// Close strike count dropdown
function closeStrikeCountDropdown() {
    document.getElementById('strikeCountDropdown').classList.remove('show');
    document.getElementById('strikeCountDisplay').classList.remove('active');
    document.querySelector('#strikeCountSelect .el-select-arrow')?.classList.remove('open');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    const intervalWrapper = document.getElementById('strikeIntervalSelect');
    const countWrapper = document.getElementById('strikeCountSelect');
    if (intervalWrapper && !intervalWrapper.contains(e.target)) {
        closeStrikeDropdown();
    }
    if (countWrapper && !countWrapper.contains(e.target)) {
        closeStrikeCountDropdown();
    }
});
