document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DECLARACIÓN DE CONSTANTES Y VARIABLES ---
    const API_BASE_URL = 'https://movil-win-production.up.railway.app';
    const params = new URLSearchParams(window.location.search);
    const sorteoId = params.get('sorteo');
    const tipoSorteo = params.get('tipo');

    // Referencias a los elementos del DOM
    const tituloEl = document.getElementById('listado-titulo');
    const subtituloEl = document.getElementById('listado-subtitulo');
    const loaderEl = document.getElementById('loader');
    const seleccionContainer = document.getElementById('seleccion-sorteo-container');
    const listadoContainer = document.getElementById('listado-participantes-container');
    const tbody = document.getElementById('listado-tbody');
    const searchInput = document.getElementById('searchInput');

    // Función de ayuda que faltaba
    function formatConfidentialId(id_documento) {
        if (typeof id_documento === 'string' && id_documento.length === 10) {
            return `${id_documento.substring(0, 2)}...${id_documento.substring(id_documento.length - 2)}`;
        }
        return id_documento || 'ID Oculto';
    }

    // --- 2. LÓGICA PRINCIPAL DE LA PÁGINA ---
    if (sorteoId && tipoSorteo) {
        // Si la URL tiene un sorteoId, mostramos la lista de ese sorteo
        seleccionContainer.classList.add('oculto');
        listadoContainer.classList.remove('oculto');
        cargarListadoDeParticipantes(sorteoId, tipoSorteo);
    } else {
        // Si no, mostramos la lista de sorteos para elegir
        listadoContainer.classList.add('oculto');
        seleccionContainer.classList.remove('oculto');
        cargarListaDeSorteos();
    }

    // --- 3. DEFINICIÓN DE FUNCIONES ---
    async function cargarListaDeSorteos() {
        const listaSorteosDiv = document.getElementById('lista-de-sorteos');
        try {
            const response = await fetch(`${API_BASE_URL}/api/listable-raffles`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            if (data.sorteos.length === 0) {
                listaSorteosDiv.innerHTML = '<p>No hay sorteos activos o finalizados para mostrar.</p>';
            } else {
                data.sorteos.forEach(sorteo => {
                    const link = document.createElement('a');
                    link.href = `listado.html?sorteo=${sorteo.id_sorteo}&tipo=${sorteo.tipo_sorteo}`;
                    link.className = 'sorteo-selection-item';
                    link.innerHTML = `<span>${sorteo.nombre_premio_display}</span> <span class="status-tag status-${sorteo.status_sorteo}">${sorteo.status_sorteo}</span>`;
                    listaSorteosDiv.appendChild(link);
                });
            }
        } catch (error) {
            listaSorteosDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally {
            if(loaderEl) loaderEl.style.display = 'none';
        }
    }

    async function cargarListadoDeParticipantes(id, tipo) {
        const totalBoletosEl = document.getElementById('total-boletos');
        const headerBoleto = document.getElementById('header-boleto-combinacion');
        if(loaderEl) loaderEl.style.display = 'flex';

        const endpoint = (tipo === 'tombola_interactiva') 
            ? `${API_BASE_URL}/api/public-list/tombola/${id}`
            : `${API_BASE_URL}/api/public-list/${id}`;

        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            tituloEl.textContent = `Listado Oficial: ${data.nombreSorteo}`;
            subtituloEl.innerHTML = `<a href="listado.html" class="back-link-small"><i class="fas fa-arrow-left"></i> Volver a la lista de sorteos</a>`;
            totalBoletosEl.textContent = `Total de registros: ${data.listado.length}`;

            let filasHTML = '';

            if (tipo === 'tombola_interactiva') {
                headerBoleto.textContent = 'Combinaciones';
                data.listado.forEach(p => {
                    const combinacionesHTML = p.numeros.map(combo => 
                        `<div class="combinacion-fila">${combo.map(n => `<span class="bola-small-listado">${n}</span>`).join('')}</div>`
                    ).join('');

                    const numerosParaBusqueda = p.numeros.flat().join('');
                    const nombreDisplay = p.nombre ? `${p.nombre.trim().split(' ')[0]} ${p.nombre.trim().split(' ').pop().charAt(0)}.` : 'Participante';
                    const cedulaDisplay = formatConfidentialId(p.id_documento);
                    const searchData = `${p.nombre || ''} ${p.id_documento || ''} ${numerosParaBusqueda}`.toLowerCase();

                    filasHTML += `<tr data-search="${searchData}">
                                    <td data-label="Combinaciones"><div class="combinacion-bolas-container">${combinacionesHTML}</div></td>
                                    <td data-label="Participante">${nombreDisplay}</td>
                                    <td data-label="Cédula">${cedulaDisplay}</td>
                                    <td data-label="Compartir">
                                        <button class="btn-share-ticket" data-sorteo-nombre="${data.nombreSorteo}" data-combinaciones='${JSON.stringify(p.numeros)}' title="Compartir mis números">
                                            <i class="fas fa-share-alt"></i>
                                        </button>
                                    </td>
                                </tr>`;
                });
            } else {
                headerBoleto.textContent = '# Boleto';
                data.listado.forEach(p => {
                    const searchData = `${p.nombre_raw || ''} ${p.cedula_raw || ''}`.toLowerCase();
                    filasHTML += `<tr data-search="${searchData}">
                                    <td data-label="# Boleto">${p.boleto}</td>
                                    <td data-label="Participante">${p.nombre_display}</td>
                                    <td data-label="Cédula">${p.cedula_display}</td>
                                    <td data-label="Compartir">
                                        <button class="btn-share-ticket" data-boleto="${p.boleto}" data-sorteo-nombre="${data.nombreSorteo}" title="Compartir mi boleto">
                                            <i class="fas fa-share-alt"></i>
                                        </button>
                                    </td>
                                </tr>`;
                });
            }
            tbody.innerHTML = filasHTML;
        } catch (error) {
            tituloEl.textContent = 'Error al Cargar el Listado';
            tbody.innerHTML = `<tr><td colspan="4" class="error-message" style="text-align:center;">${error.message}</td></tr>`;
        } finally {
            if(loaderEl) loaderEl.style.display = 'none';
        }
    }

    // --- 4. EVENT LISTENERS ---
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const searchCounter = document.getElementById('search-results-counter');
        let resultadosEncontrados = 0;

        tbody.querySelectorAll('tr').forEach(row => {
            const searchableText = row.dataset.search || '';
            const isVisible = searchableText.startsWith(searchTerm);
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) {
                resultadosEncontrados++;
            }
        });

        if (searchTerm === '') {
            searchCounter.textContent = '';
        } else if (resultadosEncontrados === 1) {
            searchCounter.textContent = '1 resultado encontrado';
        } else {
            searchCounter.textContent = `${resultadosEncontrados} resultados encontrados`;
        }
    });

    tbody.addEventListener('click', (e) => {
        const shareButton = e.target.closest('.btn-share-ticket');
        if (!shareButton) return;

        const sorteoNombre = shareButton.dataset.sorteoNombre;
        const boleto = shareButton.dataset.boleto;
        const combinacionesJSON = shareButton.dataset.combinaciones;
        let shareText;

        if (boleto) {
            shareText = `¡Ya estoy participando para ganar un ${sorteoNombre} con Movil Win! Mi boleto de la suerte es el #${boleto}.`;
        } else if (combinacionesJSON) {
            const combinaciones = JSON.parse(combinacionesJSON);
            const textoCombinaciones = combinaciones.map(c => `[${c.join('-')}]`).join(', ');
            shareText = `¡Ya estoy participando para ganar un ${sorteoNombre} con Movil Win! Mis combinaciones de la suerte son: ${textoCombinaciones}.`;
        } else {
            shareText = `¡Ya estoy participando en un sorteo de Movil Win para ganar un ${sorteoNombre}!`;
        }

        const shareUrl = 'https://movilwin.com';

        if (navigator.share) {
            navigator.share({ title: 'Sorteo Movil Win', text: shareText, url: shareUrl }).catch(console.error);
        } else {
            navigator.clipboard.writeText(`${shareText} ¡Tú también puedes participar aquí! ${shareUrl}`);
            alert('¡Texto para compartir copiado al portapapeles!');
        }
    });
});