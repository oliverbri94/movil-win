document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://movil-win-production.up.railway.app'; // Asegúrate que esta sea tu URL de Railway
    const tbody = document.getElementById('listado-tbody');
    const titulo = document.getElementById('listado-titulo');
    const loader = document.getElementById('loader');
    const totalBoletosEl = document.getElementById('total-boletos');
    const searchInput = document.getElementById('searchInput');

    async function cargarListado() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const sorteoId = urlParams.get('sorteo');

            if (!sorteoId) {
                titulo.textContent = 'Error: No se especificó un sorteo.';
                loader.style.display = 'none';
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/public-list/${sorteoId}`);
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            titulo.textContent = `Listado Oficial del Sorteo: ${data.nombreSorteo}`;
            totalBoletosEl.textContent = `Total de boletos registrados: ${data.listado.length}`;

            let filasHTML = '';
            data.listado.forEach(p => {
                filasHTML += `
                    <tr>
                        <td data-label="# Boleto">${p.boleto}</td>
                        <td data-label="Participante">${p.nombre}</td>
                        <td data-label="Cédula">${p.cedula}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = filasHTML;

        } catch (error) {
            titulo.textContent = 'Error al Cargar el Listado';
            tbody.innerHTML = `<tr><td colspan="3" class="error-message">${error.message}</td></tr>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            row.style.display = rowText.includes(searchTerm) ? '' : 'none';
        });
    });

    cargarListado();
});