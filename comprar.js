document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://movil-win-production.up.railway.app';
    const params = new URLSearchParams(window.location.search);
    
    // Obtenemos todos los datos de la URL
    const sorteoId = params.get('sorteoId');
    const sorteoNombre = params.get('sorteoNombre');
    const paqueteNombre = params.get('paqueteNombre');
    const paquetePrecio = params.get('paquetePrecio');
    const paqueteBoletos = params.get('paqueteBoletos');

    const resumenDiv = document.getElementById('resumen-pedido');
    const form = document.getElementById('form-pedido');
    const statusDiv = document.getElementById('pedido-status');

    // Mostramos el resumen completo del pedido
    if (resumenDiv && paqueteNombre && sorteoNombre) {
        resumenDiv.innerHTML = `
            <p><strong>Sorteo:</strong> ${sorteoNombre}</p>
            <p><strong>Estás comprando:</strong> ${paqueteNombre}</p>
            <p><strong>Recibirás:</strong> ${paqueteBoletos} boleto(s)</p>
            <p><strong>Total a Pagar:</strong> $${paquetePrecio}</p>
        `;
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            sorteoId: sorteoId,
            sorteoNombre: sorteoNombre, // Lo añadimos al payload
            paquete: `${paqueteNombre} (${paqueteBoletos} x $${paquetePrecio})`,
            nombre: document.getElementById('nombre').value,
            cedula: document.getElementById('cedula').value,
            ciudad: document.getElementById('ciudad').value,
            celular: document.getElementById('celular').value,
            email: document.getElementById('email').value,
            affiliateId: sessionStorage.getItem('affiliateRef') || null
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/crear-pedido`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error en el servidor.');
            // Verificamos que la función del Pixel exista y le informamos del nuevo "Lead"
            if (typeof fbq === 'function') {
                fbq('track', 'Lead');
                console.log('Evento de Pixel "Lead" enviado a Meta.');
            }
            // Si todo sale bien, redirige a la página de gracias
            window.location.href = `gracias.html?pedidoId=${result.pedidoId}`;

        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'status-container error';
        }
    });
});