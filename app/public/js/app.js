document.addEventListener('DOMContentLoaded', () => {
    loadVehicles();
    loadDashboardRevisions();
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
        loadDashboardRevisions();
    } else if (sectionId === 'daily-entries') {
        loadDailyEntries();
    } else if (sectionId === 'revision-history') {
        loadRevisions();
    } else if (sectionId === 'estimates') {
        loadEstimateHistory();
    } else if (sectionId === 'laminado') {
        loadLaminadoVehicles();
    } else if (sectionId === 'pintura') {
        loadPinturaVehicles();
    } else if (sectionId === 'calendar') {
        loadCalendar();
    }
}

async function loadPinturaVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        if (!response.ok) throw new Error('Error loading vehicles');
        const allVehicles = await response.json();

        // Filter for vehicles that have paint work in their estimate
        // AND are not yet delivered (assuming we want active cars)
        const pinturaVehicles = allVehicles.filter(v => v.has_paint_work && v.current_status_id !== 6);

        const tbody = document.getElementById('pintura-table-body');
        tbody.innerHTML = '';

        if (pinturaVehicles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay vehículos en área de pintura</td></tr>';
            return;
        }

        pinturaVehicles.forEach(vehicle => {
            const tr = document.createElement('tr');

            // Status Presupuesto Badge
            let authBadge = '<span class="badge warning" style="background-color: #f59e0b; color: white;">Pendiente</span>';
            if (vehicle.is_estimate_authorized) {
                authBadge = '<span class="badge success" style="background-color: #10b981; color: white;">Autorizado</span>';
            }

            // Actions
            let actionBtn = '';
            // If Authorized AND NOT currently in Pintura (Status 3) -> Show "Ingresar"
            if (vehicle.is_estimate_authorized && vehicle.current_status_id !== 3) {
                // Check if it's "Ingreso" (1) or "En Proceso" (2) or something else before Pintura
                actionBtn = `<button class="btn-sm" style="background-color: #10b981; color: white; margin-right: 5px;" 
                             onclick="requestPaintAction(${vehicle.id}, 'enter')">Ingresar</button>`;
            }
            // If Currently IN Pintura (Status 3) -> Show "Terminado"
            else if (vehicle.current_status_id === 3) {
                actionBtn = `<button class="btn-sm" style="background-color: #ef4444; color: white; margin-right: 5px;" 
                             onclick="requestPaintAction(${vehicle.id}, 'finish')">Terminado</button>`;
            }

            tr.innerHTML = `
                <td><span class="plate-badge">${vehicle.plate}</span></td>
                <td>${vehicle.brand} ${vehicle.model} (${vehicle.year})</td>
                <td>${vehicle.color || '-'}</td>
                <td>${new Date(vehicle.created_at).toLocaleDateString()}</td>
                <td>${authBadge}</td>
                <td style="display: flex; gap: 5px;">
                    ${actionBtn}
                    <button class="btn-sm" onclick="openVehicleDetails(${vehicle.id}, 'pintura')">Ver Detalle</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading pintura vehicles:', error);
        document.getElementById('pintura-table-body').innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar datos</td></tr>';
    }
}

let pendingPaintAction = null; // { id, action }

function requestPaintAction(id, action) {
    pendingPaintAction = { id, action };
    const modal = document.getElementById('confirmation-modal');
    const title = document.getElementById('conf-modal-title');
    const msg = document.getElementById('conf-modal-msg');
    const btn = document.getElementById('conf-modal-btn');

    if (action === 'enter') {
        title.textContent = 'Ingresar a Pintura';
        msg.textContent = '¿Estás seguro de ingresar este vehículo al área de Pintura? El estatus cambiará a "Pintura".';
        btn.onclick = () => executePaintAction();
        btn.style.backgroundColor = '#10b981';
    } else {
        title.textContent = 'Terminar Pintura';
        msg.textContent = '¿El trabajo de pintura ha finalizado? El vehículo pasará a la siguiente fase (Armado).';
        btn.onclick = () => executePaintAction();
        btn.style.backgroundColor = '#ef4444';
    }

    modal.classList.remove('hidden');
}

async function executePaintAction() {
    if (!pendingPaintAction) return;
    const { id, action } = pendingPaintAction;

    // Determine new status ID
    // 3 = Pintura
    // 4 = Armado
    const newStatusId = action === 'enter' ? 3 : 4;

    try {
        const res = await fetch(`/api/vehicles/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_id: newStatusId })
        });

        if (!res.ok) throw new Error('Error al actualizar estatus');

        closeModal('confirmation-modal');
        alert('Estatus actualizado correctamente');
        loadPinturaVehicles(); // Reload table

    } catch (error) {
        console.error(error);
        alert('Error al actualizar el estatus');
    }
}

// Filter Table Function
function filterTable(tbodyId, searchText) {
    const filter = searchText.toLowerCase();
    const rows = document.getElementById(tbodyId).getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const plateCell = row.getElementsByTagName('td')[0]; // Column 0: Placa
        if (plateCell) {
            const plateText = plateCell.textContent || plateCell.innerText;
            const revisionCode = row.getAttribute('data-revision') || ''; // Hidden Revision Code

            if (plateText.toLowerCase().indexOf(filter) > -1 || revisionCode.toLowerCase().indexOf(filter) > -1) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        }
    }
}

// Helper to add data-search attribute
function addRevisionAttribute(tr, code) {
    if (code) {
        tr.setAttribute('data-revision', code);
    }
}

// --- PINTURA LOGIC ---
async function loadPinturaVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        if (!response.ok) throw new Error('Error loading vehicles');
        const allVehicles = await response.json();

        // Filter: Has paint work AND (Pending OR In Pintura)
        const paintVehicles = allVehicles.filter(v =>
            v.has_paint_work && v.current_status_id <= 3
        );

        const tbody = document.getElementById('pintura-table-body');
        tbody.innerHTML = '';

        if (paintVehicles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay vehículos activos en pintura</td></tr>';
        } else {
            paintVehicles.forEach(vehicle => {
                const tr = document.createElement('tr');
                addRevisionAttribute(tr, vehicle.last_revision_code); // Add revision code for search

                // Status Presupuesto Badge
                let authBadge = '<span class="badge warning" style="background-color: #f59e0b; color: white;">Pendiente</span>';
                if (vehicle.is_estimate_authorized) {
                    authBadge = '<span class="badge success" style="background-color: #10b981; color: white;">Autorizado</span>';
                }

                // Actions
                let actionBtn = '';

                if (vehicle.is_estimate_authorized) {
                    if (vehicle.current_status_id < 3) {
                        actionBtn = `<button class="btn-sm" style="background-color: #10b981; color: white; margin-right: 5px;" 
                                      onclick="requestPaintAction(${vehicle.id}, 'enter')">Ingresar</button>`;
                    } else if (vehicle.current_status_id === 3) {
                        actionBtn = `<button class="btn-sm" style="background-color: #ef4444; color: white; margin-right: 5px;" 
                                      onclick="requestPaintAction(${vehicle.id}, 'finish')">Terminado</button>`;
                    }
                }

                tr.innerHTML = `
                    <td>
                        <span class="plate-badge">${vehicle.plate}</span>
                        ${vehicle.last_revision_code ? `<br><small style="color:#666; font-size:10px;">${vehicle.last_revision_code}</small>` : ''}
                    </td>
                    <td>${vehicle.brand} ${vehicle.model} (${vehicle.year})</td>
                    <td>${vehicle.color || '-'}</td>
                    <td>${new Date(vehicle.created_at).toLocaleDateString()}</td>
                    <td>${authBadge}</td>
                    <td style="display: flex; gap: 5px;">
                        ${actionBtn}
                        <button class="btn-sm" onclick="openVehicleDetails(${vehicle.id}, 'pintura')">Ver Detalle</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        loadPinturaHistory();

    } catch (error) {
        console.error('Error loading pintura vehicles:', error);
        document.getElementById('pintura-table-body').innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar datos</td></tr>';
    }
}

async function loadPinturaHistory() {
    try {
        const response = await fetch('/api/reports/paint-history');
        if (!response.ok) throw new Error('Error loading history');
        const history = await response.json();

        const tbody = document.getElementById('pintura-history-body');
        tbody.innerHTML = '';

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No hay historial de pintura</td></tr>';
            return;
        }

        history.forEach(row => {
            const tr = document.createElement('tr');

            // Format timestamps
            const entryDate = row.entry_date ? new Date(row.entry_date).toLocaleString() : '-';
            const exitDate = row.exit_date ? new Date(row.exit_date).toLocaleString() : '<span style="color:#f59e0b">En Proceso</span>';
            const entryUser = row.entry_user || 'Sistema';
            const exitUser = row.exit_user || '-';

            tr.innerHTML = `
                <td><span class="plate-badge">${row.plate}</span></td>
                <td>${row.brand} ${row.model}</td>
                <td>${row.color || '-'}</td>
                <td>${entryDate}</td>
                <td>${entryUser}</td>
                <td>${exitDate}</td>
                <td>${exitUser}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading pintura history:', error);
    }
}

let pendingLaminadoAction = null;

function requestLaminadoAction(id, action) {
    pendingLaminadoAction = { id, action };
    const modal = document.getElementById('confirmation-modal');
    const title = document.getElementById('conf-modal-title');
    const msg = document.getElementById('conf-modal-msg');
    const btn = document.getElementById('conf-modal-btn');

    if (action === 'enter') {
        title.textContent = 'Ingresar a Laminado';
        msg.textContent = '¿Estás seguro de ingresar este vehículo al área de Laminado?';
        btn.onclick = () => executeLaminadoAction();
        btn.style.backgroundColor = '#10b981';
    } else {
        title.textContent = 'Terminar Laminado';
        msg.textContent = '¿El trabajo de laminado ha finalizado? El vehículo pasará a Pintura.';
        btn.onclick = () => executeLaminadoAction();
        btn.style.backgroundColor = '#ef4444';
    }

    modal.classList.remove('hidden');
}

async function executeLaminadoAction() {
    if (!pendingLaminadoAction) return;
    const { id, action } = pendingLaminadoAction;

    // Status 7 = Laminado
    // Status 3 = Pintura (Assuming next step)
    const newStatusId = action === 'enter' ? 7 : 3;

    try {
        const res = await fetch(`/api/vehicles/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_id: newStatusId })
        });

        if (!res.ok) throw new Error('Error al actualizar estatus');

        closeModal('confirmation-modal');
        alert('Estatus actualizado correctamente');
        loadLaminadoVehicles();

    } catch (error) {
        console.error(error);
        alert('Error al actualizar el estatus');
    }
}


async function loadVehicles() {
    try {
        const response = await fetch('/api/vehicles?status=Ingreso');
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
                <td>${vehicle.color || '-'}</td>
                <td><span class="status-badge">${vehicle.status_name || 'Desconocido'}</span></td>
                <td>${new Date(vehicle.created_at).toLocaleDateString()}</td>
                <td><button class="btn-sm" onclick="openVehicleDetails(${vehicle.id})">Ver</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

async function openVehicleDetails(id, context = 'all') {
    try {
        // Fetch Vehicle
        const vehRes = await fetch(`/api/vehicles/${id}`);
        if (!vehRes.ok) throw new Error('Error al cargar vehículo');
        const vehicle = await vehRes.json();

        // Fetch Estimate
        const estRes = await fetch(`/api/estimates/vehicle/${id}`);
        const estimate = estRes.ok ? await estRes.json() : null;

        // Populate Vehicle Info
        document.getElementById('veh-detail-plate').textContent = vehicle.plate;
        document.getElementById('veh-detail-brand-model').textContent = `${vehicle.brand} ${vehicle.model}`;
        document.getElementById('veh-detail-year').textContent = vehicle.year || '-';
        document.getElementById('veh-detail-color').textContent = vehicle.color || '-';

        // Populate Owner Info
        document.getElementById('veh-detail-owner').textContent = vehicle.owner_name || '-';
        document.getElementById('veh-detail-phone').textContent = vehicle.contact_phone || '-';

        // Populate Status
        document.getElementById('veh-detail-status').textContent = vehicle.status_name || 'Ingreso';

        // Populate Estimate Info
        const estInfoDiv = document.getElementById('veh-estimate-info');
        const noEstDiv = document.getElementById('veh-no-estimate');

        if (estimate) {
            estInfoDiv.classList.remove('hidden');
            noEstDiv.classList.add('hidden');

            document.getElementById('veh-rev-code').textContent = vehicle.revision_code || 'N/A';
            document.getElementById('veh-est-total').textContent = `$${parseFloat(estimate.total_amount || 0).toFixed(2)}`;

            const statusBadge = document.getElementById('veh-est-status');
            const authAmount = parseFloat(estimate.approved_amount);

            if (authAmount > 0) {
                statusBadge.textContent = 'AUTORIZADO';
                statusBadge.className = 'badge success';
                statusBadge.style.backgroundColor = '#10b981';
                statusBadge.style.color = 'white';
            } else {
                statusBadge.textContent = 'COTIZADO';
                statusBadge.className = 'badge warning';
                statusBadge.style.backgroundColor = '#f59e0b';
                statusBadge.style.color = 'white';
            }

            // --- Populate Repair Accordions ---
            const accordionsContainer = document.getElementById('repair-accordions');
            if (accordionsContainer) accordionsContainer.classList.remove('hidden');

            // 1. Reset all accordions
            ['pintura', 'laminado', 'cristales', 'electrico', 'motor', 'extras'].forEach(cat => {
                const contentDiv = document.getElementById(`acc-${cat}`);
                const itemDiv = contentDiv.parentElement; // .accordion-item

                if (contentDiv) contentDiv.innerHTML = '<p class="text-gray-500 italic">Sin items</p>';

                // Context Filtering
                if (context && context !== 'all') {
                    if (cat === context) {
                        itemDiv.classList.remove('hidden');
                        // Auto expand
                        contentDiv.classList.remove('hidden');
                    } else {
                        itemDiv.classList.add('hidden');
                    }
                } else {
                    itemDiv.classList.remove('hidden'); // Show all if no context
                    contentDiv.classList.add('hidden'); // Ensure collapsed
                }
            });

            // 2. Parse data
            if (estimate.data && Array.isArray(estimate.data)) {
                estimate.data.forEach(item => {
                    if (!item.name) return;
                    const catId = `acc-${item.name.toLowerCase()}`;
                    const contentDiv = document.getElementById(catId);

                    if (contentDiv) {
                        // Clear "Sin items" placeholder if it's the first item we see for this cat
                        if (contentDiv.innerHTML.includes('Sin items')) {
                            contentDiv.innerHTML = '';
                        }

                        const itemDiv = document.createElement('div');
                        itemDiv.style.marginBottom = '12px';
                        itemDiv.style.padding = '8px';
                        itemDiv.style.backgroundColor = '#f8fafc';
                        itemDiv.style.borderRadius = '6px';
                        itemDiv.innerHTML = `
                            <p><strong>Desc:</strong> ${item.description || '-'}</p>
                            <p><strong>Monto:</strong> $${parseFloat(item.amount || 0).toFixed(2)}</p>
                            ${item.hasParts ? `<p class="text-sm text-blue-600">Piezas: ${item.partsName || 'Sí'}</p>` : ''}
                        `;
                        contentDiv.appendChild(itemDiv);
                    }
                });
            }

        } else {
            estInfoDiv.classList.add('hidden');
            noEstDiv.classList.remove('hidden');

            // Hide accordions if no estimate
            const accordionsContainer = document.getElementById('repair-accordions');
            if (accordionsContainer) accordionsContainer.classList.add('hidden');
        }

        // Show Modal
        document.getElementById('vehicle-details-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Error opening vehicle details:', error);
        alert('Error al cargar los detalles del vehículo');
    }
}

async function loadDashboardRevisions() {
    try {
        const response = await fetch('/api/revisions');
        const revisions = await response.json();

        // Update total revisions stat
        const totalRevisionsEl = document.getElementById('total-revisions-count');
        if (totalRevisionsEl) {
            totalRevisionsEl.textContent = revisions.length;
        }

        // Optional: limit to recent 5 or 10? User didn't specify, but "recientes" implies it.
        // Let's show last 10 for now.
        // Filter out those already checked in
        const recentRevisions = revisions.filter(r => !r.checked_in).slice(0, 10);

        const tbody = document.getElementById('dashboard-revisions-body');
        tbody.innerHTML = '';

        recentRevisions.forEach(rev => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${rev.revision_code || '#' + rev.id}</strong></td>
                <td>${rev.plate}</td>
                <td>${rev.brand} ${rev.model}</td>
                <td>${new Date(rev.created_at).toLocaleDateString()}</td>
                <td><button class="btn-sm" onclick="showSection('revision-history'); loadRevisions();">Ver</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading dashboard revisions:', error);
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
                <td><button class="btn-sm" onclick="openRevisionDetails(${rev.id})">Ver Detalle</button></td>
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

        // Check if already checked in
        if (data.checked_in) {
            alert('Atención: Esta revisión ya fue ingresada al taller.');
            // Prevent using this revision
            document.getElementById('ingreso_revision_id').value = '';
            document.getElementById('search_revision_code').value = '';
            return;
        }

        // Set Hidden Revision ID
        document.getElementById('ingreso_revision_id').value = data.id;

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
        entry_reason: document.getElementById('entry_reason').value,
        revision_id: document.getElementById('ingreso_revision_id').value
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

function toggleCategoryStatus(checkbox) {
    const catDiv = checkbox.closest('.estimate-category');
    const content = catDiv.querySelector('.category-content');

    if (checkbox.checked) {
        catDiv.style.opacity = '1';
        // content.classList.remove('hidden'); // Optional: auto open?
    } else {
        catDiv.style.opacity = '0.5';
    }
    calculateTotal();
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.estimate-category').forEach(catDiv => {
        const checkbox = catDiv.querySelector('.cat-enable-check');
        // Only sum if checkbox exists and is checked
        if (checkbox && checkbox.checked) {
            const input = catDiv.querySelector('.est-amount');
            const val = parseFloat(input.value) || 0;
            total += val;
        }
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
                // Skip disabled items
                if (item.enabled === false) return;

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
            // Skip disabled items from selection list
            if (item.enabled === false) return;

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
let currentEstimateVehicleData = null;

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
        document.querySelectorAll('.cat-enable-check').forEach(chk => {
            chk.checked = false;
            toggleCategoryStatus(chk);
        });

        // Fill data
        if (estimate.data && Array.isArray(estimate.data)) {
            estimate.data.forEach(item => {
                const catDiv = document.querySelector(`.estimate-category[data-category="${item.name}"]`);
                if (catDiv) {
                    // Enable/Disable category based on saved state
                    const checkbox = catDiv.querySelector('.cat-enable-check');
                    if (checkbox) {
                        // Default to true for backward compatibility if property missing
                        const isEnabled = (item.enabled !== undefined) ? item.enabled : true;
                        checkbox.checked = isEnabled;
                        toggleCategoryStatus(checkbox);

                        // Always ensure content is visible if it has data? 
                        // Or maybe rely on toggleCategoryStatus? 
                        // Let's ensure content panel is accessible if needed, but toggleCategoryStatus handles opacity.
                        // We also need to ensure the accordion is open if it was active? 
                        // The user didn't specify accordion behavior, just data persistence.
                        // We'll keep the logic simple: restore the check.
                    }

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

// Open Revision Full Details Modal
async function openRevisionDetails(id) {
    try {
        const response = await fetch(`/api/revisions/id/${id}`);
        if (!response.ok) throw new Error('Error al cargar revisión');
        const rev = await response.json();

        // Populate Fields
        document.getElementById('view-rev-code').textContent = rev.revision_code || 'Pendiente';

        // Vehicle Info
        document.getElementById('view-plate').textContent = rev.plate || '';
        document.getElementById('view-brand-model').textContent = `${rev.brand} ${rev.model}`;
        document.getElementById('view-year').textContent = rev.year || '';
        document.getElementById('view-color').textContent = rev.color || '';
        document.getElementById('view-serial').textContent = rev.serial_number || '';
        document.getElementById('view-km').textContent = rev.kilometers || '';
        document.getElementById('view-fuel').textContent = rev.fuel_level || '';

        // Owner Info
        document.getElementById('view-owner').textContent = rev.owner_name || '';
        document.getElementById('view-phone').textContent = rev.contact_phone || '';
        document.getElementById('view-email').textContent = rev.email || '';
        document.getElementById('view-rfc').textContent = rev.rfc || '';

        // Insurance & Reason
        document.getElementById('view-reason').textContent = rev.entry_reason || 'Sin motivo especificado';

        const insuranceSection = document.getElementById('view-insurance-section');
        if (rev.is_insurance_claim) {
            insuranceSection.classList.remove('hidden');
            document.getElementById('view-insurance-company').textContent = rev.insurance_company || '';
            document.getElementById('view-policy').textContent = rev.policy_number || '';
        } else {
            insuranceSection.classList.add('hidden');
        }

        // Show Modal
        document.getElementById('revision-details-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Error opening details:', error);
        alert('Error al cargar los detalles de la revisión');
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
    try {
        let vehicleId = document.getElementById('est_vehicle_id').value;
        // console.log('Save Estimate Clicked. VehicleID:', vehicleId, 'EditingID:', editingEstimateId);

        if (!vehicleId && !currentEstimateVehicleData && !editingEstimateId) {
            alert('Primero busca un vehículo');
            return;
        }

        const categories = [];
        document.querySelectorAll('.estimate-category').forEach(catDiv => {
            const checkbox = catDiv.querySelector('.cat-enable-check');
            const isEnabled = checkbox ? checkbox.checked : true;

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
                    parts_name: partsName,
                    enabled: isEnabled
                });
            }
        });

        if (categories.length === 0) {
            alert('Ingresa al menos un dato en alguna categoría');
            return;
        }

        const totalAmount = parseFloat(document.getElementById('est-total-display').textContent);

        const payload = {
            vehicle_id: vehicleId,
            vehicle_details: currentEstimateVehicleData,
            total_amount: totalAmount,
            revision_id: currentEstimateRevisionId,
            data: categories
        };

        let url = '/api/estimates';
        let method = 'POST';

        if (editingEstimateId) {
            url = `/api/estimates/${editingEstimateId}`;
            method = 'PUT';
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
            const errData = await response.json();
            console.error('Save Failure:', errData);
            alert('Error al guardar: ' + (errData.error || 'Desconocido'));
        }
    } catch (error) {
        console.error('Global Save Error:', error);
        alert('Error: ' + error.message);
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

// Utility to close modals
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

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
