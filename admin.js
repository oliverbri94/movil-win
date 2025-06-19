// --- Elementos del DOM ---
const loginSection = document.getElementById('loginSection');
const adminContent = document.getElementById('adminContent');
const loginForm = document.getElementById('loginForm');
const loginPasswordInput = document.getElementById('loginPassword');
const loginStatusMessage = document.getElementById('loginStatusMessage');
const logoutButton = document.getElementById('logoutButton');

const addParticipantForm = document.getElementById('addParticipantForm');
const sorteoDestinoSelect = document.getElementById('sorteoDestino');
const participantIdInput = document.getElementById('participantId');
const participantNameInput = document.getElementById('participantName');
const participantCityInput = document.getElementById('participantCity');
const participantPhoneInput = document.getElementById('participantPhone');
const participantEmailInput = document.getElementById('participantEmail');
const packageChosenSelect = document.getElementById('packageChosen');
const affiliateNameInput = document.getElementById('affiliateName');
const quantityInput = document.getElementById('quantity');
const statusMessage = document.getElementById('statusMessage');

const participantListUl = document.getElementById('participantList');
const currentCountSpan = document.getElementById('currentCount');
const loaderList = document.getElementById('loaderList');
const addParticipantFormSubmitButton = document.querySelector('#addParticipantForm button[type="submit"]'); // <-- AÑADIR ESTA LÍNEA

const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const adminSidebar = document.querySelector('.admin-sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const currentPageTitle = document.getElementById('currentPageTitle');

// --- Gestión de Sorteos ---
const formGestionSorteo = document.getElementById('formGestionSorteo');
const sorteoEditIdInput = document.getElementById('sorteoEditId');
const nombrePremioDisplayInput = document.getElementById('nombrePremioDisplay');
const nombreBaseArchivoGuiaInput = document.getElementById('nombreBaseArchivoGuia');
const metaParticipacionesSorteoInput = document.getElementById('metaParticipacionesSorteo');
const sorteoActivoCheckbox = document.getElementById('sorteoActivo');
const btnGuardarSorteo = document.getElementById('btnGuardarSorteo');
const btnCancelarEdicionSorteo = document.getElementById('btnCancelarEdicionSorteo');
const statusGestionSorteo = document.getElementById('statusGestionSorteo');
const loaderListaSorteos = document.getElementById('loaderListaSorteos');
const tbodyListaSorteos = document.getElementById('tbodyListaSorteos');
const infoSorteoActualParaParticipaciones = document.getElementById('infoSorteoActualParaParticipaciones');

// Elementos de la Calculadora de Rentabilidad
const calculadoraInputs = [
    document.getElementById('costoPremio'),
    document.getElementById('costoMarketing'),
    document.getElementById('gananciaDeseada'),
    document.getElementById('comisionAfiliado'),
    document.getElementById('porcentajeVentasAfiliado'),
    document.getElementById('comisionPasarelaVariable'),
    document.getElementById('comisionPasarelaFija'),
    document.getElementById('precioBoletoIndividual'),
    document.getElementById('mixVentasIndividual'),
    document.getElementById('mixVentasBasico'),
    document.getElementById('mixVentasAhorro'),
    document.getElementById('mixVentasPro')
].filter(el => el !== null); // Filtra por si algún elemento no existe

// Elementos de Resultados de la Calculadora
const resultadoIPT = document.getElementById('resultadoIPT');
const resultadoMCNB = document.getElementById('resultadoMCNB');
const resultadoPEB = document.getElementById('resultadoPEB');
const resultadoMeta = document.getElementById('resultadoMeta');

// --- Opciones de Sorteo ---
const btnIniciarCuentaRegresiva = document.getElementById('btnIniciarCuentaRegresiva');
const estadoCuentaRegresivaAdminDiv = document.getElementById('estadoCuentaRegresivaAdmin');
const sorteoParaCuentaRegresivaSelect = document.getElementById('sorteoParaCuentaRegresiva');
const finalizarStatusMessage = document.getElementById('finalizarStatusMessage');

// --- Dashboard y Modal ---
const toggleDashboardBtn = document.getElementById('toggleDashboardBtn');
const dashboardStatsDiv = document.getElementById('dashboardStats');
const paquetesChartCanvas = document.getElementById('paquetesChart');
const diarioChartCanvas = document.getElementById('diarioChart');
const historialModal = document.getElementById('historialModal');
const historialModalTitle = document.getElementById('historialModalTitle');
const closeHistorialModalBtn = document.getElementById('closeHistorialModal');
const historialParticipantesLista = document.getElementById('historialParticipantesLista');
const loaderHistorial = document.getElementById('loaderHistorial');
const toggleHistorialBtn = document.getElementById('toggleHistorialBtn');
let adminSorteosData = []; 


let paquetesChartInstance = null;
let diarioChartInstance = null;
let rafflePerformanceChartInstance = null; 
let editandoSorteo = false;
let cuentaRegresivaIntervalAdmin = null;

// --- Funciones de Utilidad ---

/**
 * Muestra un mensaje de estado genérico.
 * @param {HTMLElement} element - El elemento donde mostrar el mensaje.
 * @param {string} message - El mensaje a mostrar.
 * @param {boolean} isError - Si es un mensaje de error.
 * @param {number} duration - Cuánto tiempo mostrar el mensaje en ms.
 */
function showGenericStatusMessage(element, message, isError = false, duration = 7000) {
    if (!element) return;
    element.innerHTML = message;
    element.className = 'status-container ' + (isError ? 'error' : 'success');
    element.classList.remove('oculto');
    setTimeout(() => {
        if (element) element.classList.add('oculto');
    }, duration);
}
/**
 * Actualiza el panel de estadísticas del sorteo seleccionado.
 */
function updateRaffleStatsDisplay() {
    const container = document.getElementById('raffleStatsContainer');
    const selectedId = sorteoDestinoSelect.value;

    // Resetea el estado del botón por defecto
    if (addParticipantFormSubmitButton) {
        addParticipantFormSubmitButton.disabled = false;
        addParticipantFormSubmitButton.textContent = 'Añadir Participación(es)';
        quantityInput.disabled = false;
    }

    if (!selectedId || adminSorteosData.length === 0) {
        container.classList.add('oculto');
        return;
    }

    const sorteoData = adminSorteosData.find(s => s.id_sorteo == selectedId);

    if (sorteoData) {
        const current = sorteoData.participantes_actuales || 0;
        const goal = sorteoData.meta_participaciones || 0;
        const remaining = Math.max(0, goal - current);

        document.getElementById('currentTickets').textContent = current;
        document.getElementById('ticketGoal').textContent = goal;
        document.getElementById('ticketsRemaining').textContent = remaining;
        
        // --- INICIO DE LA NUEVA LÓGICA VISUAL ---
        if (current >= goal) {
            if (addParticipantFormSubmitButton) {
                addParticipantFormSubmitButton.disabled = true;
                addParticipantFormSubmitButton.textContent = 'Meta Alcanzada';
                quantityInput.disabled = true;
            }
        }
        // --- FIN DE LA NUEVA LÓGICA VISUAL ---

        container.classList.remove('oculto');
    } else {
        container.classList.add('oculto');
    }
}

// --- AÑADE ESTA FUNCIÓN COMPLETA EN ADMIN.JS ---
function calcularYActualizarRentabilidad() {
    // Si los elementos no existen en la página, no hacer nada.
    if (!document.getElementById('calculadoraForm')) return;

    // 1. Leer todos los valores de los inputs
    const cp = parseFloat(document.getElementById('costoPremio').value) || 0;
    const cm = parseFloat(document.getElementById('costoMarketing').value) || 0;
    const gd = parseFloat(document.getElementById('gananciaDeseada').value) || 0;
    const ca = (parseFloat(document.getElementById('comisionAfiliado').value) / 100) || 0;
    const pva = (parseFloat(document.getElementById('porcentajeVentasAfiliado').value) / 100) || 0;
    const cvp = (parseFloat(document.getElementById('comisionPasarelaVariable').value) / 100) || 0;
    const cfp = parseFloat(document.getElementById('comisionPasarelaFija').value) || 0;
    const pbi = parseFloat(document.getElementById('precioBoletoIndividual').value) || 0;
    const mv_ind = (parseFloat(document.getElementById('mixVentasIndividual').value) / 100) || 0;
    const mv_bas = (parseFloat(document.getElementById('mixVentasBasico').value) / 100) || 0;
    const mv_aho = (parseFloat(document.getElementById('mixVentasAhorro').value) / 100) || 0;
    const mv_pro = (parseFloat(document.getElementById('mixVentasPro').value) / 100) || 0;

    // 2. Calcular promedios por transacción
    const ipt = (pbi * mv_ind) + (12 * mv_bas) + (28 * mv_aho) + (55 * mv_pro);
    const bpt = (1 * mv_ind) + (6 * mv_bas) + (15 * mv_aho) + (30 * mv_pro);
    const capt = ipt * ca * pva;
    const cppt = (ipt * cvp) + cfp;

    // 3. Calcular margen de contribución
    const mct = ipt - capt - cppt;
    const mcnb = bpt > 0 ? mct / bpt : 0;

    // 4. Calcular punto de equilibrio y meta
    const cft = cp + cm;
    const cft_con_ganancia = cft + gd;
    const puntoEquilibrioBoletos = mcnb > 0 ? cft / mcnb : Infinity;
    const metaVentaBoletos = mcnb > 0 ? cft_con_ganancia / mcnb : Infinity;

    // 5. Actualizar la interfaz
    resultadoIPT.textContent = `$${ipt.toFixed(2)}`;
    resultadoMCNB.textContent = `$${mcnb.toFixed(2)}`;

    if (isFinite(puntoEquilibrioBoletos)) {
        resultadoPEB.textContent = Math.ceil(puntoEquilibrioBoletos);
        resultadoMeta.textContent = `${Math.ceil(metaVentaBoletos)} Boletos`;
    } else {
        resultadoPEB.textContent = "N/A";
        resultadoMeta.textContent = "N/A (Margen Negativo)";
    }
}
/**
 * Obtiene y muestra la lista de afiliados en la tabla de gestión.
 */
async function fetchAndDisplayAffiliates() {
    const loader = document.getElementById('loaderListaAfiliados');
    const tbody = document.getElementById('tbodyListaAfiliados');
    if (!loader || !tbody) {
        console.error("No se encontraron los elementos de la tabla de afiliados.");
        return;
    }

    loader.classList.remove('oculto');
    tbody.innerHTML = ''; // Limpia la tabla antes de llenarla

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`);
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }
        const afiliados = await response.json();

        if (afiliados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay afiliados registrados.</td></tr>';
        } else {
            // TU NÚMERO DE WHATSAPP (Asegúrate de que sea correcto y no incluya el "+")
            const tuNumeroWhatsApp = '593963135510';

            afiliados.forEach(af => {
                const tr = document.createElement('tr');

                // 1. Crear el mensaje pre-escrito para el enlace
                const mensaje = `Hola MOVIL WIN, quiero participar en el sorteo. Mi afiliado es ${af.nombre_completo}.`;
                
                // 2. Codificar el mensaje para que funcione correctamente en una URL
                const mensajeCodificado = encodeURIComponent(mensaje);

                // 3. Construir el enlace completo de WhatsApp
                const enlaceAfiliado = `https://wa.me/${tuNumeroWhatsApp}?text=${mensajeCodificado}`;
                
                // 4. Crear el HTML para la fila de la tabla, incluyendo la nueva celda con el enlace y el botón
                tr.innerHTML = `
                    <td>${af.id_afiliado}</td>
                    <td>${af.nombre_completo}</td>
                    <td>${af.telefono || 'N/A'}</td>
                    <td>
                        <a href="${enlaceAfiliado}" target="_blank" title="Abrir enlace en WhatsApp" style="margin-right: 10px; color: var(--clr-primary); font-weight: 500;">Probar</a>
                        <button class="accion-btn btn-copiar" data-link="${enlaceAfiliado}" title="Copiar enlace">
                            <i class="fas fa-copy"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error al cargar la lista de afiliados:', error);
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar la lista de afiliados. Intenta de nuevo.</td></tr>';
    } finally {
        loader.classList.add('oculto');
    }
}
/**
 * Obtiene y muestra la lista de ganadores en el panel de admin.
 */
async function fetchAndDisplayWinnersForAdmin() {
    const loader = document.getElementById('loaderListaGanadoresAdmin');
    const tbody = document.getElementById('tbodyListaGanadores');
    if (!loader || !tbody) return;

    loader.classList.remove('oculto');
    tbody.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/ganadores`);
        const ganadores = await response.json();

        if (ganadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Aún no hay ganadores registrados.</td></tr>';
        } else {
            ganadores.forEach(g => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${g.nombre}</td>
                    <td>${g.premio}</td>
                    <td>${g.fecha}</td>
                    <td class="winner-image-url">${g.imagenUrl || 'No asignada'}</td>
                    <td>
                        <button class="accion-btn btn-editar" data-id="${g.id}" data-current-url="${g.imagenUrl || ''}" title="Editar Foto">
                            <i class="fas fa-camera"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error al cargar ganadores.</td></tr>';
    } finally {
        loader.classList.add('oculto');
    }
}
/**
 * Rellena el menú desplegable de afiliados en el formulario de participaciones.
 */
async function populateAffiliatesDropdown() {
    const select = document.getElementById('affiliateSelect');
    if (!select) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`);
        const afiliados = await response.json();
        
        select.innerHTML = '<option value="">-- Ninguno --</option>'; // Limpia y resetea

        afiliados.forEach(af => {
            const option = document.createElement('option');
            option.value = af.id_afiliado; // Guardamos el ID en el valor
            option.textContent = af.nombre_completo; // Mostramos el nombre
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error poblando dropdown de afiliados:", error);
    }
}
// --- Lógica de UI y Sesión ---

/**
 * Muestra el panel de administración y oculta el login.
 */
async function showAdminUI() {
    loginSection?.classList.add('oculto');
    adminContent?.classList.remove('oculto');
    await Promise.all([
        fetchInfoSorteoActualParaAdmin(),
        fetchAndDisplayParticipants(),
        cargarListaSorteos(),
        cargarDashboardStats(),
        fetchAndDisplayAffiliates(), 
        populateAffiliatesDropdown(),
        fetchAndDisplayWinnersForAdmin() 

    ]);
    checkAdminCountdownStatus();
}

/**
 * Muestra el login y oculta el panel de administración.
 */
function showLoginUI() {
    loginSection?.classList.remove('oculto');
    adminContent?.classList.add('oculto');
    if (loginPasswordInput) loginPasswordInput.value = '';
}

/**
 * Verifica el estado de la sesión al cargar la página.
 */
async function checkSessionStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`);
        if (response.ok) {
            console.log("Sesión activa detectada.");
            await showAdminUI();
        } else {
            showLoginUI();
        }
    } catch (error) {
        console.error("Error de red verificando sesión:", error);
        showLoginUI();
    }
}

/**
 * Maneja el evento de inicio de sesión.
 * @param {Event} event 
 */
async function handleLogin(event) {
    event.preventDefault();
    const password = loginPasswordInput.value;
    if (!password) {
        showGenericStatusMessage(loginStatusMessage, 'Por favor, introduce la contraseña.', true);
        return;
    }
    showGenericStatusMessage(loginStatusMessage, 'Iniciando sesión...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
        
        loginForm.reset();
        await showAdminUI();
    } catch (error) {
        showGenericStatusMessage(loginStatusMessage, `Error: ${error.message}`, true);
    }
}

/**
 * Maneja el cierre de sesión.
 */
async function handleLogout() {
    showGenericStatusMessage(loginStatusMessage, 'Cerrando sesión...');
    try {
        await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' });
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    } finally {
        showLoginUI();
        if (participantListUl) participantListUl.innerHTML = '';
        if (currentCountSpan) currentCountSpan.textContent = '0';
        if (tbodyListaSorteos) tbodyListaSorteos.innerHTML = '';
    }
}


// --- Lógica de Participantes ---

/**
 * Obtiene y muestra los participantes del sorteo activo.
 */
async function fetchAndDisplayParticipants() {
    if (!participantListUl || !loaderList || !currentCountSpan) return;

    loaderList.classList.remove('oculto');
    participantListUl.innerHTML = '';
    currentCountSpan.textContent = '...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/participantes-activos`);
        if (response.status === 401) {
            showLoginUI();
            showGenericStatusMessage(loginStatusMessage, 'Sesión expirada. Inicia sesión de nuevo.', true);
            return;
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Error [${response.status}]: ${errorData.error}`);
        }
        
        const participants = await response.json();
        currentCountSpan.textContent = participants.length;

        if (participants.length === 0) {
            participantListUl.innerHTML = '<li>No hay boletos digitales registrados para los sorteos activos.</li>';
        } else {
            participants.forEach(p => {
                const li = document.createElement('li');
                let details = `ID: ${p.id_documento || 'N/A'} | Ciudad: ${p.ciudad || 'N/A'}`;
                li.innerHTML = `<span>${p.nombre || 'Sin Nombre'} (Sorteo #${p.sorteo_id})</span> <span class="participant-details">${details}</span> <button class="delete-btn" data-ordenid="${p.orden_id}" title="Eliminar">X</button>`;
                participantListUl.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error cargando lista de participaciones:", error);
        participantListUl.innerHTML = `<li class="error-message">Error al cargar: ${error.message}</li>`;
        currentCountSpan.textContent = 'Error';
    } finally {
        loaderList.classList.add('oculto');
    }
}

/**
 * Obtiene datos de un participante por su cédula para autocompletar el formulario.
 * @param {string} idDocumento
 */
async function fetchParticipantDataForAutocomplete(idDocumento) {
    if (!idDocumento || idDocumento.length !== 10) return;
    
    try {
        const response = await fetch(`/api/participante-datos/${idDocumento}`);
        const result = await response.json();
        if (response.ok && result.success && result.data) {
            if (participantNameInput) participantNameInput.value = result.data.nombre || '';
            if (participantCityInput) participantCityInput.value = result.data.ciudad || '';
            if (participantPhoneInput) participantPhoneInput.value = result.data.celular || '';
            if (participantEmailInput) participantEmailInput.value = result.data.email || '';
        } else {
            // No limpiar nombre, permitir que el admin lo ingrese
            if (participantCityInput) participantCityInput.value = '';
            if (participantPhoneInput) participantPhoneInput.value = '';
            if (participantEmailInput) participantEmailInput.value = '';
        }
    } catch (error) { 
        console.error("Error en autocompletado:", error);
    }
}

/**
 * Maneja el envío del formulario para añadir nuevos boletos.
 * @param {Event} event 
 */
// REEMPLAZA TU FUNCIÓN handleAddParticipant ENTERA CON ESTA VERSIÓN
async function handleAddParticipant(event) {
    event.preventDefault();

    // --- INICIO DE LA MODIFICACIÓN ---
    // 1. Obtenemos una referencia a nuestro nuevo menú desplegable
    const affiliateSelect = document.getElementById('affiliateSelect');
    // 2. Revisamos qué opción se seleccionó y guardamos su TEXTO visible.
    // Si la opción seleccionada no es la primera ("-- Ninguno --"), guardamos el nombre. Si no, guardamos un texto vacío.
    const selectedAffiliateName = affiliateSelect.selectedIndex > 0 ? affiliateSelect.options[affiliateSelect.selectedIndex].text : '';
    // --- FIN DE LA MODIFICACIÓN ---

    const payload = {
        id_documento: participantIdInput.value.trim(),
        nombre: participantNameInput.value.trim(),
        ciudad: participantCityInput?.value.trim(),
        celular: participantPhoneInput?.value.trim(),
        email: participantEmailInput.value.trim(),
        paquete_elegido: packageChosenSelect?.value,
        // 3. Usamos la nueva variable que creamos para enviar el dato correcto al servidor.
        nombre_afiliado: selectedAffiliateName, 
        quantity: parseInt(quantityInput.value, 10),
        sorteo_id: sorteoDestinoSelect.value,
    };

    // El resto de la función (validación, el bloque try/catch, etc.) se mantiene exactamente igual que antes.
    if (!payload.id_documento || !payload.nombre || !payload.sorteo_id) {
        showGenericStatusMessage(statusMessage, 'Cédula, Nombre y Sorteo de Destino son obligatorios.', true);
        return;
    }
    if (!/^\d{10}$/.test(payload.id_documento)) { showGenericStatusMessage(statusMessage, 'La cédula debe contener 10 dígitos.', true); return; }
    if (payload.celular && !/^\d{9,10}$/.test(payload.celular)) { showGenericStatusMessage(statusMessage, 'El celular debe tener 9 o 10 dígitos.', true); return; }
    if (isNaN(payload.quantity) || payload.quantity < 1 || payload.quantity > 500) { showGenericStatusMessage(statusMessage, 'Cantidad inválida (debe ser entre 1 y 500).', true); return; }

    try {
        // ... (El bloque try/catch se mantiene igual)
        const response = await fetch(`${API_BASE_URL}/api/admin/participantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);

        let successMessageContent = `<p>${result.message}</p>`; 

        if (result.whatsappLink) {
            successMessageContent += `<a href="${result.whatsappLink}" target="_blank" class="whatsapp-action-link" style="margin-top: 15px;"><i class="fab fa-whatsapp"></i> Enviar Confirmación por WhatsApp</a>`;
        }

        showGenericStatusMessage(statusMessage, successMessageContent, false, 20000);
        
        const sorteoAfectado = adminSorteosData.find(s => s.id_sorteo == payload.sorteo_id);
        if (sorteoAfectado) {
            sorteoAfectado.participantes_actuales += payload.quantity;
        }
        updateRaffleStatsDisplay();
        fetchAndDisplayParticipants();
        cargarDashboardStats();

        addParticipantForm.reset();
        quantityInput.value = '1';

    } catch (error) {
        showGenericStatusMessage(statusMessage, `Error: ${error.message}`, true);
    }
}
/**
 * Maneja el clic en un botón de eliminar participación.
 * @param {Event} event 
 */
async function handleDeleteParticipant(event) {
    if (!event.target.classList.contains('delete-btn')) return;

    const button = event.target;
    const ordenId = button.dataset.ordenid;
    if (!ordenId || !confirm(`¿Seguro que quieres eliminar la participación con Orden ID: ${ordenId}? Esta acción es irreversible.`)) return;

    button.disabled = true;
    button.textContent = '...';

    try {
        const response = await fetch(`/api/admin/participaciones/${ordenId}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
        
        showGenericStatusMessage(statusMessage, result.message, false);
        await fetchAndDisplayParticipants();
    } catch (error) {
        showGenericStatusMessage(statusMessage, `Error: ${error.message}`, true);
        button.disabled = false;
        button.textContent = 'X';
    }
}

// --- Lógica de Gestión de Sorteos ---

/**
 * Carga la lista de todos los sorteos configurados en la tabla.
 */
async function cargarListaSorteos() {
    if (!tbodyListaSorteos || !loaderListaSorteos) return;
    loaderListaSorteos.classList.remove('oculto');
    tbodyListaSorteos.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`);
        if (!response.ok) throw new Error((await response.json()).error || 'Error de red');
        const sorteos = await response.json();

        if (sorteos.length === 0) {
            tbodyListaSorteos.innerHTML = '<tr><td colspan="7">No hay sorteos configurados.</td></tr>';
        } else {
            sorteos.forEach(sorteo => {
                const tr = document.createElement('tr');
                tr.className = sorteo.status_sorteo === 'activo' ? 'sorteo-activo-row' : '';
                tr.innerHTML = `
                    <td>${sorteo.id_sorteo}</td>
                    <td>${sorteo.nombre_premio_display}</td>
                    <td>${sorteo.nombre_base_archivo_guia}</td>
                    <td>${sorteo.meta_participaciones}</td>
                    <td><span class="status-${sorteo.status_sorteo}">${sorteo.status_sorteo}</span></td>
                    <td>
                        <button class="accion-btn btn-editar" data-id="${sorteo.id_sorteo}" title="Editar Sorteo"><i class="fas fa-edit"></i></button>
                        <button class="accion-btn ${sorteo.status_sorteo === 'activo' ? 'btn-desactivar' : 'btn-activar'}" data-id="${sorteo.id_sorteo}" data-status="${sorteo.status_sorteo}" title="${sorteo.status_sorteo === 'activo' ? 'Desactivar' : 'Activar'}">
                            <i class="fas ${sorteo.status_sorteo === 'activo' ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                        </button>
                        <button class="accion-btn btn-finalizar" data-id="${sorteo.id_sorteo}" title="Finalizar Sorteo" ${sorteo.status_sorteo === 'completado' ? 'disabled' : ''}>
                            <i class="fas fa-archive"></i>
                        </button>
                    </td>
                    <td>
                        <button class="accion-btn btn-historial" data-id="${sorteo.id_sorteo}" data-premio="${sorteo.nombre_premio_display}" title="Ver Historial" ${sorteo.status_sorteo === 'programado' ? 'disabled' : ''}>
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                `;
                tbodyListaSorteos.appendChild(tr);
            });
        }
    } catch (error) {
        tbodyListaSorteos.innerHTML = `<tr><td colspan="7" class="error-message">${error.message}</td></tr>`;
    } finally {
        loaderListaSorteos.classList.add('oculto');
    }
}

/**
 * Prepara el formulario para editar un sorteo existente.
 * @param {object} sorteo - El objeto del sorteo a editar.
 */
function prepararEdicionSorteo(sorteo) {
    if (!formGestionSorteo) return;
    editandoSorteo = true;
    sorteoEditIdInput.value = sorteo.id_sorteo;
    nombrePremioDisplayInput.value = sorteo.nombre_premio_display;
    document.getElementById('imagenUrlSorteo').value = sorteo.imagen_url || ''; // <-- AÑADIR ESTA LÍNEA
    nombreBaseArchivoGuiaInput.value = sorteo.nombre_base_archivo_guia;
    metaParticipacionesSorteoInput.value = sorteo.meta_participaciones;
    sorteoActivoCheckbox.checked = sorteo.status_sorteo === 'activo';
    btnGuardarSorteo.textContent = 'Actualizar Sorteo';
    btnCancelarEdicionSorteo.style.display = 'inline-block';
    formGestionSorteo.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Resetea el formulario de gestión de sorteos.
 */
function resetFormGestionSorteo() {
    if (!formGestionSorteo) return;
    editandoSorteo = false;
    sorteoEditIdInput.value = '';
    formGestionSorteo.reset();
    document.getElementById('imagenUrlSorteo').value = ''; 
    metaParticipacionesSorteoInput.value = '200';
    sorteoActivoCheckbox.checked = false;
    btnGuardarSorteo.textContent = 'Guardar Sorteo';
    btnCancelarEdicionSorteo.style.display = 'none';
}

/**
 * Maneja el guardado (creación o actualización) de un sorteo.
 * @param {Event} event 
 */
async function handleGuardarSorteo(event) {
    event.preventDefault();
    const id = sorteoEditIdInput.value;
    const data = {
        nombre_premio_display: nombrePremioDisplayInput.value.trim(),
        imagen_url: document.getElementById('imagenUrlSorteo').value.trim(), 
        nombre_base_archivo_guia: nombreBaseArchivoGuiaInput.value.trim(),
        meta_participaciones: parseInt(metaParticipacionesSorteoInput.value, 10),
        activo: sorteoActivoCheckbox.checked
    };
    if (!data.nombre_premio_display || !data.nombre_base_archivo_guia || isNaN(data.meta_participaciones) || data.meta_participaciones < 1) {
        showGenericStatusMessage(statusGestionSorteo, "Nombre del premio, nombre base de guía y meta válida son requeridos.", true);
        return;
    }
    const url = editandoSorteo && id ? `/api/admin/sorteos/${id}` : '/api/admin/sorteos';
    const method = editandoSorteo && id ? 'PUT' : 'POST';

    showGenericStatusMessage(statusGestionSorteo, editandoSorteo ? 'Actualizando sorteo...' : 'Guardando nuevo sorteo...');
    try {
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
        
        showGenericStatusMessage(statusGestionSorteo, result.message, false);
        resetFormGestionSorteo();
        await cargarListaSorteos();
        await fetchInfoSorteoActualParaAdmin();
    } catch (error) {
        console.error("Error guardando sorteo:", error);
        showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true);
    }
}

/**
 * Maneja la activación o desactivación de un sorteo.
 * @param {string} sorteoId 
 * @param {string} estadoActual 
 */
async function handleToggleActivarSorteo(sorteoId, estadoActual) {
    const activar = estadoActual !== 'activo';
    if (!confirm(`¿Seguro que quieres ${activar ? 'ACTIVAR' : 'DESACTIVAR'} el sorteo ID ${sorteoId}? ${activar ? 'Esto desactivará cualquier otro sorteo que esté activo.' : ''}`)) return;

    showGenericStatusMessage(statusGestionSorteo, 'Cambiando estado...');
    try {
        const response = await fetch(`/api/admin/sorteos/activar/${sorteoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activar })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        showGenericStatusMessage(statusGestionSorteo, result.message, false);
        await Promise.all([
            cargarListaSorteos(),
            fetchInfoSorteoActualParaAdmin(),
            fetchAndDisplayParticipants()
        ]);
    } catch (error) {
        showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true);
    }
}

/**
 * Maneja la finalización de un sorteo.
 * @param {string} sorteoId 
 */
async function handleFinalizarSorteo(sorteoId) {
    if (!sorteoId || !confirm(`¿Estás seguro de que quieres FINALIZAR el sorteo ID ${sorteoId}? Esta acción lo marcará como 'completado' y no se podrá revertir.`)) return;

    showGenericStatusMessage(finalizarStatusMessage, 'Finalizando sorteo...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sorteos/finalizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sorteo_id: sorteoId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        showGenericStatusMessage(finalizarStatusMessage, result.message, false);
        await Promise.all([cargarListaSorteos(), fetchInfoSorteoActualParaAdmin(), fetchAndDisplayParticipants()]);
    } catch (error) {
        showGenericStatusMessage(finalizarStatusMessage, `Error: ${error.message}`, true);
    }
}

// --- Lógica del Dashboard y Cuenta Regresiva ---

/**
 * Carga los datos y renderiza los gráficos del dashboard.
 */
// Reemplaza tu función existente con esta versión más limpia
async function cargarDashboardStats() {
    if (!paquetesChartCanvas || !diarioChartCanvas || !document.getElementById('rafflePerformanceChart')) {
        console.log("Alguno de los elementos del canvas del dashboard no fue encontrado. Saltando carga de stats.");
        return;
    }

    try {
        // Hacemos una ÚNICA llamada a nuestra nueva y poderosa API
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-avanzado`);
        if (!response.ok) throw new Error("No se pudieron cargar las estadísticas del dashboard.");
        
        const data = await response.json();

        if (data.success && data.stats) {
            // Llamamos a TODAS las funciones para dibujar los componentes del dashboard
            renderRevenue(data.stats.totalRevenue || 0);
            renderRafflePerformanceChart(data.stats.rendimientoSorteos || []);
            renderTopAffiliatesList(data.stats.topAfiliados || []);
            renderPaquetesChart(data.stats.paquetesPopulares || []);
            renderDiarioChart(data.stats.participacionesDiarias || []);
        }
    } catch (error) {
        console.error("Error cargando estadísticas del dashboard:", error);
    }
}
function renderPaquetesChart(data) {
    if (paquetesChartInstance) paquetesChartInstance.destroy();
    const ctx = paquetesChartCanvas.getContext('2d');
    paquetesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(p => p.paquete_elegido),
            datasets: [{
                label: 'Paquetes Populares',
                data: data.map(p => p.count),
                backgroundColor: ['#ff8906', '#7f5af0', '#2cb67d', '#D92E3A', '#2E5C98'],
                borderColor: '#242629',
                borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: '#e4e4e7' } } } }
    });
}

function renderDiarioChart(data) {
    if (diarioChartInstance) diarioChartInstance.destroy();
    const ctx = diarioChartCanvas.getContext('2d');
    diarioChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.dia),
            datasets: [{
                label: 'Boletos Digitales por Día',
                data: data.map(d => d.count),
                fill: true,
                backgroundColor: 'rgba(44, 182, 125, 0.2)',
                borderColor: 'rgba(44, 182, 125, 1)',
                tension: 0.3
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } }, x: { ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } } },
            plugins: { legend: { display: false } }
        }
    });
}

function renderRevenue(totalRevenue) {
    const revenueElement = document.getElementById('totalRevenueStat');
    if (revenueElement) {
        // .toFixed(2) es opcional, por si quieres mostrar centavos
        revenueElement.textContent = `$${totalRevenue.toFixed(0)}`;
    }
}

function renderRafflePerformanceChart(data) {
    const canvas = document.getElementById('rafflePerformanceChart');
    if (!canvas) return;
    if (rafflePerformanceChartInstance) rafflePerformanceChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    rafflePerformanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(s => s.nombre_premio_display.substring(0, 20) + '...'), // Acorta nombres largos
            datasets: [{
                label: 'Boletos Registrados',
                data: data.map(s => s.participantes_actuales),
                backgroundColor: ['#2cb67d', '#7f5af0', '#ff8906', '#ef4565', '#2E5C98'],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Hace el gráfico de barras horizontales
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                 x: { ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } }, 
                 y: { ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } } 
            }
        }
    });
}

function renderTopAffiliatesList(data) {
    const listElement = document.getElementById('topAffiliatesList');
    if (!listElement) return;
    listElement.innerHTML = ''; // Limpia la lista

    if (data.length === 0) {
        listElement.innerHTML = '<li>No hay datos de afiliados.</li>';
        return;
    }

    data.forEach(affiliate => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-name">${affiliate.nombre_afiliado}</span>
            <span class="item-value">${affiliate.total_boletos} boletos</span>
        `;
        listElement.appendChild(li);
    });
}

/**
 * Maneja el inicio de la cuenta regresiva global.
 */
// --- REEMPLAZA TU FUNCIÓN handleIniciarCuentaRegresiva CON ESTA VERSIÓN ---

// --- REEMPLAZA TU FUNCIÓN handleIniciarCuentaRegresiva EN admin.js CON ESTA ---

async function handleIniciarCuentaRegresiva() {
    const sorteoIdSeleccionado = sorteoParaCuentaRegresivaSelect.value;
    if (!sorteoIdSeleccionado) {
        showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, 'Debes seleccionar un sorteo activo para iniciar la cuenta regresiva.', true);
        return;
    }

    const sorteoData = adminSorteosData.find(s => s.id_sorteo == sorteoIdSeleccionado);
    if (!sorteoData) {
        showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, 'Error: No se encontraron los datos del sorteo seleccionado.', true);
        return;
    }

    const meta = sorteoData.meta_participaciones;
    const actuales = sorteoData.participantes_actuales;

    if (actuales < meta) {
        const faltantes = meta - actuales;
        const mensajeError = `No se puede iniciar el sorteo. La meta es de ${meta} boletos y solo hay ${actuales}. Faltan ${faltantes} boletos.`;
        showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, mensajeError, true, 10000);
        return;
    }

    // --- AJUSTE #1: Texto del confirm cambiado a 1 HORA ---
    if (!confirm(`¿Estás seguro de que quieres iniciar la cuenta regresiva de 1 HORA para el sorteo '${sorteoData.nombre_premio_display}'? Esta acción es irreversible.`)) {
        return;
    }

    // --- AJUSTE #2: Cálculo del tiempo cambiado a 1 HORA (60 minutos * 60 segundos * 1000 ms) ---
    const tiempoFinalizacion = new Date().getTime() + (60 * 60 * 1000);

    localStorage.setItem('sorteoTiempoFinalizacion', tiempoFinalizacion.toString());
    localStorage.setItem('sorteoIniciado', 'true');
    localStorage.setItem('sorteoIdParaGiro', sorteoIdSeleccionado.toString());
    
    console.log("Cuenta regresiva de 1 HORA iniciada por admin para sorteo ID:", sorteoIdSeleccionado);

    checkAdminCountdownStatus();
    showGenericStatusMessage(statusGestionSorteo, "¡Cuenta regresiva de 1 HORA iniciada!", false, 10000);
}

/**
 * Revisa y actualiza el estado de la cuenta regresiva en el panel de admin.
 */
function checkAdminCountdownStatus() {
    const tiempoFinalizacionStorage = localStorage.getItem('sorteoTiempoFinalizacion');
    const sorteoIniciadoAdmin = localStorage.getItem('sorteoIniciado');
    
    if (sorteoIniciadoAdmin === 'true' && tiempoFinalizacionStorage) {
        const tiempoFinalizacion = parseInt(tiempoFinalizacionStorage);
        if (tiempoFinalizacion > new Date().getTime()) {
            if(btnIniciarCuentaRegresiva) btnIniciarCuentaRegresiva.disabled = true;
            if(estadoCuentaRegresivaAdminDiv) estadoCuentaRegresivaAdminDiv.classList.remove('oculto');
            
            if (cuentaRegresivaIntervalAdmin) clearInterval(cuentaRegresivaIntervalAdmin);
            cuentaRegresivaIntervalAdmin = setInterval(() => {
                actualizarDisplayCuentaRegresivaAdmin(tiempoFinalizacion);
            }, 1000);
        } else {
            localStorage.removeItem('sorteoTiempoFinalizacion');
            localStorage.removeItem('sorteoIniciado');
            localStorage.removeItem('sorteoIdParaGiro');
            if(btnIniciarCuentaRegresiva) btnIniciarCuentaRegresiva.disabled = false;
        }
    }
}

/**
 * Actualiza el texto del temporizador en el panel.
 * @param {number} tiempoFinalizacion
 */
function actualizarDisplayCuentaRegresivaAdmin(tiempoFinalizacion) {
    if (!estadoCuentaRegresivaAdminDiv) return;
    const restante = tiempoFinalizacion - new Date().getTime();

    if (restante < 0) {
        estadoCuentaRegresivaAdminDiv.innerHTML = "¡El sorteo debería haber comenzado!";
        if (btnIniciarCuentaRegresiva) btnIniciarCuentaRegresiva.disabled = false;
        clearInterval(cuentaRegresivaIntervalAdmin);
        return;
    }
    const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((restante % (1000 * 60)) / 1000);
    estadoCuentaRegresivaAdminDiv.innerHTML = `Sorteo en curso: <span style="color:var(--clr-accent);">${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}</span>`;
}


/**
 * Carga la información de los sorteos activos en los selectores.
 */
async function fetchInfoSorteoActualParaAdmin() {
    if(infoSorteoActualParaParticipaciones) infoSorteoActualParaParticipaciones.textContent = 'Cargando...';
    if(sorteoDestinoSelect) sorteoDestinoSelect.innerHTML = '<option value="">-- Cargando... --</option>';
    if(sorteoParaCuentaRegresivaSelect) sorteoParaCuentaRegresivaSelect.innerHTML = '<option value="">-- Cargando... --</option>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`);
        if (!response.ok) throw new Error('No se pudo obtener la lista de sorteos.');
        
        // Guardamos los datos completos en nuestra variable global
        adminSorteosData = await response.json();
        const sorteosActivos = adminSorteosData.filter(s => s.status_sorteo === 'activo');
        
        const populateSelect = (selectElement) => {
            if (!selectElement) return;
            selectElement.innerHTML = '<option value="">-- Selecciona un sorteo activo --</option>';
            sorteosActivos.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id_sorteo;
                option.textContent = `${s.id_sorteo} - ${s.nombre_premio_display}`;
                selectElement.appendChild(option);
            });
            if (sorteosActivos.length === 0) {
                 selectElement.innerHTML = '<option value="">-- No hay sorteos activos --</option>';
            }
        };

        populateSelect(sorteoDestinoSelect);
        populateSelect(sorteoParaCuentaRegresivaSelect);

        if (infoSorteoActualParaParticipaciones) {
            infoSorteoActualParaParticipaciones.textContent = `${sorteosActivos.length} sorteo(s) activo(s).`;
        }

        // Llamamos a la función para que actualice las estadísticas inmediatamente
        updateRaffleStatsDisplay();

    } catch (error) {
        if(infoSorteoActualParaParticipaciones) infoSorteoActualParaParticipaciones.textContent = 'Error al cargar info.';
    }
}

// --- Modal de Historial ---

/**
 * Muestra el modal con el historial de participantes de un sorteo específico.
 * @param {string} sorteoId 
 * @param {string} premioNombre 
 */
async function mostrarHistorialParticipantes(sorteoId, premioNombre) {
    if (!historialModal) return;
    
    historialModal.style.display = 'block';
    loaderHistorial.classList.remove('oculto');
    historialParticipantesLista.innerHTML = '';
    historialModalTitle.textContent = `Historial de Participantes: ${premioNombre}`;

    try {
        const response = await fetch(`/api/sorteo-participantes/${sorteoId}`);
        if (!response.ok) throw new Error("Error al obtener el historial.");
        const participantesHistorial = await response.json();
        if (participantesHistorial.length === 0) {
            historialParticipantesLista.innerHTML = '<li>No hubo participantes en este sorteo.</li>';
        } else {
            participantesHistorial.forEach(p => {
                const li = document.createElement('li');
                li.textContent = `Orden ID: ${p.orden_id} - Nombre: ${p.nombre} - CI: ${p.id_documento} - Email: ${p.email || 'N/A'}`;
                historialParticipantesLista.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error mostrando historial:", error);
        historialParticipantesLista.innerHTML = `<li style="color:red;">${error.message}</li>`;
    } finally {
        loaderHistorial.classList.add('oculto');
    }
}

document.addEventListener('DOMContentLoaded', async () => {

const packageSelect = document.getElementById('packageChosen');
const quantityInput = document.getElementById('quantity');
    // --- 1. Lógica de Sesión ---
    loginForm?.addEventListener('submit', handleLogin);
    logoutButton?.addEventListener('click', handleLogout);


    // --- 2. Formularios de Gestión ---
    addParticipantForm?.addEventListener('submit', handleAddParticipant);
    formGestionSorteo?.addEventListener('submit', handleGuardarSorteo);
    btnCancelarEdicionSorteo?.addEventListener('click', resetFormGestionSorteo);

    // --- 3. Formulario para Añadir Afiliados ---
    const addAffiliateForm = document.getElementById('addAffiliateForm');
    addAffiliateForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const statusDiv = document.getElementById('statusAffiliateMessage');
        const nameInput = document.getElementById('affiliateNameInput');
        const phoneInput = document.getElementById('affiliatePhoneInput');

        const payload = {
            nombre_completo: nameInput.value,
            telefono: phoneInput.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            showGenericStatusMessage(statusDiv, result.message, false);
            addAffiliateForm.reset();
            // Refrescamos la lista y el dropdown para que aparezca el nuevo afiliado
            fetchAndDisplayAffiliates();
            populateAffiliatesDropdown();

        } catch (error) {
            showGenericStatusMessage(statusDiv, `Error: ${error.message}`, true);
        }
    });
    // Añade un listener a cada input de la calculadora
    calculadoraInputs.forEach(input => {
        input.addEventListener('input', calcularYActualizarRentabilidad);
    });

    // Calcula los valores iniciales al cargar la página
    calcularYActualizarRentabilidad();

    // --- 4. Autocompletado de Cédula ---
    if (participantIdInput) {
        let autocompleteTimeout;
        participantIdInput.addEventListener('input', (event) => {
            clearTimeout(autocompleteTimeout);
            const idValue = event.target.value.trim();
            if (idValue.length === 10) {
                autocompleteTimeout = setTimeout(() => fetchParticipantDataForAutocomplete(idValue), 500);
            }
        });
    }
    // --- PEGA ESTO DENTRO DE document.addEventListener('DOMContentLoaded', ... ) EN ADMIN.JS ---

    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', () => {
            adminSidebar.classList.toggle('is-open');
            sidebarOverlay.classList.toggle('is-open');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            adminSidebar.classList.remove('is-open');
            sidebarOverlay.classList.remove('is-open');
        });
    }

    if (packageSelect) {
        packageSelect.addEventListener('change', () => {
            const selectedOption = packageSelect.value;
            let quantity = 1; // Por defecto
            let isPackage = false;

            if (selectedOption.includes('Pack Básico')) quantity = 5;
            if (selectedOption.includes('Combo Ganador')) quantity = 15;
            if (selectedOption.includes('Fortuna MAX')) quantity = 30;

            if (quantity > 1) {
                isPackage = true;
            }

            quantityInput.value = quantity;
            quantityInput.readOnly = isPackage; // Bloquea el campo si se eligió un paquete
        });
    }
    // --- 5. Eventos de Listas y Tablas (Usando Delegación) ---

    // Para la lista de participaciones (botón de eliminar)
    participantListUl?.addEventListener('click', handleDeleteParticipant);
    
    // Para el selector de sorteo (actualizar las estadísticas)
    sorteoDestinoSelect?.addEventListener('change', updateRaffleStatsDisplay);

    // Para la tabla de gestión de sorteos (editar, activar, etc.)
    tbodyListaSorteos?.addEventListener('click', async (event) => {
        const target = event.target.closest('button.accion-btn');
        if (!target) return;
        
        const sorteoId = target.dataset.id;
        if (!sorteoId) return;

        if (target.classList.contains('btn-editar')) {
            showGenericStatusMessage(statusGestionSorteo, `Cargando datos del sorteo ID ${sorteoId}...`);
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`);
                const sorteos = await response.json();
                if (!response.ok) throw new Error(sorteos.error || "Error cargando sorteo");
                const sorteoAEditar = sorteos.find(s => s.id_sorteo == sorteoId);
                if (sorteoAEditar) prepararEdicionSorteo(sorteoAEditar);
            } catch (error) { showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true); }
        } else if (target.classList.contains('btn-activar') || target.classList.contains('btn-desactivar')) {
            const status = target.dataset.status;
            await handleToggleActivarSorteo(sorteoId, status);
        } else if (target.classList.contains('btn-finalizar')) {
            await handleFinalizarSorteo(sorteoId);
        } else if (target.classList.contains('btn-historial')) {
            const premioNombre = target.dataset.premio;
            await mostrarHistorialParticipantes(sorteoId, premioNombre);
        }
    });

    // Para la tabla de gestión de ganadores (editar foto)
    const winnersTableBody = document.getElementById('tbodyListaGanadores');
    winnersTableBody?.addEventListener('click', async (event) => {
        const button = event.target.closest('button.btn-editar');
        if (!button) return;

        const winnerId = button.dataset.id;
        const currentUrl = button.dataset.currentUrl;
        const statusDiv = document.getElementById('statusGanadorMessage');
        const newUrl = prompt("Introduce la nueva URL de la imagen para este ganador:", currentUrl);

        if (newUrl !== null) { 
            try {
                const response = await fetch(`/api/admin/ganadores/${winnerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imagenUrl: newUrl.trim() })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                showGenericStatusMessage(statusDiv, result.message, false);
                fetchAndDisplayWinnersForAdmin();
            } catch (error) {
                showGenericStatusMessage(statusDiv, `Error: ${error.message}`, true);
            }
        }
    });

    // --- 6. Eventos de Botones de Opciones y Dashboard ---
    toggleDashboardBtn?.addEventListener('click', () => {
        dashboardStatsDiv?.classList.toggle('oculto-flex');
        dashboardStatsDiv?.classList.toggle('dashboard-grid');
    });
    btnIniciarCuentaRegresiva?.addEventListener('click', handleIniciarCuentaRegresiva);

    // --- 7. Eventos del Modal de Historial ---
    closeHistorialModalBtn?.addEventListener('click', () => {
        historialModal.style.display = 'none';
    });
    toggleHistorialBtn?.addEventListener('click', () => {
        historialParticipantesLista.classList.toggle('oculto');
    });
    window.addEventListener('click', (event) => {
        if (event.target == historialModal) {
            historialModal.style.display = "none";
        }
    });

const sidebarNav = document.getElementById('adminSidebarNav');
const adminPages = document.querySelectorAll('.admin-page');
const navLinks = document.querySelectorAll('.admin-sidebar-nav a');

    if (sidebarNav) {
        sidebarNav.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedLink = e.target.closest('a');
            if (!clickedLink) return;

            // Quitar 'active' de todo
            adminPages.forEach(page => page.classList.remove('active'));
            navLinks.forEach(link => link.classList.remove('active'));

            // Añadir 'active' al link y página correctos
            const targetId = clickedLink.dataset.target;
            const targetPage = document.getElementById(targetId);

            if (targetPage) {
                targetPage.classList.add('active');
                clickedLink.classList.add('active');

                // Actualizar el título en la vista móvil
                if (currentPageTitle) {
                    // Usamos .childNodes[1].textContent para obtener solo el texto, sin el ícono
                    currentPageTitle.textContent = clickedLink.childNodes[1] ? clickedLink.childNodes[1].textContent.trim() : 'Dashboard';
                }
            }

            // Cerrar el menú si estamos en vista móvil
            if (window.innerWidth < 992) {
                adminSidebar.classList.remove('is-open');
                sidebarOverlay.classList.remove('is-open');
            }
        });
    }
// --- Lógica para el Modal de Añadir Afiliado Rápido ---
const quickAddAffiliateBtn = document.getElementById('quickAddAffiliateBtn');
const quickAffiliateModal = document.getElementById('quickAffiliateModal');
const closeAffiliateModalBtn = document.getElementById('closeAffiliateModal');
const quickAffiliateForm = document.getElementById('quickAffiliateForm');

if(quickAddAffiliateBtn) {
    quickAddAffiliateBtn.addEventListener('click', () => quickAffiliateModal.style.display = 'block');
}
if(closeAffiliateModalBtn) {
    closeAffiliateModalBtn.addEventListener('click', () => quickAffiliateModal.style.display = 'none');
}

if(quickAffiliateForm) {
    quickAffiliateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusDiv = document.getElementById('quickAffiliateStatus');
        const nameInput = document.getElementById('quickAffiliateName');
        const phoneInput = document.getElementById('quickAffiliatePhone');
        
        const payload = { nombre_completo: nameInput.value, telefono: phoneInput.value };

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            showGenericStatusMessage(statusDiv, result.message, false, 3000);
            
            // Refrescar la lista principal y la tabla de afiliados
            await fetchAndDisplayAffiliates(); 
            await populateAffiliatesDropdown();
            
            // Seleccionar automáticamente el nuevo afiliado
            document.getElementById('affiliateSelect').value = result.id;
            
            // Cerrar el modal después de un breve momento
            setTimeout(() => {
                quickAffiliateModal.style.display = 'none';
                quickAffiliateForm.reset();
            }, 1000);

        } catch (error) {
            showGenericStatusMessage(statusDiv, `Error: ${error.message}`, true);
        }
    });
}

const tbodyListaAfiliados = document.getElementById('tbodyListaAfiliados');

if (tbodyListaAfiliados) {
    tbodyListaAfiliados.addEventListener('click', function(event) {
        const copyButton = event.target.closest('.btn-copiar');

        if (copyButton) {
            const linkToCopy = copyButton.dataset.link;

            // Usamos la API del navegador para copiar al portapapeles
            navigator.clipboard.writeText(linkToCopy).then(() => {
                // Feedback visual para el usuario
                const originalIcon = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="fas fa-check"></i> Copiado';
                copyButton.style.backgroundColor = 'var(--clr-primary)';

                setTimeout(() => {
                    copyButton.innerHTML = originalIcon;
                    copyButton.style.backgroundColor = 'var(--clr-secondary)';
                }, 2000);

            }).catch(err => {
                console.error('Error al copiar el enlace: ', err);
                alert('No se pudo copiar el enlace. Inténtalo manualmente.');
            });
        }
    });
}
    // --- 8. Carga Inicial de Datos de la Aplicación ---
    await checkSessionStatus();
});