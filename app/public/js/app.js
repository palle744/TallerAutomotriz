document.addEventListener('DOMContentLoaded', () => {
    loadVehicles();
});

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    // Update active nav
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick').includes(sectionId)) {
            link.classList.add('active');
        }
    });

    if (sectionId === 'dashboard') {
        loadVehicles();
    } else if (sectionId === 'daily-entries') {
        loadDailyEntries();
    } else if (sectionId === 'revision-history') {
        loadRevisions();
    } else if (sectionId === 'estimates') {
        loadEstimateHistory();
    } else if (sectionId === 'calendar') {
        loadCalendar();
    }
}


async function loadVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        const vehicles = await response.json();

        const tbody = document.getElementById('vehicle-table-body');
        tbody.innerHTML = '';

        document.getElementById('total-vehicles').textContent = vehicles.length;
        // Simple logic for "in process" - basically anything not delivered/finished
        const inProcess = vehicles.filter(v => v.current_status_id !== 5 && v.current_status_id !== 6).length;
        document.getElementById('in-process-vehicles').textContent = inProcess;

        vehicles.forEach(vehicle => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${vehicle.plate}</td>
                <td>${vehicle.model}</td>
                <td><span class="status-badge">${vehicle.status_name || 'Desconocido'}</span></td>
                <td>${new Date(vehicle.created_at).toLocaleDateString()}</td>
                <td><button class="btn-sm">Ver</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

async function loadRevisions() {
    try {
        const response = await fetch('/api/revisions');
        const revisions = await response.json();

        const tbody = document.getElementById('revision-history-body');
        tbody.innerHTML = '';

        revisions.forEach(rev => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${rev.revision_code || '#' + rev.id}</strong></td>
                <td>${rev.plate}</td>
                <td>${rev.brand} ${rev.model} (${rev.year || '-'})</td>
                <td>${rev.owner_name || '-'}</td>
                <td>${new Date(rev.created_at).toLocaleDateString()}</td>
                <td><button class="btn-sm">Ver Detalle</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading revisions:', error);
    }
}

async function loadDailyEntries() {
    try {
        const response = await fetch('/api/reports/daily');
        const vehicles = await response.json();

        const tbody = document.getElementById('daily-table-body');
        tbody.innerHTML = '';

        vehicles.forEach(vehicle => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${vehicle.id}</td>
                <td>${vehicle.registered_by_name || 'Desconocido'}</td>
                <td>${vehicle.model}</td>
                <td>${vehicle.year || '-'}</td>
                <td>${vehicle.brand || '-'}</td>
                <td>${vehicle.plate}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading daily entries:', error);
    }
}

// Search Revision Logic
document.getElementById('btn-search-revision').addEventListener('click', async () => {
    const code = document.getElementById('search_revision_code').value.trim();
    if (!code) {
        alert('Por favor ingresa un código de revisión');
        return;
    }

    try {
        const response = await fetch(`/api/revisions/${code}`);
        if (!response.ok) {
            alert('Revisión no encontrada');
            return;
        }

        const data = await response.json();

        // Populate fields
        document.getElementById('plate').value = data.plate || '';
        document.getElementById('brand').value = data.brand || '';
        document.getElementById('model').value = data.model || '';
        document.getElementById('year').value = data.year || '';
        document.getElementById('color').value = data.color || '';
        document.getElementById('kilometers').value = data.kilometers || '';
        document.getElementById('serial_number').value = data.serial_number || '';
        document.getElementById('fuel_level').value = data.fuel_level || '';

        // Customer Info
        document.getElementById('owner_name').value = data.owner_name || '';
        document.getElementById('contact_phone').value = data.contact_phone || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('rfc').value = data.rfc || '';

        // Insurance Info
        const insuranceCheck = document.getElementById('is_insurance');
        const insuranceFields = document.getElementById('insurance-fields');

        if (data.is_insurance_claim) {
            insuranceCheck.checked = true;
            insuranceFields.classList.remove('hidden');
            document.getElementById('insurance_company').value = data.insurance_company || '';
            document.getElementById('policy_number').value = data.policy_number || '';
            document.getElementById('entry_reason').value = data.entry_reason || '';
            document.getElementById('insurance_company').setAttribute('required', 'true');
            // policy_number usually required if insurance is active? Let's assume yes based on request context.
            document.getElementById('policy_number').setAttribute('required', 'true');
            document.getElementById('entry_reason').setAttribute('required', 'true');
        } else {
            insuranceCheck.checked = false;
            insuranceFields.classList.add('hidden');
            document.getElementById('insurance_company').value = '';
            document.getElementById('policy_number').value = '';
            document.getElementById('entry_reason').value = '';
            document.getElementById('insurance_company').removeAttribute('required');
            document.getElementById('policy_number').removeAttribute('required');
            document.getElementById('entry_reason').removeAttribute('required');
        }

        alert('Datos cargados de la revisión');
    } catch (error) {
        console.error('Error fetching revision:', error);
        alert('Error al buscar la revisión');
    }
});

// Insurance Toggle Logic
const insuranceCheckbox = document.getElementById('is_insurance');
const insuranceFields = document.getElementById('insurance-fields');

if (insuranceCheckbox) {
    insuranceCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            insuranceFields.classList.remove('hidden');
            document.getElementById('insurance_company').setAttribute('required', 'true');
            document.getElementById('policy_number').setAttribute('required', 'true');
            document.getElementById('entry_reason').setAttribute('required', 'true');
        } else {
            insuranceFields.classList.add('hidden');
            document.getElementById('insurance_company').removeAttribute('required');
            document.getElementById('policy_number').removeAttribute('required');
            document.getElementById('entry_reason').removeAttribute('required');
            // Clear values when hiding
            document.getElementById('insurance_company').value = '';
            document.getElementById('entry_reason').value = '';
        }
    });
}

document.getElementById('ingreso-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        plate: document.getElementById('plate').value,
        brand: document.getElementById('brand').value,
        model: document.getElementById('model').value,
        year: document.getElementById('year').value,
        color: document.getElementById('color').value,
        kilometers: document.getElementById('kilometers').value,
        serial_number: document.getElementById('serial_number').value,
        fuel_level: document.getElementById('fuel_level').value,
        owner_name: document.getElementById('owner_name').value,
        contact_phone: document.getElementById('contact_phone').value,
        email: document.getElementById('email').value,
        rfc: document.getElementById('rfc').value,
        is_insurance_claim: document.getElementById('is_insurance').checked,
        insurance_company: document.getElementById('insurance_company').value,
        policy_number: document.getElementById('policy_number').value,
        entry_reason: document.getElementById('entry_reason').value
    };

    try {
        const response = await fetch('/api/vehicles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Vehículo registrado correctamente');
            e.target.reset();
            // Reset toggle manually
            insuranceFields.classList.add('hidden');
            showSection('daily-entries');
        } else {
            const err = await response.json();
            alert('Error al registrar el vehículo: ' + (err.details || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
});


// Revision Toggle Logic
const revInsuranceCheckbox = document.getElementById('rev_is_insurance');
const revInsuranceFields = document.getElementById('rev-insurance-fields');

if (revInsuranceCheckbox) {
    revInsuranceCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            revInsuranceFields.classList.remove('hidden');
            document.getElementById('rev_insurance_company').setAttribute('required', 'true');
            document.getElementById('rev_policy_number').setAttribute('required', 'true');
            document.getElementById('rev_entry_reason').setAttribute('required', 'true');
        } else {
            revInsuranceFields.classList.add('hidden');
            document.getElementById('rev_insurance_company').removeAttribute('required');
            document.getElementById('rev_policy_number').removeAttribute('required');
            document.getElementById('rev_entry_reason').removeAttribute('required');
            document.getElementById('rev_insurance_company').value = '';
            document.getElementById('rev_entry_reason').value = '';
        }
    });
}

document.getElementById('revision-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        plate: document.getElementById('rev_plate').value,
        brand: document.getElementById('rev_brand').value,
        model: document.getElementById('rev_model').value,
        year: document.getElementById('rev_year').value,
        color: document.getElementById('rev_color').value,
        kilometers: document.getElementById('rev_kilometers').value,
        serial_number: document.getElementById('rev_serial_number').value,
        fuel_level: document.getElementById('rev_fuel_level').value,
        owner_name: document.getElementById('rev_owner_name').value,
        contact_phone: document.getElementById('rev_contact_phone').value,
        email: document.getElementById('rev_email').value,
        rfc: document.getElementById('rev_rfc').value,
        is_insurance_claim: document.getElementById('rev_is_insurance').checked,
        insurance_company: document.getElementById('rev_insurance_company').value,
        policy_number: document.getElementById('rev_policy_number').value,
        entry_reason: document.getElementById('rev_entry_reason').value
    };

    try {
        const response = await fetch('/api/revisions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const data = await response.json();
            alert(`Revisión Creada Exitosamente.\nCódigo de Revisión: ${data.revision_code}`);
            document.getElementById('revision-form').reset();
            document.getElementById('rev-insurance-fields').classList.add('hidden');
        } else {
            const err = await response.json();
            alert('Error al crear revisión: ' + (err.details || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
});

// Estimates Toggle Logic
function toggleCategory(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('hidden');
    const arrow = header.querySelector('span:last-child');
    arrow.textContent = content.classList.contains('hidden') ? '▼' : '▲';
}

function toggleParts(checkbox) {
    const partsField = checkbox.parentElement.parentElement.nextElementSibling;
    if (checkbox.checked) {
        partsField.classList.remove('hidden');
    } else {
        partsField.classList.add('hidden');
        partsField.querySelector('input').value = '';
    }
    // Re-calculate not needed here as parts name doesn't affect total currently, but good practice if costs were associated.
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.est-amount').forEach(input => {
        const val = parseFloat(input.value) || 0;
        total += val;
    });
    document.getElementById('est-total-display').textContent = total.toFixed(2);
}

let currentApprovalEstimateId = null;
let currentApprovalData = [];

let allEstimatesCache = [];

async function loadEstimateHistory() {
    try {
        const response = await fetch('/api/estimates');
        allEstimatesCache = await response.json();
        renderEstimatesTable(allEstimatesCache);

        // Setup Filter Listener
        const searchInput = document.getElementById('search-estimate-history');
        if (searchInput) {
            // Remove old listener to avoid duplicates if function called multiple times? 
            // Better: use oninput property or check if listener attached. 
            // cloneNode is a hacky way. Let's just set oninput.
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase().trim();
                const filtered = allEstimatesCache.filter(est =>
                    est.id.toString().includes(term) ||
                    est.plate.toLowerCase().includes(term)
                );
                renderEstimatesTable(filtered);
            };
        }

    } catch (error) {
        console.error('Error fetching estimates:', error);
    }
}

function renderEstimatesTable(estimates) {
    const tbody = document.getElementById('estimates-history-body');
    tbody.innerHTML = '';

    estimates.forEach(est => {
        const row = document.createElement('tr');
        row.dataset.id = est.id;

        // Determine Status Icon
        const isApproved = parseFloat(est.approved_amount) > 0;
        const statusIcon = isApproved ? '✅' : '⏳';
        const statusColor = isApproved ? '#10b981' : '#f59e0b'; // Green or Amber
        const statusTitle = isApproved ? 'Aprobado (Click para editar)' : 'Pendiente (Click para aprobar)';

        // Format Approved Amount
        const approvedAmount = parseFloat(est.approved_amount || 0).toFixed(2);

        row.innerHTML = `
            <td>${est.id}</td>
            <td>${new Date(est.created_at).toLocaleDateString()}</td>
            <td>
                <div style="font-weight:bold;">${est.plate}</div>
                <div style="font-size:0.85em; color:#64748b;">${est.brand} ${est.model}</div>
            </td>
            <td>${est.created_by_user || 'Sistema'}</td>
            <td>$${parseFloat(est.total_amount).toFixed(2)}</td>
            <td>$${approvedAmount}</td>
            <td>${est.approval_notes || '-'}</td>
        `;

        // Actions
        const actionsTd = document.createElement('td');
        actionsTd.className = 'cell-actions';

        // Print Button
        const printBtn = document.createElement('button');
        printBtn.className = 'btn-action btn-print';
        printBtn.title = 'Imprimir Orden de Trabajo';
        printBtn.style.cssText = 'background-color: #64748b; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 4px;';
        printBtn.innerHTML = '🖨️'; // Printer Icon
        printBtn.onclick = () => printAuthorizationReport(est.id);
        actionsTd.appendChild(printBtn);

        // Load Button
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn-action btn-load';
        loadBtn.title = 'Cargar para Editar Contenido';
        loadBtn.style.cssText = 'background-color: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 4px;';
        loadBtn.innerHTML = '📂';
        loadBtn.onclick = () => loadEstimateForEditing(est.id);
        actionsTd.appendChild(loadBtn);

        // Status Button
        const statusBtn = document.createElement('button');
        statusBtn.className = 'btn-action btn-status';
        statusBtn.title = statusTitle;
        statusBtn.style.backgroundColor = statusColor;
        statusBtn.style.color = 'white';
        statusBtn.style.border = 'none';
        statusBtn.style.padding = '6px 10px';
        statusBtn.style.borderRadius = '4px';
        statusBtn.style.cursor = 'pointer';
        statusBtn.innerHTML = statusIcon;
        statusBtn.onclick = () => openApprovalModal(est.id);
        actionsTd.appendChild(statusBtn);

        row.appendChild(actionsTd); // Append the constructed actions TD

        tbody.appendChild(row);
    });

    // Add Listeners
    document.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            loadEstimateForEditing(row.dataset.id);
        });
    });

    document.querySelectorAll('.btn-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            openApprovalModal(row.dataset.id);
        });
    });
}

async function printAuthorizationReport(id) {
    // Open window immediately to avoid popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite las ventanas emergentes (pop-ups) para generar el reporte.');
        return;
    }

    printWindow.document.write('<html><head><title>Generando Reporte...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;}</style></head><body><h2>Generando reporte de autorización...</h2></body></html>');

    try {
        const response = await fetch(`/api/estimates/${id}`);
        if (!response.ok) throw new Error('Error al cargar datos del presupuesto (HTTP ' + response.status + ')');
        const estimate = await response.json();

        let itemsHtml = '';
        let subtotal = 0;

        if (estimate.data && Array.isArray(estimate.data)) {
            estimate.data.forEach(item => {
                const amount = parseFloat(item.amount) || 0;
                subtotal += amount;

                itemsHtml += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description || ''}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${amount.toFixed(2)}</td>
                    </tr>
                `;
            });
        }

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Autorización de Presupuesto - ${estimate.revision_code ? estimate.revision_code : '#' + estimate.id}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .logo-text { font-size: 24px; font-weight: bold; color: #2563eb; }
                    .report-title { font-size: 20px; margin-top: 10px; font-weight: 600; }
                    
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .info-box h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 14px; }
                    
                    .totals { text-align: right; margin-bottom: 40px; }
                    .total-row { display: flex; justify-content: flex-end; gap: 20px; font-size: 16px; margin-bottom: 5px; }
                    .grand-total { font-weight: bold; font-size: 18px; color: #2563eb; }
                    
                    .authorization-section { margin-top: 50px; page-break-inside: avoid; }
                    .auth-text { font-size: 14px; line-height: 1.6; text-align: justify; margin-bottom: 40px; }
                    
                    .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                    .signature-box { width: 45%; text-align: center; }
                    .signature-line { border-top: 1px solid #333; margin-bottom: 10px; }
                    
                    @media print {
                        @page { margin: 0mm; }
                        body { padding: 2cm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-text">AutoFix CRM</div>
                    <div class="report-title">AUTORIZACIÓN DE PRESUPUESTO</div>
                    <div style="margin-top: 5px; font-size: 14px; color: #666;">Folio: ${estimate.revision_code ? estimate.revision_code : '#' + estimate.id} &nbsp;|&nbsp; Fecha: ${new Date().toLocaleDateString()}</div>
                </div>
                
                <div class="info-grid">
                    <div class="info-box">
                        <h3>Información del Cliente</h3>
                        <div class="info-row"><strong>Nombre:</strong> <span>${estimate.owner_name || ''}</span></div>
                        <div class="info-row"><strong>Teléfono:</strong> <span>${estimate.contact_phone || ''}</span></div>
                        <div class="info-row"><strong>Email:</strong> <span>${estimate.email || ''}</span></div>
                        <div class="info-row"><strong>RFC:</strong> <span>${estimate.rfc || 'N/A'}</span></div>
                    </div>
                    
                    <div class="info-box">
                        <h3>Información del Vehículo</h3>
                        <div class="info-row"><strong>Vehículo:</strong> <span>${estimate.brand || ''} ${estimate.model || ''}</span></div>
                        <div class="info-row"><strong>Año:</strong> <span>${estimate.year || ''}</span></div>
                        <div class="info-row"><strong>Placas:</strong> <span>${estimate.plate || ''}</span></div>
                        <div class="info-row"><strong>Color:</strong> <span>${estimate.color || 'N/A'}</span></div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30%">Concepto</th>
                            <th style="width: 50%">Descripción</th>
                            <th style="width: 20%; text-align: right;">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="total-row grand-total">
                        <strong>Total Estimado:</strong>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="authorization-section">
                    <h3>Autorización</h3>
                    <p class="auth-text">
                        Por medio de la presente, autorizo al taller <strong>AutoFix CRM</strong> para realizar las reparaciones 
                        y servicios descritos en este presupuesto. Entiendo que cualquier trabajo adicional que no esté 
                        incluido en este documento requerirá de mi autorización previa. 
                        Acepto los términos y condiciones de servicio.
                    </p>
                    
                    <div class="signatures">
                        <div class="signature-box">
                            <div class="signature-line"></div>
                            <div>Firma del Cliente</div>
                            <div style="font-size: 12px; color: #666;">${estimate.owner_name || ''}</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line"></div>
                            <div>Firma del Taller</div>
                            <div style="font-size: 12px; color: #666;">AutoFix CRM</div>
                        </div>
                    </div>
                </div>
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        // Clear logic for overwriting document
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

    } catch (error) {
        console.error(error);
        printWindow.close();
        alert('Error al generar reporte: ' + error.message);
    }
}

async function openApprovalModal(id) {
    try {
        const response = await fetch(`/api/estimates/${id}`);
        if (!response.ok) throw new Error('Error al cargar presupuesto');
        const estimate = await response.json();

        currentApprovalEstimateId = id;
        currentApprovalData = estimate.data || [];

        // Check APPROVED items
        // Logic: If 'approved' property exists in item, use it. 
        // If not (legacy or new), and approved_amount > 0, maybe all are approved? 
        // For now, default to unchecked if undefined, or check logic below.
        // Better: Default to true if not defined? Or false? 
        // Let's default to false if undefined, unless it's a new approval session.

        const listContainer = document.getElementById('approval-items-list');
        listContainer.innerHTML = '';

        let calculatedTotal = 0;

        currentApprovalData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'approval-item';

            // Checkbox state: 
            // If item.approved is explicit (true/false), use it.
            // If undefined, default to true (to make it easy).
            const isChecked = item.approved !== false;

            div.innerHTML = `
                <div class="approval-item-info">
                    <strong>${item.name}</strong>
                    <div class="text-sm text-gray-500">${item.description || ''}</div>
                </div>
                <div class="approval-item-amount">
                    $${parseFloat(item.amount).toFixed(2)}
                </div>
                <div class="approval-item-check">
                    <input type="checkbox" class="approval-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''}>
                </div>
            `;
            listContainer.appendChild(div);

            if (isChecked) {
                calculatedTotal += parseFloat(item.amount);
            }
        });

        // Set Initial Total
        document.getElementById('approval-total').textContent = calculatedTotal.toFixed(2);

        // Pre-fill notes
        document.getElementById('approval-notes').value = estimate.approval_notes || '';

        // Add Change Listeners to Checkboxes
        document.querySelectorAll('.approval-checkbox').forEach(chk => {
            chk.addEventListener('change', () => {
                recalcApprovalTotal();
            });
        });

        // Show Modal
        document.getElementById('approval-modal').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        alert('Error al abrir modal de autorización');
    }
}

function recalcApprovalTotal() {
    let total = 0;
    document.querySelectorAll('.approval-checkbox').forEach(chk => {
        if (chk.checked) {
            const index = chk.dataset.index;
            const amount = parseFloat(currentApprovalData[index].amount) || 0;
            total += amount;
        }
    });
    document.getElementById('approval-total').textContent = total.toFixed(2);
}

// Modal Actions
document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('approval-modal').classList.add('hidden');
    currentApprovalEstimateId = null;
    currentApprovalData = [];
});

document.getElementById('btn-confirm-approval').addEventListener('click', async () => {
    if (!currentApprovalEstimateId) return;

    if (!confirm('¿Estás seguro de autorizar este presupuesto con el monto seleccionado?')) return;

    // Update data with approval status
    document.querySelectorAll('.approval-checkbox').forEach(chk => {
        const index = chk.dataset.index;
        currentApprovalData[index].approved = chk.checked;
    });

    const approvedAmount = parseFloat(document.getElementById('approval-total').textContent);
    const approvalNotes = document.getElementById('approval-notes').value;

    try {
        const response = await fetch(`/api/estimates/${currentApprovalEstimateId}/approval`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                approved_amount: approvedAmount,
                approval_notes: approvalNotes,
                data: currentApprovalData
            })
        });

        if (response.ok) {
            alert('Presupuesto Autorizado Correctamente');
            document.getElementById('approval-modal').classList.add('hidden');
            loadEstimateHistory();
        } else {
            alert('Error al guardar autorización');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

let editingEstimateId = null;

async function loadEstimateForEditing(id) {
    try {
        const response = await fetch(`/api/estimates/${id}`);
        if (!response.ok) {
            alert('Error al cargar presupuesto');
            return;
        }
        const estimate = await response.json();

        // Check if Approved
        if (parseFloat(estimate.approved_amount) > 0) {
            alert('No se puede modificar un presupuesto ya autorizado.');
            return;
        }

        // Populate Vehicle Info
        document.getElementById('estimate-car-info').classList.remove('hidden');
        document.getElementById('estimate-categories').classList.remove('hidden');
        document.getElementById('est_brand_model').textContent = `${estimate.brand} ${estimate.model} (${estimate.year})`;
        document.getElementById('est_owner').textContent = estimate.owner_name || 'Desconocido';
        document.getElementById('est_vehicle_id').value = estimate.vehicle_id;

        // Populate Categories
        // First reset all
        document.querySelectorAll('.est-desc').forEach(i => i.value = '');
        document.querySelectorAll('.est-amount').forEach(i => i.value = '');
        document.querySelectorAll('.est-has-parts').forEach(i => i.checked = false);
        document.querySelectorAll('.est-parts-name').forEach(i => i.value = '');
        document.querySelectorAll('.estimate-category .parts-field').forEach(div => div.classList.add('hidden'));

        // Fill data
        if (estimate.data && Array.isArray(estimate.data)) {
            estimate.data.forEach(item => {
                const catDiv = document.querySelector(`.estimate-category[data-category="${item.name}"]`);
                if (catDiv) {
                    // Open category if needed? user might prefer them closed. Let's keep closed but filled.
                    // Or open them if they have data?
                    // catDiv.querySelector('.category-content').classList.remove('hidden');

                    catDiv.querySelector('.est-desc').value = item.description || '';
                    catDiv.querySelector('.est-amount').value = item.amount || '';

                    const hasPartsCheck = catDiv.querySelector('.est-has-parts');
                    if (item.has_parts) {
                        hasPartsCheck.checked = true;
                        catDiv.querySelector('.parts-field').classList.remove('hidden');
                        catDiv.querySelector('.est-parts-name').value = item.parts_name || '';
                    }
                }
            });
        }

        calculateTotal();

        // Set Edit Mode
        editingEstimateId = id;
        const saveBtn = document.getElementById('btn-save-estimate');
        saveBtn.textContent = 'Actualizar Presupuesto';
        saveBtn.style.backgroundColor = '#f59e0b'; // Amber for update warning

        // Scroll to top
        document.getElementById('estimates').scrollIntoView({ behavior: 'smooth' });

        alert('Presupuesto ' + id + ' cargado. Realiza tus cambios y pulsa "Actualizar".');

    } catch (error) {
        console.error(error);
        alert('Error al cargar');
    }
}

function toggleRowEditMode(row, isEdit) {
    if (isEdit) {
        row.querySelectorAll('.view-mode').forEach(el => el.classList.add('hidden'));
        row.querySelectorAll('.edit-mode').forEach(el => el.classList.remove('hidden'));
    } else {
        row.querySelectorAll('.view-mode').forEach(el => el.classList.remove('hidden'));
        row.querySelectorAll('.edit-mode').forEach(el => el.classList.add('hidden'));
    }
}

// Search Vehicle for Estimate (via Revision Code)
let currentEstimateRevisionId = null;
document.getElementById('btn-search-estimate').addEventListener('click', async () => {
    // If we search a new vehicle, we should exit edit mode?
    if (editingEstimateId) {
        if (!confirm('Estás editando un presupuesto. ¿Quieres salir del modo edición?')) {
            return;
        }
        exitEditMode();
    }

    const code = document.getElementById('search_estimate_code').value.trim();
    // ... rest of search logic (existing code)
    if (!code) {
        alert('Ingresa un Código de Revisión');
        return;
    }

    try {
        const revResponse = await fetch(`/api/revisions/${code}`);
        if (!revResponse.ok) {
            alert('Revisión no encontrada');
            return;
        }
        const revision = await revResponse.json();
        currentEstimateRevisionId = revision.id;
        const plate = revision.plate;

        const response = await fetch(`/api/vehicles/search/${plate}`);

        let displayVehicle;

        if (response.ok) {
            displayVehicle = await response.json();
            document.getElementById('est_vehicle_id').value = displayVehicle.id;
            currentEstimateVehicleData = null;
        } else {
            displayVehicle = revision;
            document.getElementById('est_vehicle_id').value = '';
            currentEstimateVehicleData = {
                plate: revision.plate,
                brand: revision.brand,
                model: revision.model,
                year: revision.year,
                color: revision.color,
                owner_name: revision.owner_name,
                contact_phone: revision.contact_phone,
                email: revision.email,
                rfc: revision.rfc
            };
        }

        document.getElementById('estimate-car-info').classList.remove('hidden');
        document.getElementById('estimate-categories').classList.remove('hidden');

        document.getElementById('est_brand_model').textContent = `${displayVehicle.brand} ${displayVehicle.model} (${displayVehicle.year})`;
        document.getElementById('est_owner').textContent = displayVehicle.owner_name || 'Desconocido';

    } catch (error) {
        console.error(error);
        alert('Error al buscar información');
    }
});

function exitEditMode() {
    editingEstimateId = null;
    const saveBtn = document.getElementById('btn-save-estimate');
    saveBtn.textContent = 'Guardar Presupuesto';
    saveBtn.style.backgroundColor = ''; // Reset to default primary

    // Clear form
    document.getElementById('search_estimate_code').value = '';
    document.getElementById('estimate-car-info').classList.add('hidden');
    document.getElementById('estimate-categories').classList.add('hidden');
    document.querySelectorAll('.est-desc').forEach(i => i.value = '');
    document.querySelectorAll('.est-amount').forEach(i => i.value = '');
    document.querySelectorAll('.est-has-parts').forEach(i => i.checked = false);
    document.querySelectorAll('.est-parts-name').forEach(i => i.value = '');
    document.querySelectorAll('.estimate-category .parts-field').forEach(div => div.classList.add('hidden'));
    document.getElementById('est-total-display').textContent = '0.00';
    document.getElementById('est_vehicle_id').value = '';
    currentEstimateVehicleData = null;
    currentEstimateRevisionId = null;
}

// Save Estimate
document.getElementById('btn-save-estimate').addEventListener('click', async () => {
    let vehicleId = document.getElementById('est_vehicle_id').value;

    if (!vehicleId && !currentEstimateVehicleData && !editingEstimateId) {
        alert('Primero busca un vehículo');
        return;
    }

    const categories = [];
    document.querySelectorAll('.estimate-category').forEach(catDiv => {
        const name = catDiv.dataset.category;
        const desc = catDiv.querySelector('.est-desc').value;
        const amount = parseFloat(catDiv.querySelector('.est-amount').value) || 0;
        const hasParts = catDiv.querySelector('.est-has-parts').checked;
        const partsName = catDiv.querySelector('.est-parts-name').value;

        if (desc || amount > 0 || hasParts) {
            categories.push({
                name,
                description: desc,
                amount,
                has_parts: hasParts,
                parts_name: partsName
            });
        }
    });

    if (categories.length === 0) {
        alert('Ingresa al menos un dato en alguna categoría');
        return;
    }

    const totalAmount = parseFloat(document.getElementById('est-total-display').textContent);

    const payload = {
        vehicle_id: vehicleId, // Can be empty
        vehicle_details: currentEstimateVehicleData, // Sent if new vehicle
        total_amount: totalAmount,
        revision_id: currentEstimateRevisionId,
        data: categories
    };

    try {
        let url = '/api/estimates';
        let method = 'POST';

        if (editingEstimateId) {
            url = `/api/estimates/${editingEstimateId}`;
            method = 'PUT';
            // Validation: PUT might not accept vehicle creation payload, but vehicle info shouldn't change here strictly speaking unless we allow it. 
            // For now, assume vehicle ID is kept from loading.
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(editingEstimateId ? 'Presupuesto Actualizado Correctamente' : 'Presupuesto Guardado Correctamente');
            exitEditMode();
            loadEstimateHistory();
        } else {
            alert('Error al guardar');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

// Calendar Logic
let calendar;

function loadCalendar() {
    const calendarEl = document.getElementById('calendar-el');
    if (!calendarEl) return;

    // Wait for element to be visible
    setTimeout(() => {
        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día'
                },
                events: async function (info, successCallback, failureCallback) {
                    try {
                        const response = await fetch('/api/revisions');
                        const revisions = await response.json();

                        // Filter only revisions with scheduled_date
                        const events = revisions
                            .filter(rev => rev.scheduled_date)
                            .map(rev => {
                                const isCheckedIn = rev.checked_in;
                                return {
                                    title: `${rev.plate} - ${rev.model}`,
                                    start: rev.scheduled_date,
                                    allDay: false,
                                    backgroundColor: isCheckedIn ? '#10b981' : '#3b82f6', // Green if checked in, Blue otherwise
                                    borderColor: isCheckedIn ? '#059669' : '#2563eb',
                                    extendedProps: { revisionId: rev.id }
                                };
                            });
                        successCallback(events);
                    } catch (error) {
                        console.error('Error fetching events', error);
                        failureCallback(error);
                    }
                },
                dateClick: function (info) {
                    document.getElementById('schedule-date').value = info.dateStr;
                    document.getElementById('schedule-revision-id').value = '';
                    document.getElementById('schedule-time').value = '';
                    document.getElementById('schedule-modal').classList.remove('hidden');
                },
                eventClick: async function (info) {
                    const revId = info.event.extendedProps.revisionId;
                    if (!revId) return;

                    try {
                        const response = await fetch(`/api/revisions/id/${revId}`);
                        if (!response.ok) {
                            alert('No se pudieron cargar los detalles');
                            return;
                        }
                        const details = await response.json();

                        document.getElementById('det-vehicle').textContent = `${details.brand} ${details.model} (${details.year})`;
                        document.getElementById('det-plate').textContent = details.plate;
                        document.getElementById('det-color').textContent = details.color || '-';
                        document.getElementById('det-owner').textContent = details.owner_name;
                        document.getElementById('det-phone').textContent = details.contact_phone;

                        document.getElementById('det-revision-id').value = details.id;

                        // Toggle Cancel Button
                        const btnCancel = document.getElementById('btn-cancel-appt');
                        if (details.checked_in) {
                            btnCancel.style.display = 'none';
                        } else {
                            btnCancel.style.display = 'block';
                        }

                        // Format Date
                        const dateObj = new Date(details.scheduled_date || details.created_at);
                        document.getElementById('det-date').textContent = dateObj.toLocaleString();

                        document.getElementById('det-reason').textContent = details.entry_reason || 'Sin especificar';

                        document.getElementById('event-details-modal').classList.remove('hidden');

                    } catch (error) {
                        console.error(error);
                        alert('Error al obtener detalles');
                    }
                }
            });
            calendar.render();
        } else {
            calendar.refetchEvents();
            calendar.render(); // Re-render to Ensure sizing
        }
    }, 100);
}

// Cancel Appointment Logic
document.getElementById('btn-cancel-appt').addEventListener('click', async () => {
    const revId = document.getElementById('det-revision-id').value;
    if (!revId) return;

    if (confirm('¿Estás seguro de que deseas cancelar esta cita? El registro del vehículo se mantendrá pero saldrá del calendario.')) {
        try {
            const response = await fetch(`/api/revisions/${revId}/unschedule`, { method: 'PUT' });
            if (response.ok) {
                alert('Cita cancelada correctamente');
                document.getElementById('event-details-modal').classList.add('hidden');
                if (calendar) calendar.refetchEvents();
            } else {
                alert('No se pudo cancelar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    }
});

// Check-in Logic
document.getElementById('btn-checkin-appt').addEventListener('click', async () => {
    const revId = document.getElementById('det-revision-id').value;
    if (!revId) return;

    if (confirm('¿Registrar ingreso de este vehículo? Aparecerá en "Ingresos del Día".')) {
        try {
            const response = await fetch(`/api/revisions/${revId}/checkin`, { method: 'POST' });
            if (response.ok) {
                alert('Vehículo ingresado correctamente');
                document.getElementById('event-details-modal').classList.add('hidden');
                // Navigate to Daily Entries to show the result
                showSection('daily-entries');
            } else {
                const err = await response.json();
                alert(err.error || 'Error al registrar ingreso');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    }
});

// Schedule Logic
document.getElementById('btn-close-schedule').addEventListener('click', () => {
    document.getElementById('schedule-modal').classList.add('hidden');
});

document.getElementById('btn-confirm-schedule').addEventListener('click', async () => {
    const dateStr = document.getElementById('schedule-date').value;
    const revCode = document.getElementById('schedule-revision-id').value.trim();
    const timeStr = document.getElementById('schedule-time').value;

    if (!revCode || !timeStr) {
        alert('Por favor completa todos los campos');
        return;
    }

    // Validate Time (Max 18:00)
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours > 18 || (hours === 18 && minutes > 0)) {
        alert('La hora máxima de ingreso es 6:00 PM (18:00)');
        return;
    }
    if (hours < 8) {
        alert('El horario de atención inicia a las 8:00 AM');
        return;
    }

    const scheduledDate = `${dateStr}T${timeStr}:00`;

    try {
        const response = await fetch('/api/revisions/schedule', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                revision_code: revCode,
                scheduled_date: scheduledDate
            })
        });

        if (response.ok) {
            alert('Cita agendada correctamente');
            document.getElementById('schedule-modal').classList.add('hidden');
            if (calendar) calendar.refetchEvents();
        } else {
            const err = await response.json();
            alert(err.error || 'Error al agendar');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

document.getElementById('btn-close-details').addEventListener('click', () => {
    document.getElementById('event-details-modal').classList.add('hidden');
});

// Mobile Sidebar Toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('sidebar');
    const navLinks = document.querySelectorAll('.nav-links a');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    // Close sidebar when clicking a link on mobile
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });
});
