// Elementos del DOM
const loginSection = document.getElementById('loginSection');
const adminContent = document.getElementById('adminContent');
const loginForm = document.getElementById('loginForm');
const loginPasswordInput = document.getElementById('loginPassword');
const loginStatusMessage = document.getElementById('loginStatusMessage');
const logoutButton = document.getElementById('logoutButton');

const addParticipantForm = document.getElementById('addParticipantForm');
const participantIdInput = document.getElementById('participantId');
const participantNameInput = document.getElementById('participantName');
const participantCityInput = document.getElementById('participantCity');
const participantPhoneInput = document.getElementById('participantPhone');
const participantEmailInput = document.getElementById('participantEmail');
const packageChosenSelect = document.getElementById('packageChosen');
const affiliateNameInput = document.getElementById('affiliateName');
const quantityInput = document.getElementById('quantity');
const statusMessage = document.getElementById('statusMessage');
const whatsappLinkContainer = document.getElementById('whatsappLinkContainer'); // Si se usa para mostrar el link

const participantListUl = document.getElementById('participantList');
const currentCountSpan = document.getElementById('currentCount');
const loaderList = document.getElementById('loaderList');

// === ELEMENTOS DOM PARA GESTIÓN DE SORTEOS ===
const formGestionSorteo = document.getElementById('formGestionSorteo');
const sorteoEditIdInput = document.getElementById('sorteoEditId');
const nombrePremioDisplayInput = document.getElementById('nombrePremioDisplay');
const nombreBaseArchivoGuiaInput = document.getElementById('nombreBaseArchivoGuia');
const descripcionPremioInput = document.getElementById('descripcionPremio');
const metaParticipacionesSorteoInput = document.getElementById('metaParticipacionesSorteo');
const sorteoActivoCheckbox = document.getElementById('sorteoActivo');
const btnGuardarSorteo = document.getElementById('btnGuardarSorteo');
const btnCancelarEdicionSorteo = document.getElementById('btnCancelarEdicionSorteo');
const statusGestionSorteo = document.getElementById('statusGestionSorteo');
const loaderListaSorteos = document.getElementById('loaderListaSorteos');
const tbodyListaSorteos = document.getElementById('tbodyListaSorteos');
const infoSorteoActualParaParticipaciones = document.getElementById('infoSorteoActualParaParticipaciones');

// === ELEMENTOS DOM PARA OPCIONES DE SORTEO ===
const btnIniciarCuentaRegresiva = document.getElementById('btnIniciarCuentaRegresiva');
const estadoCuentaRegresivaAdminDiv = document.getElementById('estadoCuentaRegresivaAdmin');
const btnFinalizarSorteo = document.getElementById('btnFinalizarSorteo');
const finalizarStatusMessage = document.getElementById('finalizarStatusMessage');
// ===============================================

// === NUEVOS ELEMENTOS DOM PARA DASHBOARD Y MODAL ===
const paquetesChartCanvas = document.getElementById('paquetesChart');
const diarioChartCanvas = document.getElementById('diarioChart');
const historialModal = document.getElementById('historialModal');
const historialModalTitle = document.getElementById('historialModalTitle');
const closeHistorialModalBtn = document.getElementById('closeHistorialModal');
const historialParticipantesLista = document.getElementById('historialParticipantesLista');
const loaderHistorial = document.getElementById('loaderHistorial');
document.getElementById('toggleDashboardBtn').addEventListener('click', function() {
    const stats = document.getElementById('dashboardStats');
    stats.style.display = (stats.style.display === 'none' || stats.style.display === '') ? 'block' : 'none';
});
let paquetesChartInstance = null;
let diarioChartInstance = null;

let editandoSorteo = false;
let cuentaRegresivaIntervalAdmin = null;
/**
 * Muestra un mensaje de estado en un elemento específico.
 */
function showGenericStatusMessage(element, message, isError = false, duration = 7000) {
    if (!element) {
        console.warn("Elemento para mensaje de estado no encontrado:", element, message);
        return;
    }
    element.innerHTML = message;
    element.className = isError ? 'error' : 'success';
    element.classList.remove('oculto');
    setTimeout(() => { if (element) { element.textContent = ''; element.className = ''; element.classList.add('oculto'); } }, duration);
}

/**
 * Muestra las secciones de administración y oculta la de login.
 */
async function showAdminUI() {
    if (loginSection) loginSection.classList.add('oculto');
    if (adminContent) adminContent.classList.remove('oculto');
    await fetchInfoSorteoActualParaAdmin();
    fetchAndDisplayParticipants();
    cargarListaSorteos();
    checkAdminCountdownStatus();
    cargarDashboardStats(); // <<<--- Llamar a la nueva función de estadísticas    
}

/**
 * Muestra la sección de login y oculta las de administración.
 */
function showLoginUI() {
    if (loginSection) loginSection.classList.remove('oculto');
    if (adminContent) adminContent.classList.add('oculto');
    if (loginPasswordInput) loginPasswordInput.value = '';
}

/**
 * Verifica el estado de la sesión al cargar la página.
 */
async function checkSessionStatus() {
    console.log("Verificando estado de sesión...");
    try {
        const response = await fetch('/api/sorteos');
        if (response.ok) {
            console.log("Sesión activa detectada.");
            await showAdminUI();
        } else {
            if (response.status === 401) {
                console.log("No hay sesión activa o es inválida (401).");
            } else {
                const errorData = await response.json().catch(() => ({error: "Error desconocido al verificar sesión."}));
                console.warn(`Respuesta no OK al verificar sesión: ${response.status}`, errorData.error);
            }
            showLoginUI();
        }
    } catch (error) {
        console.error("Error de red verificando sesión:", error);
        showLoginUI();
    }
}


/**
 * Obtiene y muestra la lista actual de participaciones del sorteo activo.
 */
async function fetchAndDisplayParticipants() {
    if (!participantListUl || !loaderList || !currentCountSpan) return;
    if (adminContent && adminContent.classList.contains('oculto')) return;

    loaderList.classList.remove('oculto');
    participantListUl.innerHTML = '';
    currentCountSpan.textContent = '...';

    try {
        const response = await fetch('/api/participantes');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            if (response.status === 401) { showLoginUI(); showGenericStatusMessage(loginStatusMessage, 'Sesión expirada. Inicia sesión.', true);
            } else { throw new Error(`Error [${response.status}]: ${errorData.error || response.statusText}`); }
            return;
        }
        const participants = await response.json();
        if (!Array.isArray(participants)) { throw new Error("Respuesta inválida (participantes)."); }
        currentCountSpan.textContent = participants.length;
        if (participants.length === 0) {
            participantListUl.innerHTML = '<li>No hay boletos digitales registrados para el sorteo activo.</li>';
        } else {
            participants.forEach(p => {
                const li = document.createElement('li');
                let details = `ID: ${p.id || 'N/A'}`;
                if (p.ciudad) details += ` | Ciudad: ${p.ciudad}`;
                if (p.celular) details += ` | Cel: ${p.celular}`;
                if (p.email) details += ` | Email: ${p.email}`;
                if (p.paquete_elegido) details += ` | Paq: ${p.paquete_elegido}`;
                if (p.nombre_afiliado) details += ` | Afiliado: ${p.nombre_afiliado}`;
                li.innerHTML = `<span>${p.name || 'Sin Nombre'}</span> <span style="font-size: 0.8em; color: var(--clr-dark-text-alt);">${details}</span> <button class="delete-btn" data-ordenid="${p.orden_id}" title="Eliminar">X</button>`;
                participantListUl.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error cargando lista de participaciones:", error);
        if (!error.message.includes("Sesión expirada")) {
             participantListUl.innerHTML = `<li style="color: red;">Error al cargar: ${error.message}</li>`;
             currentCountSpan.textContent = 'Error';
        }
    } finally {
        loaderList.classList.add('oculto');
    }
}

/**
 * Obtiene datos de un participante por su ID para autocompletar.
 */
async function fetchParticipantDataForAutocomplete(idDocumento) {
    if (!idDocumento || idDocumento.length !== 10) {
        if (participantCityInput) participantCityInput.value = '';
        if (participantPhoneInput) participantPhoneInput.value = '';
        if (participantEmailInput) participantEmailInput.value = '';
        return;
    }
    try {
        const response = await fetch(`/api/participante-datos/${idDocumento}`);
        const result = await response.json();
        if (response.ok && result.success && result.data) {
            if (participantNameInput) participantNameInput.value = result.data.nombre || '';
            if (participantCityInput) participantCityInput.value = result.data.ciudad || '';
            if (participantPhoneInput) participantPhoneInput.value = result.data.celular || '';
            if (participantEmailInput) participantEmailInput.value = result.data.email || '';
        } else {
            if (participantCityInput) participantCityInput.value = '';
            if (participantPhoneInput) participantPhoneInput.value = '';
            if (participantEmailInput) participantEmailInput.value = '';
        }
    } catch (error) { console.error("Error en autocompletado:", error); }
}

/**
 * Maneja el envío del formulario de login.
 */
async function handleLogin(event) {
    event.preventDefault();
    if (!loginPasswordInput || !loginStatusMessage) return;
    const password = loginPasswordInput.value;
    if (!password) { showGenericStatusMessage(loginStatusMessage, 'Por favor, introduce la contraseña.', true); return; }
    showGenericStatusMessage(loginStatusMessage, 'Iniciando sesión...');
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Error ${response.status}`); }
        showGenericStatusMessage(loginStatusMessage, result.message || 'Login exitoso.', false);
        loginForm.reset();
        await showAdminUI();
    } catch (error) {
        console.error("Error de login:", error);
        showGenericStatusMessage(loginStatusMessage, `Error: ${error.message}`, true);
    }
}

/**
 * Maneja el clic en el botón de logout.
 */
async function handleLogout() {
    showGenericStatusMessage(loginStatusMessage, 'Cerrando sesión...');
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Error ${response.status}`); }
        showGenericStatusMessage(loginStatusMessage, result.message || 'Sesión cerrada.', false);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showGenericStatusMessage(loginStatusMessage, `Error al cerrar sesión: ${error.message}`, true);
    } finally {
        showLoginUI();
        if(participantListUl) participantListUl.innerHTML = '';
        if(currentCountSpan) currentCountSpan.textContent = '0';
        if(infoSorteoActualParaParticipaciones) infoSorteoActualParaParticipaciones.textContent = 'N/A';
        if(tbodyListaSorteos) tbodyListaSorteos.innerHTML = '';
    }
}

/**
 * Maneja el envío del formulario para añadir participación(es).
 */
async function handleAddParticipant(event) {
    event.preventDefault();
    if (!addParticipantForm || !participantIdInput || !participantNameInput || !participantEmailInput || !quantityInput) {
        showGenericStatusMessage(statusMessage, 'Error interno: Faltan elementos del formulario.', true);
        return;
    }
    if (whatsappLinkContainer) whatsappLinkContainer.innerHTML = '';

    const id_documento = participantIdInput.value.trim();
    const nombre = participantNameInput.value.trim();
    const ciudad = participantCityInput ? participantCityInput.value.trim() : null;
    const celular = participantPhoneInput ? participantPhoneInput.value.trim() : null;
    const email = participantEmailInput.value.trim();
    const paquete_elegido = packageChosenSelect ? packageChosenSelect.value : null;
    const nombre_afiliado = affiliateNameInput ? affiliateNameInput.value.trim() : null;
    const quantity = parseInt(quantityInput.value, 10);

    if (!id_documento || !nombre) { showGenericStatusMessage(statusMessage, 'ID y Nombre son obligatorios.', true); return; }
    if (!/^\d{10}$/.test(id_documento)) { showGenericStatusMessage(statusMessage, 'El ID debe contener 10 dígitos.', true); return; }
    if (celular && !/^\d{9,10}$/.test(celular)) { showGenericStatusMessage(statusMessage, 'El Celular debe tener 9 o 10 dígitos.', true); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showGenericStatusMessage(statusMessage, 'Formato de correo electrónico inválido.', true); return;
    }
    if (isNaN(quantity) || quantity < 1) { showGenericStatusMessage(statusMessage, 'Cantidad inválida.', true); quantityInput.value = '1'; return; }
    if (quantity > 500) { showGenericStatusMessage(statusMessage, 'Cantidad máxima 500.', true); return; }

    showGenericStatusMessage(statusMessage, `Añadiendo ${quantity} participación(es)...`);
    try {
        const payload = {
            id: id_documento, nombre, ciudad, celular, email,
            paquete_elegido, nombre_afiliado, quantity
        };
        const response = await fetch('/api/participantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) { showLoginUI(); showGenericStatusMessage(loginStatusMessage, 'Sesión expirada. Inicia sesión.', true); }
            throw new Error(result.error || `Error ${response.status}: ${response.statusText}`);
        }
        
        let successMessageHTML = result.message || `¡${quantity} añadida(s)!`;
        if (result.whatsappLink) {
            successMessageHTML += ` <br><a href="${result.whatsappLink}" target="_blank" class="whatsapp-action-link-admin"><i class="fab fa-whatsapp"></i> Enviar Confirmación Manual por WhatsApp</a>`;
        }
        showGenericStatusMessage(statusMessage, successMessageHTML, false, 15000);

        addParticipantForm.reset(); quantityInput.value = '1';
        fetchAndDisplayParticipants();
    } catch (error) {
        console.error("Error al añadir:", error);
        if (!error.message.includes("Sesión expirada")) { 
            showGenericStatusMessage(statusMessage, `Error: ${error.message}`, true); 
        }
    }
}

/**
 * Maneja el clic en un botón de eliminar participación.
 */
async function handleDeleteParticipant(event) {
    if (!event.target.classList.contains('delete-btn')) { return; }
    const button = event.target;
    const ordenId = button.dataset.ordenid;
    const listItem = button.closest('li');
    const participantInfo = listItem?.querySelector('span:first-child')?.textContent || 'esta participación';
    if (!ordenId || !listItem) { console.error("Falta ordenId o listItem."); return; }
    const ordenIdNum = parseInt(ordenId, 10);
    if (isNaN(ordenIdNum)) { showGenericStatusMessage(statusMessage, 'Error interno: ID inválido.', true); return; }
    if (!confirm(`¿Seguro que quieres eliminar ${participantInfo} (Orden ID: ${ordenIdNum})?`)) { return; }

    button.disabled = true; button.textContent = '...';
    try {
        const url = `/api/participaciones/${ordenIdNum}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) {
            if (response.status === 401) { showLoginUI(); showGenericStatusMessage(loginStatusMessage, 'Sesión expirada. Inicia sesión.', true); }
            throw new Error(result.error || `Error ${response.status}`);
        }
        listItem.remove();
        showGenericStatusMessage(statusMessage, result.message || `Participación ${ordenIdNum} eliminada.`, false);
        if (currentCountSpan) { const currentVal = parseInt(currentCountSpan.textContent || '0'); currentCountSpan.textContent = Math.max(0, currentVal - 1); }
    } catch (error) {
        console.error("Error al eliminar:", error);
        if (!error.message.includes("Sesión expirada")) { showGenericStatusMessage(statusMessage, `Error: ${error.message}`, true); }
        button.disabled = false; button.textContent = 'X';
    }
}

/**
 * Maneja el clic en el botón de finalizar/archivar sorteo.
 */
async function handleFinalizarSorteo() {
    if (!btnFinalizarSorteo || !finalizarStatusMessage) return;
    if (!confirm("¿Estás seguro de que quieres finalizar el sorteo activo? Esto lo marcará como 'completado' y te permitirá activar uno nuevo. Las participaciones no se borrarán.")) { return; }
    btnFinalizarSorteo.disabled = true;
    btnFinalizarSorteo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';
    showGenericStatusMessage(finalizarStatusMessage, 'Procesando...');
    try {
        const response = await fetch('/api/sorteos/finalizar', { method: 'POST' });
        const result = await response.json();
        if (!response.ok) {
            if (response.status === 401) { showLoginUI(); showGenericStatusMessage(loginStatusMessage, 'Sesión expirada. Inicia sesión.', true); }
            throw new Error(result.error || `Error ${response.status}`);
        }
        showGenericStatusMessage(finalizarStatusMessage, result.message, false);
        await Promise.all([cargarListaSorteos(), fetchInfoSorteoActualParaAdmin(), fetchAndDisplayParticipants()]);
    } catch (error) {
        console.error("Error al finalizar:", error);
        if (!error.message.includes("Sesión expirada")) { showGenericStatusMessage(finalizarStatusMessage, `Error: ${error.message}`, true); }
    } finally {
        btnFinalizarSorteo.disabled = false;
        btnFinalizarSorteo.innerHTML = '<i class="fas fa-archive"></i> Finalizar y Archivar Sorteo Actual';
    }
}

async function handleIniciarCuentaRegresiva() {
    if (!btnIniciarCuentaRegresiva || !estadoCuentaRegresivaAdminDiv) return;
    try {
        const responseInfo = await fetch('/api/sorteo-actual-info');
        const sorteoInfo = await responseInfo.json();
        if (!responseInfo.ok || !sorteoInfo.success || !sorteoInfo.idSorteo) {
            throw new Error(sorteoInfo.error || "No hay un sorteo activo para iniciar.");
        }
        const participantesResponse = await fetch('/api/participantes');
        const participantesActuales = await participantesResponse.json();
        if (!participantesResponse.ok) { throw new Error(participantesActuales.error || "No se pudo obtener el número de boletos."); }
        if (participantesActuales.length < sorteoInfo.metaParticipaciones) {
            showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, `La meta de ${sorteoInfo.metaParticipaciones} boletos aún no se ha alcanzado. Actuales: ${participantesActuales.length}.`, true, 10000);
            return;
        }
    } catch (error) {
        console.error("Error verificando meta:", error);
        showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, `Error: ${error.message}`, true, 10000);
        return;
    }
    
    if (!confirm("¿Estás seguro de que quieres iniciar la cuenta regresiva de 1 MINUTO? La rueda girará automáticamente al finalizar en la página principal.")) {
        return;
    }

    const ahora = new Date().getTime();
    // const unaHoraEnMilisegundos = 60 * 60 * 1000; // 1 Hora
    const unMinutoEnMilisegundos = 10 * 1000; // <<<--- AJUSTADO A 1 MINUTO
    
    const tiempoFinalizacion = ahora + unMinutoEnMilisegundos;

    localStorage.setItem('sorteoTiempoFinalizacion', tiempoFinalizacion.toString());
    localStorage.setItem('sorteoIniciado', 'true');
    const infoSorteo = await fetch('/api/sorteo-actual-info').then(res => res.json());
    if(infoSorteo.success && infoSorteo.idSorteo) {
        localStorage.setItem('sorteoIdParaGiro', infoSorteo.idSorteo.toString());
    }
    console.log("Cuenta regresiva iniciada por admin. Finaliza en:", new Date(tiempoFinalizacion), "para sorteo ID:", infoSorteo.idSorteo);

    checkAdminCountdownStatus();
    showGenericStatusMessage(statusGestionSorteo, "¡Cuenta regresiva de 1 minuto iniciada!", false, 10000);
}

function actualizarDisplayCuentaRegresivaAdmin(tiempoFinalizacion) {
    if (!estadoCuentaRegresivaAdminDiv) return;
    const ahora = new Date().getTime();
    const restante = tiempoFinalizacion - ahora;
    if (restante < 0) {
        estadoCuentaRegresivaAdminDiv.innerHTML = "¡El sorteo debería haber comenzado!";
        if (btnIniciarCuentaRegresiva) {
            btnIniciarCuentaRegresiva.disabled = false;
            btnIniciarCuentaRegresiva.innerHTML = '<i class="fas fa-hourglass-start"></i> Iniciar Cuenta Regresiva';
        }
        clearInterval(cuentaRegresivaIntervalAdmin);
        return;
    }
    const horas = Math.floor((restante % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((restante % (1000 * 60)) / 1000);
    estadoCuentaRegresivaAdminDiv.innerHTML = `Sorteo en curso: <span style="color:var(--clr-accent);">${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}</span>`;
}

function checkAdminCountdownStatus() {
    const tiempoFinalizacionStorage = localStorage.getItem('sorteoTiempoFinalizacion');
    const sorteoIniciadoAdmin = localStorage.getItem('sorteoIniciado');
    if (sorteoIniciadoAdmin === 'true' && tiempoFinalizacionStorage) {
        const tiempoFinalizacion = parseInt(tiempoFinalizacionStorage);
        if (tiempoFinalizacion > new Date().getTime()) {
            if(btnIniciarCuentaRegresiva) {
                btnIniciarCuentaRegresiva.disabled = true;
                btnIniciarCuentaRegresiva.innerHTML = '<i class="fas fa-clock"></i> Cuenta Regresiva Activa';
            }
            if(estadoCuentaRegresivaAdminDiv) estadoCuentaRegresivaAdminDiv.classList.remove('oculto');
            actualizarDisplayCuentaRegresivaAdmin(tiempoFinalizacion);
            if (cuentaRegresivaIntervalAdmin) clearInterval(cuentaRegresivaIntervalAdmin);
            cuentaRegresivaIntervalAdmin = setInterval(() => {
                actualizarDisplayCuentaRegresivaAdmin(tiempoFinalizacion);
            }, 1000);
        } else {
            localStorage.removeItem('sorteoTiempoFinalizacion');
            localStorage.removeItem('sorteoIniciado');
            localStorage.removeItem('sorteoIdParaGiro');
            if(btnIniciarCuentaRegresiva) {
                btnIniciarCuentaRegresiva.disabled = false;
                btnIniciarCuentaRegresiva.innerHTML = '<i class="fas fa-hourglass-start"></i> Iniciar Cuenta Regresiva';
            }
        }
    }
}

// === FUNCIONES PARA GESTIÓN DE SORTEOS ===
async function fetchInfoSorteoActualParaAdmin() {
    if (!infoSorteoActualParaParticipaciones) return;
    infoSorteoActualParaParticipaciones.textContent = 'Cargando...';
    infoSorteoActualParaParticipaciones.style.color = 'var(--clr-dark-text-alt)';
    try {
        const response = await fetch('/api/sorteo-actual-info');
        if (!response.ok) throw new Error('No se pudo obtener la info del sorteo actual.');
        const data = await response.json();
        if (data.success && data.premioNombre) {
            infoSorteoActualParaParticipaciones.textContent = `${data.premioNombre} (Meta: ${data.metaParticipaciones})`;
            infoSorteoActualParaParticipaciones.style.color = 'var(--clr-primary)';
        } else {
            infoSorteoActualParaParticipaciones.textContent = 'No hay sorteo activo configurado.';
            infoSorteoActualParaParticipaciones.style.color = 'var(--clr-red)';
        }
    } catch (error) {
        console.error("Error cargando info del sorteo actual para admin:", error);
        infoSorteoActualParaParticipaciones.textContent = 'Error al cargar info.';
        infoSorteoActualParaParticipaciones.style.color = 'var(--clr-red)';
    }
}

async function cargarListaSorteos() {
    if (!tbodyListaSorteos || !loaderListaSorteos) return;
    loaderListaSorteos.classList.remove('oculto');
    tbodyListaSorteos.innerHTML = '';
    try {
        const response = await fetch('/api/sorteos');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        const sorteos = await response.json();
        if (sorteos.length === 0) {
            tbodyListaSorteos.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay sorteos configurados.</td></tr>';
        } else {
            sorteos.forEach(sorteo => {
                const tr = document.createElement('tr');
                if (sorteo.status_sorteo === 'activo') tr.classList.add('sorteo-activo-row');
                tr.innerHTML = `
                    <td>${sorteo.id_sorteo}</td>
                    <td>${sorteo.nombre_premio_display}</td>
                    <td>${sorteo.nombre_base_archivo_guia}</td>
                    <td>${sorteo.meta_participaciones}</td>
                    <td><span class="status-${sorteo.status_sorteo}">${sorteo.status_sorteo}</span></td>
                    <td>
                        <button class="accion-btn btn-editar" data-id="${sorteo.id_sorteo}" title="Editar Sorteo"><i class="fas fa-edit"></i></button>
                        <button class="accion-btn btn-activar" data-id="${sorteo.id_sorteo}" title="Activar Sorteo" ${sorteo.status_sorteo === 'activo' ? 'disabled' : ''}>
                            ${sorteo.status_sorteo === 'activo' ? '<i class="fas fa-toggle-on"></i> Activo' : '<i class="fas fa-toggle-off"></i> Activar'}
                        </button>
                    </td>
                    <td>
                        <button class="accion-btn btn-historial" data-id="${sorteo.id_sorteo}" data-premio="${sorteo.nombre_premio_display}" title="Ver Historial"><i class="fas fa-history"></i></button>
                    </td>
                `;
                tbodyListaSorteos.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error cargando lista de sorteos:", error);
        tbodyListaSorteos.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${error.message}</td></tr>`;
    } finally {
        loaderListaSorteos.classList.add('oculto');
    }
}
// === FUNCIONES PARA DASHBOARD Y HISTORIAL ===
async function cargarDashboardStats() {
    if (!paquetesChartCanvas || !diarioChartCanvas) return;
    try {
        const response = await fetch('/api/dashboard-stats');
        if (!response.ok) throw new Error("No se pudieron cargar las estadísticas.");
        const data = await response.json();
        if (data.success) {
            renderPaquetesChart(data.stats.paquetesPopulares);
            renderDiarioChart(data.stats.participacionesDiarias);
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

async function mostrarHistorialParticipantes(sorteoId, premioNombre) {
    if (!historialModal || !historialParticipantesLista || !loaderHistorial || !historialModalTitle) return;
    
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
function prepararEdicionSorteo(sorteo) {
    if (!formGestionSorteo || !sorteoEditIdInput || !nombrePremioDisplayInput || !nombreBaseArchivoGuiaInput || !descripcionPremioInput || !metaParticipacionesSorteoInput || !sorteoActivoCheckbox || !btnGuardarSorteo || !btnCancelarEdicionSorteo) return;
    editandoSorteo = true;
    sorteoEditIdInput.value = sorteo.id_sorteo;
    nombrePremioDisplayInput.value = sorteo.nombre_premio_display;
    nombreBaseArchivoGuiaInput.value = sorteo.nombre_base_archivo_guia;
    descripcionPremioInput.value = sorteo.descripcion_premio || '';
    metaParticipacionesSorteoInput.value = sorteo.meta_participaciones;
    sorteoActivoCheckbox.checked = sorteo.status_sorteo === 'activo';
    btnGuardarSorteo.textContent = 'Actualizar Sorteo';
    btnCancelarEdicionSorteo.style.display = 'inline-block';
    formGestionSorteo.scrollIntoView({ behavior: 'smooth' });
}

function resetFormGestionSorteo() {
    if (!formGestionSorteo || !sorteoEditIdInput || !btnGuardarSorteo || !btnCancelarEdicionSorteo || !metaParticipacionesSorteoInput || !sorteoActivoCheckbox) return;
    editandoSorteo = false;
    sorteoEditIdInput.value = '';
    formGestionSorteo.reset();
    metaParticipacionesSorteoInput.value = '200';
    sorteoActivoCheckbox.checked = false;
    btnGuardarSorteo.textContent = 'Guardar Sorteo';
    btnCancelarEdicionSorteo.style.display = 'none';
}

async function handleGuardarSorteo(event) {
    event.preventDefault();
    if (!nombrePremioDisplayInput || !nombreBaseArchivoGuiaInput || !descripcionPremioInput || !metaParticipacionesSorteoInput || !sorteoActivoCheckbox || !statusGestionSorteo) return;
    const id = sorteoEditIdInput.value;
    const data = {
        nombre_premio_display: nombrePremioDisplayInput.value.trim(),
        nombre_base_archivo_guia: nombreBaseArchivoGuiaInput.value.trim(),
        descripcion_premio: descripcionPremioInput.value.trim(),
        meta_participaciones: parseInt(metaParticipacionesSorteoInput.value, 10),
        activo: sorteoActivoCheckbox.checked
    };
    if (!data.nombre_premio_display || !data.nombre_base_archivo_guia || isNaN(data.meta_participaciones) || data.meta_participaciones < 1) {
        showGenericStatusMessage(statusGestionSorteo, "Nombre del premio, nombre base de guía y meta válida son requeridos.", true);
        return;
    }
    const url = editandoSorteo && id ? `/api/sorteos/${id}` : '/api/sorteos';
    const method = editandoSorteo && id ? 'PUT' : 'POST';
    showGenericStatusMessage(statusGestionSorteo, editandoSorteo ? 'Actualizando sorteo...' : 'Guardando nuevo sorteo...');
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Error ${response.status}`); }
        showGenericStatusMessage(statusGestionSorteo, result.message, false);
        resetFormGestionSorteo();
        await cargarListaSorteos();
        await fetchInfoSorteoActualParaAdmin();
    } catch (error) {
        console.error("Error guardando sorteo:", error);
        showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true);
    }
}

async function handleActivarSorteo(sorteoId) {
    if (!confirm(`¿Seguro que quieres activar el sorteo ID ${sorteoId}? Esto desactivará cualquier otro sorteo activo.`)) return;
    showGenericStatusMessage(statusGestionSorteo, `Activando sorteo ID ${sorteoId}...`);
    try {
        const response = await fetch(`/api/sorteos/activar/${sorteoId}`, { method: 'PUT' });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Error ${response.status}`); }
        showGenericStatusMessage(statusGestionSorteo, result.message, false);
        await cargarListaSorteos();
        await fetchInfoSorteoActualParaAdmin();
        await fetchAndDisplayParticipants();
    } catch (error) {
        console.error("Error activando sorteo:", error);
        showGenericStatusMessage(statusGestionSorteo, `Error al activar: ${error.message}`, true);
    }
}
// =========================================

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG: DOM Cargado admin.js");
    if (loginForm) { loginForm.addEventListener('submit', handleLogin); }
    if (logoutButton) { logoutButton.addEventListener('click', handleLogout); }
    if (addParticipantForm) { addParticipantForm.addEventListener('submit', handleAddParticipant); }
    if (participantListUl) { participantListUl.addEventListener('click', handleDeleteParticipant); }
    if (btnFinalizarSorteo) { btnFinalizarSorteo.addEventListener('click', handleFinalizarSorteo); } // <<<--- NUEVO LISTENER
    if (btnIniciarCuentaRegresiva) { btnIniciarCuentaRegresiva.addEventListener('click', handleIniciarCuentaRegresiva); }

    if (participantIdInput) {
        let autocompleteTimeout;
        participantIdInput.addEventListener('input', (event) => {
            clearTimeout(autocompleteTimeout);
            const idValue = event.target.value.trim();
            if (idValue.length === 10) {
                autocompleteTimeout = setTimeout(() => { fetchParticipantDataForAutocomplete(idValue); }, 500);
            } else {
                if (participantNameInput && !participantNameInput.value) participantNameInput.value = '';
                if (participantCityInput && !participantCityInput.value) participantCityInput.value = '';
                if (participantPhoneInput && !participantPhoneInput.value) participantPhoneInput.value = '';
                if (participantEmailInput && !participantEmailInput.value) participantEmailInput.value = '';
            }
        });
    }
    
    if (formGestionSorteo) { formGestionSorteo.addEventListener('submit', handleGuardarSorteo); }
    if (btnCancelarEdicionSorteo) { btnCancelarEdicionSorteo.addEventListener('click', resetFormGestionSorteo); }
    if (tbodyListaSorteos) {
        tbodyListaSorteos.addEventListener('click', async (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const sorteoId = target.dataset.id;
            if (target.classList.contains('btn-editar')) {
                showGenericStatusMessage(statusGestionSorteo, `Cargando datos del sorteo ID ${sorteoId} para editar...`);
                try {
                    const response = await fetch('/api/sorteos'); 
                    const sorteos = await response.json();
                    if (!response.ok) throw new Error(sorteos.error || "Error cargando sorteo para editar");
                    const sorteoAEditar = sorteos.find(s => s.id_sorteo == sorteoId);
                    if (sorteoAEditar) { prepararEdicionSorteo(sorteoAEditar); }
                    else { showGenericStatusMessage(statusGestionSorteo, `Sorteo ID ${sorteoId} no encontrado.`, true); }
                } catch (error) { showGenericStatusMessage(statusGestionSorteo, `Error cargando datos para editar: ${error.message}`, true); }
            } else if (target.classList.contains('btn-activar') && !target.disabled) {
                await handleActivarSorteo(sorteoId);
            } else if (target.classList.contains('btn-historial')) {
                const premioNombre = target.dataset.premio;
                mostrarHistorialParticipantes(sorteoId, premioNombre);
            }
        });
    }
    await checkSessionStatus();
});
