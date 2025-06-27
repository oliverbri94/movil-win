// =================================================================
// ARCHIVO ADMIN.JS - VERSIÓN FINAL, ORDENADA Y CORREGIDA
// =================================================================

// --- INICIO DEL CÓDIGO ---

// Espera a que todo el HTML de la página esté cargado antes de ejecutar cualquier script.
document.addEventListener('DOMContentLoaded', async () => {

    // --- SECCIÓN 1: DECLARACIÓN DE VARIABLES GLOBALES Y ELEMENTOS DEL DOM ---
    // Agrupamos aquí TODAS las constantes que hacen referencia a elementos del HTML.

    // Elementos Generales y de Sesión
    const loginSection = document.getElementById('loginSection');
    const adminContent = document.getElementById('adminContent');
    const loginForm = document.getElementById('loginForm');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginStatusMessage = document.getElementById('loginStatusMessage');
    const logoutButton = document.getElementById('logoutButton');

    const btnAnadirPaquete = document.getElementById('btnAnadirPaquete');
    btnAnadirPaquete?.addEventListener('click', () => anadirFilaPaquete());

    // Elementos del Menú Lateral (Sidebar)
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const adminSidebar = document.querySelector('.admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarNav = document.getElementById('adminSidebarNav');
    const adminPages = document.querySelectorAll('.admin-page');
    const navLinks = document.querySelectorAll('.admin-sidebar-nav a');
    const currentPageTitle = document.getElementById('currentPageTitle');

    // Formulario: Añadir Participante
    const addParticipantForm = document.getElementById('addParticipantForm');
    const sorteoDestinoSelect = document.getElementById('sorteoDestino');
    const participantIdInput = document.getElementById('participantId');
    const participantNameInput = document.getElementById('participantName');
    const participantCityInput = document.getElementById('participantCity');
    const participantPhoneInput = document.getElementById('participantPhone');
    const participantEmailInput = document.getElementById('participantEmail');
    const packageChosenSelect = document.getElementById('packageChosen');
    const affiliateSelect = document.getElementById('affiliateSelect');
    const quantityInput = document.getElementById('quantity');
    const statusMessage = document.getElementById('statusMessage');
    const addParticipantFormSubmitButton = document.querySelector('#addParticipantForm button[type="submit"]');

    // Lista de Participantes
    const participantListUl = document.getElementById('participantList');
    const currentCountSpan = document.getElementById('currentCount');
    const loaderList = document.getElementById('loaderList');
    
    // Formulario: Gestión de Sorteos
    const formGestionSorteo = document.getElementById('formGestionSorteo');
    const sorteoEditIdInput = document.getElementById('sorteoEditId');
    const nombrePremioDisplayInput = document.getElementById('nombrePremioDisplay');
    const nombreBaseArchivoGuiaInput = document.getElementById('nombreBaseArchivoGuia');
    const metaParticipacionesSorteoInput = document.getElementById('metaParticipacionesSorteo');
    const sorteoActivoCheckbox = document.getElementById('sorteoActivo');
    const btnGuardarSorteo = document.getElementById('btnGuardarSorteo');
    const btnCancelarEdicionSorteo = document.getElementById('btnCancelarEdicionSorteo');
    const statusGestionSorteo = document.getElementById('statusGestionSorteo');
    
    // Tabla de Sorteos
    const loaderListaSorteos = document.getElementById('loaderListaSorteos');
    const tbodyListaSorteos = document.getElementById('tbodyListaSorteos');
    const infoSorteoActualParaParticipaciones = document.getElementById('infoSorteoActualParaParticipaciones');

    // Formulario y Tabla de Afiliados
    const addAffiliateForm = document.getElementById('addAffiliateForm');
    const editAffiliateIdInput = document.getElementById('editAffiliateId');
    const affiliateNameInput = document.getElementById('affiliateNameInput');
    const affiliatePhoneInput = document.getElementById('affiliatePhoneInput');
    const btnGuardarAfiliado = document.getElementById('btnGuardarAfiliado');
    const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');
    const statusAffiliateMessage = document.getElementById('statusAffiliateMessage');


    const btnGenerarReporte = document.getElementById('btnGenerarReporte');
    btnGenerarReporte?.addEventListener('click', async () => {
        const sorteoId = document.getElementById('reporteSorteoSelect').value;
        const comision = parseFloat(document.getElementById('reporteComisionInput').value);
        const precioBoleto = parseFloat(document.getElementById('reportePrecioBoleto').value);
        const container = document.getElementById('reporteResultadoContainer');

        if (!sorteoId || isNaN(comision) || isNaN(precioBoleto)) {
            alert("Por favor, selecciona un sorteo y define la comisión y precio promedio.");
            return;
        }

        container.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/reporte-comisiones?sorteo_id=${sorteoId}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            renderizarReporteComisiones(data.reporte, comision, precioBoleto);
        } catch (error) {
            container.innerHTML = `<p class="error-message">Error al generar el reporte: ${error.message}</p>`;
        }
    });

    // --- Lógica para el acordeón de afiliados ---
    const collapsibleHeader = document.querySelector('.collapsible-header');
    collapsibleHeader?.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        if (content.style.maxHeight && content.style.maxHeight !== '0px') {
            content.style.maxHeight = '0px';
            content.classList.remove('active');
        } else {
            // Al abrir, se ajusta al alto real del contenido
            content.style.maxHeight = content.scrollHeight + "px";
            content.classList.add('active');
        }
    });

    // --- Lógica para el buscador de afiliados ---
    const searchInput = document.getElementById('affiliateSearchInput');
    searchInput?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#tbodyListaAfiliados tr');

        rows.forEach(row => {
            // Buscamos en el nombre (celda 0) y teléfono (celda 1)
            const nameText = row.cells[0]?.textContent.toLowerCase();
            const phoneText = row.cells[1]?.textContent.toLowerCase();
            
            if (nameText.includes(searchTerm) || phoneText.includes(searchTerm)) {
                row.style.display = ''; // Muestra la fila
            } else {
                row.style.display = 'none'; // Oculta la fila
            }
        });
    });
    // Opciones de Sorteo (Countdown)
    const btnIniciarCuentaRegresiva = document.getElementById('btnIniciarCuentaRegresiva');
    const estadoCuentaRegresivaAdminDiv = document.getElementById('estadoCuentaRegresivaAdmin');
    const sorteoParaCuentaRegresivaSelect = document.getElementById('sorteoParaCuentaRegresiva');
    const finalizarStatusMessage = document.getElementById('finalizarStatusMessage');

    // Dashboard y Gráficos
    const toggleDashboardBtn = document.getElementById('toggleDashboardBtn'); // <<<--- AÑADE ESTA LÍNEA
    const dashboardStatsDiv = document.getElementById('dashboardStats');
    const paquetesChartCanvas = document.getElementById('paquetesChart');
    const diarioChartCanvas = document.getElementById('diarioChart');
    const rafflePerformanceChartCanvas = document.getElementById('rafflePerformanceChart');
    
    // Modal de Historial
    const historialModal = document.getElementById('historialModal');
    const historialModalTitle = document.getElementById('historialModalTitle');
    const closeHistorialModalBtn = document.getElementById('closeHistorialModal');
    const historialParticipantesLista = document.getElementById('historialParticipantesLista');
    const loaderHistorial = document.getElementById('loaderHistorial');
    const toggleHistorialBtn = document.getElementById('toggleHistorialBtn');

    // Calculadora de Rentabilidad
    const calculadoraInputs = Array.from(document.querySelectorAll('#calculadoraForm input'));
    const resultadoIPT = document.getElementById('resultadoIPT');
    const resultadoMCNB = document.getElementById('resultadoMCNB');
    const resultadoPEB = document.getElementById('resultadoPEB');
    const resultadoMeta = document.getElementById('resultadoMeta');

    // Variables de estado
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
     * Crea y añade una fila de inputs para un nuevo paquete en el editor.
     * @param {object} [paquete] - Datos opcionales de un paquete para rellenar los campos.
     */
    function anadirFilaPaquete(paquete = { nombre: '', precio: '', boletos: '' }) {
        const container = document.getElementById('paquetes-editor-container');
        if (!container) return; // Añadimos una guarda de seguridad

        const fila = document.createElement('div');
        fila.className = 'paquete-editor-fila';
        fila.innerHTML = `
            <input type="text" placeholder="Nombre del Paquete (ej: Individual)" value="${paquete.nombre}" class="paquete-nombre" required>
            <input type="number" placeholder="Precio ($)" value="${paquete.precio}" class="paquete-precio" required>
            <input type="number" placeholder="Nº Boletos" value="${paquete.boletos}" class="paquete-boletos" required>
            <button type="button" class="btn-eliminar-paquete" title="Eliminar este paquete">&times;</button>
        `;
        container.appendChild(fila);

        // Añadimos el listener para el botón de eliminar de esta nueva fila
        fila.querySelector('.btn-eliminar-paquete').addEventListener('click', () => {
            fila.remove();
        });
    }
    // Función para resetear el formulario al estado "Añadir"
    function resetearFormularioAfiliado() {
        editAffiliateIdInput.value = '';
        addAffiliateForm.reset();
        btnGuardarAfiliado.textContent = 'Añadir Afiliado';
        btnCancelarEdicion.style.display = 'none';
    }

    // Listener para el formulario (maneja tanto CREAR como ACTUALIZAR)
    addAffiliateForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = editAffiliateIdInput.value;
        const esEdicion = id !== '';

        const url = esEdicion ? `${API_BASE_URL}/api/admin/afiliados/${id}` : `${API_BASE_URL}/api/admin/afiliados`;
        const method = esEdicion ? 'PUT' : 'POST';

        const payload = {
            nombre_completo: affiliateNameInput.value,
            telefono: affiliatePhoneInput.value
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', credentials: 'include' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showGenericStatusMessage(statusAffiliateMessage, result.message, false);
            resetearFormularioAfiliado();
            fetchAndDisplayAffiliates();
        } catch (error) {
            showGenericStatusMessage(statusAffiliateMessage, `Error: ${error.message}`, true);
        }
    });

    // Listener para el botón "Cancelar Edición"
    btnCancelarEdicion?.addEventListener('click', resetearFormularioAfiliado);

    // Listener para la tabla de afiliados (maneja Editar, Activar/Desactivar, Copiar Link)

    // --- GESTIÓN DE CLICS EN LA TABLA DE AFILIADOS ---
    tbodyListaAfiliados?.addEventListener('click', async (e) => {
        const boton = e.target.closest('button.accion-btn');
        if (!boton) return;

        const afiliadoId = boton.dataset.id;
        const fila = boton.closest('tr');

        // --- Lógica para EDITAR ---
        if (boton.classList.contains('btn-editar-afiliado')) {
            const nombre = fila.cells[0].textContent;
            const telefono = fila.cells[1].textContent;

            affiliateNameInput.value = nombre;
            affiliatePhoneInput.value = (telefono === 'N/A' ? '' : telefono);
            editAffiliateIdInput.value = afiliadoId;
            
            btnGuardarAfiliado.textContent = 'Actualizar Afiliado';
            btnCancelarEdicion.style.display = 'inline-block';
            addAffiliateForm.scrollIntoView({ behavior: 'smooth' });
        }

        // --- Lógica para ACTIVAR/DESACTIVAR ---
        if (boton.classList.contains('btn-activar-afiliado') || boton.classList.contains('btn-desactivar-afiliado')) {
            const nuevoEstado = boton.classList.contains('btn-activar-afiliado') ? 'activo' : 'inactivo';

            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/afiliados/${afiliadoId}/estado`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ estado: nuevoEstado })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                showGenericStatusMessage(statusAffiliateMessage, result.message, false);
                fetchAndDisplayAffiliates();
            } catch (error) {
                showGenericStatusMessage(statusAffiliateMessage, `Error: ${error.message}`, true);
            }
        }

        // --- Lógica para COPIAR LINK ---
        if (boton.classList.contains('btn-copiar-link')) {
            const nombreAfiliado = boton.dataset.nombre;
            const tuNumeroWhatsApp = '593963135510'; // Asegúrate que este sea tu número de contacto
            const mensaje = `Hola MOVIL WIN, quiero participar en el sorteo. Mi afiliado es ${nombreAfiliado}.`;
            const enlaceAfiliado = `https://wa.me/${tuNumeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

            navigator.clipboard.writeText(enlaceAfiliado).then(() => {
                const originalIcon = boton.innerHTML;
                boton.innerHTML = '<i class="fas fa-check"></i>';
                boton.style.backgroundColor = 'var(--clr-primary)';
                setTimeout(() => { 
                    boton.innerHTML = originalIcon;
                    boton.style.backgroundColor = ''; // Vuelve al color original
                }, 2000);
            }).catch(err => console.error('Error al copiar enlace:', err));
        }
        
        // --- Lógica para ELIMINAR ---
        if (boton.classList.contains('btn-eliminar-afiliado')) {
            const nombreAfiliado = fila.cells[0].textContent;
            if (confirm(`¿Estás seguro de que quieres eliminar permanentemente al afiliado "${nombreAfiliado}"? Esta acción no se puede deshacer.`)) {
                // Aquí iría la lógica para llamar a una ruta DELETE en el backend
                console.log(`Eliminar afiliado con ID: ${afiliadoId}`);
                // await handleEliminarAfiliado(afiliadoId); // Implementaríamos esto en el futuro si es necesario
                showGenericStatusMessage(statusAffiliateMessage, `FUNCIONALIDAD NO IMPLEMENTADA: Eliminar ID ${afiliadoId}`, true);
            }
        }
    });

    /**
     * Lee los datos de todos los inputs de paquetes del editor y los devuelve como un array de objetos.
     * @returns {Array<object>} Un array con los paquetes configurados.
     */
    function recogerDatosPaquetes() {
        const paquetes = [];
        document.querySelectorAll('.paquete-editor-fila').forEach(fila => {
            const nombre = fila.querySelector('.paquete-nombre').value.trim();
            const precio = parseFloat(fila.querySelector('.paquete-precio').value);
            const boletos = parseInt(fila.querySelector('.paquete-boletos').value, 10);

            if (nombre && !isNaN(precio) && !isNaN(boletos)) {
                paquetes.push({ nombre, precio, boletos });
            }
        });
        return paquetes;
    }

    /**
     * Limpia el editor de paquetes y renderiza las filas para los paquetes de un sorteo específico.
     * @param {Array<object>} [paquetes] - El array de paquetes de un sorteo. Si no se proporciona, muestra un paquete por defecto.
     */
    function renderizarEditorPaquetes(paquetes = []) {
        const container = document.getElementById('paquetes-editor-container');
        if (!container) return;

        container.innerHTML = ''; // Limpia el editor antes de renderizar
        if (paquetes && paquetes.length > 0) {
            paquetes.forEach(p => anadirFilaPaquete(p));
        } else {
            // Si es un sorteo nuevo sin paquetes, añade uno por defecto para empezar
            anadirFilaPaquete({ nombre: 'Individual', precio: 2, boletos: 1 });
        }
    }
    // En admin.js, AÑADE esta nueva función

    /**
// En admin.js, reemplaza la función completa por esta versión limpia

/**
     * Actualiza el menú desplegable de paquetes basándose en el sorteo seleccionado.
     * @param {string} sorteoId - El ID del sorteo que el usuario ha seleccionado.
     */
    function actualizarDropdownPaquetesAdmin(sorteoId) {
        const packageSelect = document.getElementById('packageChosen');
        if (!packageSelect) return;

        // Limpia las opciones anteriores y añade la opción por defecto
        packageSelect.innerHTML = '<option value="">-- Seleccionar Paquete (si aplica) --</option>';

        if (!sorteoId) return; // Si no se selecciona un sorteo, deja el menú con solo la opción por defecto

        // Busca los datos del sorteo seleccionado en nuestro array de datos locales
        const sorteoData = adminSorteosData.find(s => s.id_sorteo == sorteoId);

        // Si encontramos el sorteo y tiene paquetes definidos, los añadimos al menú
        if (sorteoData && sorteoData.paquetes_json && sorteoData.paquetes_json.length > 0) {
            sorteoData.paquetes_json.forEach(paquete => {
                const option = document.createElement('option');
                
                // Creamos un texto descriptivo para la opción, ej: "Pack Básico (5 x $10)"
                const optionText = `${paquete.nombre} (${paquete.boletos} x $${paquete.precio})`;
                
                option.value = optionText;
                option.textContent = optionText;
                packageSelect.appendChild(option);
            });
        }
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

    function poblarDropdownSorteosCompletados() {
        const select = document.getElementById('reporteSorteoSelect');
        if (!select || !adminSorteosData) return;

        select.innerHTML = '<option value="">-- Elige un sorteo --</option>';
        const sorteosCompletados = adminSorteosData.filter(s => s.status_sorteo === 'completado');

        sorteosCompletados.forEach(sorteo => {
            const option = document.createElement('option');
            option.value = sorteo.id_sorteo;
            option.textContent = `${sorteo.id_sorteo} - ${sorteo.nombre_premio_display}`;
            select.appendChild(option);
        });
    }

    function renderizarReporteComisiones(reporte, comision, precioBoleto) {
        const container = document.getElementById('reporteResultadoContainer');
        if (!container) return;

        let totalGeneralBoletos = 0;
        let totalGeneralIngresos = 0;
        let totalGeneralComision = 0;

        const filas = reporte.map(item => {
            const totalBoletos = parseInt(item.total_boletos, 10);
            const ingresosGenerados = totalBoletos * precioBoleto;
            const comisionAPagar = ingresosGenerados * (comision / 100);

            totalGeneralBoletos += totalBoletos;
            totalGeneralIngresos += ingresosGenerados;
            totalGeneralComision += comisionAPagar;

            return `
                <tr>
                    <td>${item.nombre_afiliado}</td>
                    <td class="stat-number">${totalBoletos}</td>
                    <td class="stat-number">$${ingresosGenerados.toFixed(2)}</td>
                    <td class="stat-number comision-final">$${comisionAPagar.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <h3 style="margin-top: 30px; margin-bottom: 10px;">Reporte de Comisiones</h3>
            <table class="tabla-sorteos">
                <thead>
                    <tr>
                        <th>Afiliado</th>
                        <th>Boletos Vendidos</th>
                        <th>Ingresos Generados</th>
                        <th>Comisión a Pagar (${comision}%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                    <tr class="fila-total">
                        <td><strong>TOTAL</strong></td>
                        <td class="stat-number"><strong>${totalGeneralBoletos}</strong></td>
                        <td class="stat-number"><strong>$${totalGeneralIngresos.toFixed(2)}</strong></td>
                        <td class="stat-number comision-final"><strong>$${totalGeneralComision.toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    async function fetchAndDisplayAffiliates() {
        const loader = document.getElementById('loaderListaAfiliados');
        const tbody = document.getElementById('tbodyListaAfiliados');
        if (!loader || !tbody) {
            console.error("No se encontraron los elementos de la tabla de afiliados.");
            return;
        }
        
        loader.classList.remove('oculto');
        tbody.innerHTML = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`, { credentials: 'include' });
            if (!response.ok) {
                throw new Error((await response.json()).error || 'Error de red');
            }
            const afiliados = await response.json();

            const affiliateSelect = document.getElementById('affiliateSelect');
            if(affiliateSelect) {
                affiliateSelect.innerHTML = '<option value="">-- Sin Afiliado --</option>';
            }

            if (afiliados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No hay afiliados registrados.</td></tr>';
            } else {
                afiliados.forEach(afiliado => {
                    if (afiliado.estado === 'activo' && affiliateSelect) {
                        const option = document.createElement('option');
                        option.value = afiliado.id_afiliado;
                        option.textContent = afiliado.nombre_afiliado;
                        affiliateSelect.appendChild(option);
                    }

                    // --- ORDEN CORRECTO ---
                    // 1. PRIMERO se crea el elemento de la fila (tr)
                    const tr = document.createElement('tr');

                    // 2. LUEGO se le asignan clases y propiedades
                    const esActivo = afiliado.estado === 'activo';
                    tr.className = esActivo ? 'afiliado-activo-row' : 'afiliado-inactivo-row';

                    const precioPromedioBoleto = 2.5;
                    const ingresosGenerados = (parseInt(afiliado.boletos_totales, 10) * precioPromedioBoleto).toFixed(2);

                    // 3. DESPUÉS se le añade el contenido HTML
                    tr.innerHTML = `
                        <td data-label="Nombre">${afiliado.nombre_afiliado}</td>
                        <td data-label="Teléfono">${afiliado.celular_afiliado || 'N/A'}</td>
                        <td data-label="Estado"><span class="status-${esActivo ? 'activo' : 'inactivo'}">${esActivo ? 'Activo' : 'Inactivo'}</span></td>
                        <td data-label="Boletos (Activo)" class="stat-number">${afiliado.boletos_sorteo_activo}</td>
                        <td data-label="Boletos (Total)" class="stat-number">${afiliado.boletos_totales}</td>
                        <td data-label="Acciones">
                            <button class="accion-btn btn-editar-afiliado" data-id="${afiliado.id_afiliado}" title="Editar Afiliado"><i class="fas fa-edit"></i></button>
                            <button class="accion-btn btn-copiar-link" data-nombre="${afiliado.nombre_afiliado}" title="Copiar Link de Afiliado"><i class="fas fa-link"></i></button>
                            <button class="accion-btn ${esActivo ? 'btn-desactivar-afiliado' : 'btn-activar-afiliado'}" data-id="${afiliado.id_afiliado}" title="${esActivo ? 'Desactivar' : 'Activar'}"><i class="fas ${esActivo ? 'fa-toggle-on' : 'fa-toggle-off'}"></i></button>
                            <button class="accion-btn btn-eliminar-afiliado" data-id="${afiliado.id_afiliado}" title="Eliminar Afiliado" style="background-color:var(--clr-red);"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    `;
                    // 4. FINALMENTE, se añade la fila completa a la tabla
                    tbody.appendChild(tr);
                });
                
                // Actualiza el contador en el título del acordeón
                const affiliateCountSpan = document.getElementById('affiliateCount');
                if (affiliateCountSpan) {
                    affiliateCountSpan.textContent = afiliados.length;
                }
            }
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="6" class="error-message">${error.message}</td></tr>`;
            console.error("Error al cargar la lista de afiliados:", error);
        } finally {
            loader.classList.add('oculto');
        }
    }
    /**
     * Obtiene y muestra la lista de ganadores en el panel de admin.
     */
    // admin.js
    async function fetchAndDisplayWinnersForAdmin() {
        const loader = document.getElementById('loaderListaGanadoresAdmin');
        const tbody = document.getElementById('tbodyListaGanadores');
        if (!loader || !tbody) return;

        loader.classList.remove('oculto');
        tbody.innerHTML = '';
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/ganadores`,{ credentials: 'include' });
            const ganadores = await response.json();

            if (ganadores.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Aún no hay ganadores registrados.</td></tr>';
            } else {
                ganadores.forEach(g => {
                    const tr = document.createElement('tr');
                    // HTML con los atributos data-label añadidos 👇
                    tr.innerHTML = `
                        <td data-label="Nombre">${g.nombre}</td>
                        <td data-label="Premio">${g.premio}</td>
                        <td data-label="Fecha">${g.fecha}</td>
                        <td data-label="URL de Foto" class="winner-image-url">${g.imagenUrl || 'No asignada'}</td>
                        <td data-label="Acción">
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
            const response = await fetch(`${API_BASE_URL}/api/admin/afiliados`,{
                credentials: 'include' // Asegúrate de incluir las credenciales para la sesión
            });
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
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`,{
                credentials: 'include'
            });
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
                body: JSON.stringify({ password }),
                credentials: 'include' // <<<--- AÑADE ESTO
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

            // --- AÑADE ESTE CÓDIGO ---
            if (e.target.closest('.btn-eliminar')) {
                const boton = e.target.closest('.btn-eliminar');
                const sorteoId = boton.dataset.id;
                const sorteoNombre = boton.dataset.nombre;

                // Se pide una confirmación doble para evitar errores
                const confirmacion1 = prompt(`¡ACCIÓN IRREVERSIBLE!\n\nEstás a punto de eliminar el sorteo "${sorteoNombre}" y TODOS sus boletos asociados. Esta acción no se puede deshacer.\n\nPara confirmar, escribe la palabra ELIMINAR en mayúsculas:`);

                if (confirmacion1 === "ELIMINAR") {
                    const confirmacion2 = confirm("¿Estás absolutamente seguro?");
                    if (confirmacion2) {
                        handleEliminarSorteo(sorteoId);
                    }
                } else {
                    alert("Eliminación cancelada.");
                }
            }
            // --- FIN DEL CÓDIGO A AÑADIR ---
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
            const response = await fetch(`${API_BASE_URL}/api/admin/participantes-activos`,{
                credentials: 'include'
            });
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
    // En admin.js, reemplaza esta función completa

    async function fetchParticipantDataForAutocomplete(idDocumento) {
        if (!idDocumento || idDocumento.length !== 10) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/participante-datos/${idDocumento}`);
            
            // Esta nueva validación previene el error de JSON
            if (!response.ok) {
                // Si la respuesta es un error (ej. 404, 500), no intentes leerla como JSON.
                // Simplemente limpia los campos.
                if (participantCityInput) participantCityInput.value = '';
                if (participantPhoneInput) participantPhoneInput.value = '';
                if (participantEmailInput) participantEmailInput.value = '';
                return;
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                // Si se encontraron datos, se rellenan los campos.
                if (participantNameInput) participantNameInput.value = result.data.nombre || '';
                if (participantCityInput) participantCityInput.value = result.data.ciudad || '';
                if (participantPhoneInput) participantPhoneInput.value = result.data.celular || '';
                if (participantEmailInput) participantEmailInput.value = result.data.email || '';
            } else {
                // Si no se encontraron datos, se limpian los campos.
                if (participantCityInput) participantCityInput.value = '';
                if (participantPhoneInput) participantPhoneInput.value = '';
                if (participantEmailInput) participantEmailInput.value = '';
            }
        } catch (error) {
            // El catch ahora manejará errores de red o errores de sintaxis si el JSON es inválido
            console.error("Error en autocompletado:", error);
        }
    }
    /**
     * Maneja el envío del formulario para añadir nuevos boletos.
     * @param {Event} event 
     */

    async function handleAddParticipant(event) {
        event.preventDefault();

        const affiliateSelect = document.getElementById('affiliateSelect');
        const selectedAffiliateName = affiliateSelect.selectedIndex > 0 ? affiliateSelect.options[affiliateSelect.selectedIndex].text : '';
        
        const payload = {
            id_documento: participantIdInput.value.trim(),
            nombre: participantNameInput.value.trim(),
            ciudad: participantCityInput?.value.trim(),
            celular: participantPhoneInput?.value.trim(),
            email: participantEmailInput.value.trim(),
            paquete_elegido: packageChosenSelect?.value,
            nombre_afiliado: selectedAffiliateName,
            quantity: parseInt(quantityInput.value, 10),
            sorteo_id: sorteoDestinoSelect.value,
        };

        if (!payload.id_documento || !payload.nombre || !payload.sorteo_id) {
            showGenericStatusMessage(statusMessage, 'Cédula, Nombre y Sorteo de Destino son obligatorios.', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/participantes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Tu sesión ha expirado. Por favor, refresca la página e inicia sesión de nuevo.');
                }
                const errorResult = await response.json().catch(() => ({ error: `Error del servidor: ${response.status}` }));
                throw new Error(errorResult.message || errorResult.error);
            }

            const result = await response.json();
            
            // --- INICIO DE LA LÓGICA QUE CONSTRUYE EL MENSAJE DE ÉXITO ---
            
            let successMessageContent = `<p>${result.message}</p>`;

            // Muestra los números de boleto asignados
            if (result.boletos && result.boletos.length > 0) {
                successMessageContent += `<p style="margin-top: 10px; font-weight: 600;">Boletos Asignados: ${result.boletos.join(', ')}</p>`;
            }

            // Si el servidor generó un enlace de WhatsApp, crea y añade el botón
            if (result.whatsappLink) {
                successMessageContent += `<a href="${result.whatsappLink}" target="_blank" class="whatsapp-action-link" style="margin-top: 15px;"><i class="fab fa-whatsapp"></i> Enviar Confirmación por WhatsApp</a>`;
            }
            
            // --- FIN DE LA LÓGICA ---

            showGenericStatusMessage(statusMessage, successMessageContent, false, 30000);
            
            const sorteoAfectado = adminSorteosData.find(s => s.id_sorteo == payload.sorteo_id);
            if (sorteoAfectado) {
                sorteoAfectado.participantes_actuales = parseInt(sorteoAfectado.participantes_actuales, 10) + payload.quantity;
            }
            
            updateRaffleStatsDisplay();
            fetchAndDisplayParticipants();
            cargarDashboardStats();

            const mantenerDatosCheckbox = document.getElementById('mantenerDatos');
            if (mantenerDatosCheckbox && mantenerDatosCheckbox.checked) {
                participantIdInput.value = '';
                participantNameInput.value = '';
                participantCityInput.value = '';
                participantPhoneInput.value = '';
                participantEmailInput.value = '';
                packageChosenSelect.value = '';
                quantityInput.value = '1';
            } else {
                addParticipantForm.reset();
                quantityInput.value = '1';
            }

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
            const response = await fetch(`${API_BASE_URL}/api/admin/participaciones/${ordenId}`, { method: 'DELETE', credentials: 'include' });
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
     */
    // En admin.js, reemplaza tu función cargarListaSorteos completa

    async function cargarListaSorteos() {
        if (!tbodyListaSorteos || !loaderListaSorteos) return;
        loaderListaSorteos.classList.remove('oculto');
        tbodyListaSorteos.innerHTML = '';
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`, { credentials: 'include' });
            if (!response.ok) throw new Error((await response.json()).error || 'Error de red');
            const sorteos = await response.json();
            adminSorteosData = sorteos;
            poblarDropdownSorteosCompletados(); 

            if (sorteos.length === 0) {
                tbodyListaSorteos.innerHTML = '<tr><td colspan="7">No hay sorteos configurados.</td></tr>';
            } else {
                sorteos.forEach(sorteo => {
                    const tr = document.createElement('tr');
                    tr.className = sorteo.status_sorteo === 'activo' ? 'sorteo-activo-row' : '';
                    tr.innerHTML = `
                        <td data-label="ID">${sorteo.id_sorteo}</td>
                        <td data-label="Premio">${sorteo.nombre_premio_display}</td>
                        <td data-label="Meta">${sorteo.participantes_actuales} / ${sorteo.meta_participaciones}</td>
                        <td data-label="Status"><span class="status-${sorteo.status_sorteo}">${sorteo.status_sorteo}</span></td>
                        <td data-label="Acciones">
                            <button class="accion-btn btn-editar" data-id="${sorteo.id_sorteo}" title="Editar Sorteo"><i class="fas fa-edit"></i></button>
                            <button class="accion-btn ${sorteo.status_sorteo === 'activo' ? 'btn-desactivar' : 'btn-activar'}" data-id="${sorteo.id_sorteo}" data-status="${sorteo.status_sorteo}" title="${sorteo.status_sorteo === 'activo' ? 'Desactivar' : 'Activar'}">
                                <i class="fas ${sorteo.status_sorteo === 'activo' ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                            </button>
                            <button class="accion-btn btn-finalizar" data-id="${sorteo.id_sorteo}" title="Finalizar Sorteo" ${sorteo.status_sorteo === 'completado' ? 'disabled' : ''}>
                                <i class="fas fa-archive"></i>
                            </button>
                            <button class="accion-btn btn-eliminar" data-id="${sorteo.id_sorteo}" data-nombre="${sorteo.nombre_premio_display}" title="Eliminar Sorteo">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            </td>
                        <td data-label="Historial">
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
        document.getElementById('imagenUrlSorteo').value = sorteo.imagen_url || '';
        nombreBaseArchivoGuiaInput.value = sorteo.nombre_base_archivo_guia;
        metaParticipacionesSorteoInput.value = sorteo.meta_participaciones;
        sorteoActivoCheckbox.checked = sorteo.status_sorteo === 'activo';

        // Renderiza los paquetes existentes del sorteo
        renderizarEditorPaquetes(sorteo.paquetes_json);

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

        // Limpia y resetea el editor de paquetes
        renderizarEditorPaquetes(); 

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
        const paquetesData = recogerDatosPaquetes();

        const data = {
            nombre_premio_display: nombrePremioDisplayInput.value.trim(),
            imagen_url: document.getElementById('imagenUrlSorteo').value.trim(),
            nombre_base_archivo_guia: nombreBaseArchivoGuiaInput.value.trim(),
            meta_participaciones: parseInt(metaParticipacionesSorteoInput.value, 10),
            activo: sorteoActivoCheckbox.checked,
            paquetes_json: paquetesData
        };

        if (!data.nombre_premio_display || !data.nombre_base_archivo_guia || isNaN(data.meta_participaciones) || data.meta_participaciones < 1) {
            showGenericStatusMessage(statusGestionSorteo, "Nombre del premio, nombre base de guía y meta válida son requeridos.", true);
            return;
        }

        // Esta es la línea clave que debe construirse correctamente
        const url = editandoSorteo && id ? `${API_BASE_URL}/api/admin/sorteos/${id}` : `${API_BASE_URL}/api/admin/sorteos`;
        const method = editandoSorteo && id ? 'PUT' : 'POST';

        showGenericStatusMessage(statusGestionSorteo, editandoSorteo ? 'Actualizando sorteo...' : 'Guardando nuevo sorteo...');
        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Si la respuesta no es JSON, no intentes parsearla.
                if (response.status === 405) {
                    throw new Error('Método no permitido (405). Revisa la ruta PUT en tu server.js.');
                }
                // Para otros errores, intentamos leer el texto.
                const errorText = await response.text();
                throw new Error(errorText || `Error del servidor: ${response.status}`);
            }

            const result = await response.json();
            
            showGenericStatusMessage(statusGestionSorteo, result.message, false);
            resetFormGestionSorteo();
            await cargarListaSorteos();
            await fetchInfoSorteoActualParaAdmin();

        } catch (error) {
            console.error("Error guardando sorteo:", error);
            // Mostramos el error real que ahora sí podemos leer
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
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteos/activar/${sorteoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activar }),
                credentials: 'include' // <-- ¡ESTA LÍNEA RESUELVE EL PROBLEMA!
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
                body: JSON.stringify({ sorteo_id: sorteoId }),
                credentials: 'include'
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
            const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-avanzado`,{
                credentials: 'include'
            });
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
        const canvasId = 'paquetesChart';
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Forma robusta de destruir el gráfico anterior
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        const ctx = canvas.getContext('2d');
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
        const canvasId = 'diarioChart';
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Forma robusta de destruir el gráfico anterior
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        const ctx = canvas.getContext('2d');
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
        const canvasId = 'rafflePerformanceChart';
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Forma robusta de destruir el gráfico anterior
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        rafflePerformanceChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(s => s.nombre_premio_display.substring(0, 20) + '...'),
                datasets: [{
                    label: 'Boletos Registrados',
                    data: data.map(s => s.participantes_actuales),
                    backgroundColor: ['#2cb67d', '#7f5af0', '#ff8906', '#ef4565', '#2E5C98'],
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } },
                    y: { ticks: { color: '#94a1b2' }, grid: { color: '#3a3f44' } }
                }
            }
        });
    }

    async function handleEliminarSorteo(sorteoId) {
        showGenericStatusMessage(statusGestionSorteo, 'Eliminando sorteo, por favor espera...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteos/${sorteoId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || result.error);
            showGenericStatusMessage(statusGestionSorteo, result.message, false);
            await cargarListaSorteos();
        } catch (error) {
            console.error("Error al eliminar sorteo:", error);
            showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true);
        }
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

    async function handleIniciarCuentaRegresiva() {
        const sorteoIdSeleccionado = sorteoParaCuentaRegresivaSelect.value;
        if (!sorteoIdSeleccionado) {
            return showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, 'Debes seleccionar un sorteo activo.', true);
        }

        const sorteoData = adminSorteosData.find(s => s.id_sorteo == sorteoIdSeleccionado);
        if (!sorteoData || sorteoData.participantes_actuales < sorteoData.meta_participaciones) {
            return showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, 'No se puede iniciar. La meta de boletos aún no se ha alcanzado.', true, 8000);
        }

        if (!confirm(`¿Seguro que quieres iniciar la cuenta regresiva de 1 HORA para el sorteo '${sorteoData.nombre_premio_display}'? Esta acción es irreversible y será visible para todos los usuarios.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/start-countdown`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sorteo_id: sorteoIdSeleccionado }),
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showGenericStatusMessage(statusGestionSorteo, "¡Cuenta regresiva iniciada para todos los usuarios!", false);
            // Opcional: podrías llamar aquí a una función que actualice la UI del admin inmediatamente

        } catch (error) {
            showGenericStatusMessage(estadoCuentaRegresivaAdminDiv, `Error: ${error.message}`, true);
        }
    }



    /**
     * Carga la información de los sorteos activos en los selectores.
     */
    async function fetchInfoSorteoActualParaAdmin() {
        if(infoSorteoActualParaParticipaciones) infoSorteoActualParaParticipaciones.textContent = 'Cargando...';
        if(sorteoDestinoSelect) sorteoDestinoSelect.innerHTML = '<option value="">-- Cargando... --</option>';
        if(sorteoParaCuentaRegresivaSelect) sorteoParaCuentaRegresivaSelect.innerHTML = '<option value="">-- Cargando... --</option>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteos`,{
                credentials: 'include'
    });
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
            const response = await fetch(`${API_BASE_URL}/api/admin/sorteo-participantes/${sorteoId}`, {credentials: 'include'});
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

    // --- SECCIÓN 3: ASIGNACIÓN DE EVENT LISTENERS ---
    // Agrupamos aquí TODAS las asignaciones de eventos.

    // Sesión
    loginForm?.addEventListener('submit', handleLogin);
    logoutButton?.addEventListener('click', handleLogout);

    const packageSelect = document.getElementById('packageChosen');
    // --- 1. Lógica de Sesión ---



    // --- 2. Formularios de Gestión ---
    addParticipantForm?.addEventListener('submit', handleAddParticipant);
    formGestionSorteo?.addEventListener('submit', handleGuardarSorteo);
    btnCancelarEdicionSorteo?.addEventListener('click', resetFormGestionSorteo);

    // --- 3. Formulario para Añadir Afiliados ---
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
                body: JSON.stringify(payload),
                credentials: 'include'
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
    sorteoDestinoSelect?.addEventListener('change', (e) => {
        // Al cambiar el sorteo, actualizamos tanto las estadísticas como el dropdown de paquetes.
        updateRaffleStatsDisplay();
        actualizarDropdownPaquetesAdmin(e.target.value);
    });
    // Para la tabla de gestión de sorteos (editar, activar, etc.)

    tbodyListaSorteos?.addEventListener('click', async (event) => {
        const target = event.target.closest('button.accion-btn');
        if (!target) return; // Si no se hizo clic en un botón de acción, no hacer nada

        const sorteoId = target.dataset.id;

        // --- Lógica para cada tipo de botón ---

        if (target.classList.contains('btn-editar')) {
            if (!sorteoId) return;
            showGenericStatusMessage(statusGestionSorteo, `Cargando datos del sorteo ID ${sorteoId}...`);
            try {
                // El adminSorteosData ya lo tenemos cargado, lo buscamos ahí
                const sorteoAEditar = adminSorteosData.find(s => s.id_sorteo == sorteoId);
                if (sorteoAEditar) {
                    prepararEdicionSorteo(sorteoAEditar);
                } else {
                    throw new Error("Sorteo no encontrado en los datos locales.");
                }
            } catch (error) {
                showGenericStatusMessage(statusGestionSorteo, `Error: ${error.message}`, true);
            }
        } 
        else if (target.classList.contains('btn-activar') || target.classList.contains('btn-desactivar')) {
            if (!sorteoId) return;
            const status = target.dataset.status;
            await handleToggleActivarSorteo(sorteoId, status);
        } 
        else if (target.classList.contains('btn-finalizar')) {
            if (!sorteoId) return;
            await handleFinalizarSorteo(sorteoId);
        } 
        else if (target.classList.contains('btn-historial')) {
            if (!sorteoId) return;
            const premioNombre = target.dataset.premio;
            await mostrarHistorialParticipantes(sorteoId, premioNombre);
        }
        // --- INICIO DE LA LÓGICA DE ELIMINAR INTEGRADA ---
        else if (target.classList.contains('btn-eliminar')) {
            if (!sorteoId) return;
            const sorteoNombre = target.dataset.nombre;

            const confirmacion1 = prompt(`¡ACCIÓN IRREVERSIBLE!\n\nEstás a punto de eliminar el sorteo "${sorteoNombre}" y TODOS sus boletos asociados. Esta acción no se puede deshacer.\n\nPara confirmar, escribe la palabra ELIMINAR en mayúsculas:`);

            if (confirmacion1 === "ELIMINAR") {
                const confirmacion2 = confirm("¿Estás absolutamente seguro?");
                if (confirmacion2) {
                    handleEliminarSorteo(sorteoId);
                }
            } else if (confirmacion1 !== null) { // Solo muestra alerta si el usuario escribió algo incorrecto
                alert("Eliminación cancelada. La palabra no coincidió.");
            }
        }
        // --- FIN DE LA LÓGICA DE ELIMINAR ---
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
                const response = await fetch(`${API_BASE_URL}/api/admin/ganadores/${winnerId}`, {
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
                    body: JSON.stringify(payload),
                    credentials: 'include'
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
    // --- SECCIÓN 4: EJECUCIÓN INICIAL ---
    // Código que se ejecuta una vez al cargar la página.
    
    console.log("Inicializando panel de administración...");
    calcularYActualizarRentabilidad(); // Calcula los valores iniciales de la calculadora
    await checkSessionStatus(); // Verifica si ya hay una sesión activa
    console.log("Panel de administración inicializado.");
}); // --- FIN DEL addEventListener('DOMContentLoaded') ---
