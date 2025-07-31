// REEMPLAZA TODO EL CONTENIDO DE comprar.js CON ESTO

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. ELEMENTOS DEL DOM Y VARIABLES ---
    const params = new URLSearchParams(window.location.search);
    const sorteoId = params.get('sorteoId');
    
    const resumenDiv = document.getElementById('resumen-pedido');
    const form = document.getElementById('form-pedido');
    const statusDiv = document.getElementById('pedido-status');
    const selectorContainer = document.getElementById('selector-numeros-container');
    const misNumerosContainer = document.getElementById('mis-numeros-container');
    const listaNumerosElegidos = document.getElementById('lista-numeros-elegidos');

    let sorteoData = null;
    let numerosOcupados = [];
    let misNumerosSeleccionados = []; // Carrito de compras de números

    // --- 2. FUNCIONES PRINCIPALES ---

    /**
     * Carga los datos del sorteo y los números ya ocupados desde el backend.
     */
    async function cargarDatosIniciales() {
        if (!sorteoId) {
            resumenDiv.innerHTML = '<p class="error-message">Error: No se especificó un sorteo.</p>';
            return;
        }

        try {
            // Cargar detalles del sorteo (tipo, config de bolas, etc.)
            const sorteoRes = await fetch(`${API_BASE_URL}/api/sorteo-details/${sorteoId}`);
            const sorteoResult = await sorteoRes.json();
            if (!sorteoResult.success) throw new Error(sorteoResult.error);
            sorteoData = sorteoResult.sorteo;

            // Cargar números ya ocupados
            const numerosRes = await fetch(`${API_BASE_URL}/api/numeros-ocupados/${sorteoId}`);
            const numerosResult = await numerosRes.json();
            if (!numerosResult.success) throw new Error(numerosResult.error);
            numerosOcupados = numerosResult.numerosOcupados.map(n => JSON.stringify(n)); // Guardamos como strings para comparar fácil

            actualizarResumen();
            
            if (sorteoData.tipo_sorteo === 'tombola_interactiva') {
                renderizarSelectoresDeBolas();
            } else {
                // Si no es de tómbola, se asume la compra de un paquete normal
                const paqueteBoletos = params.get('paqueteBoletos') || 1;
                for(let i = 0; i < paqueteBoletos; i++) {
                    misNumerosSeleccionados.push(null); // Añade 'null' para indicar que son boletos sin número elegido
                }
                actualizarListaMisNumeros();
            }

        } catch (error) {
            resumenDiv.innerHTML = `<p class="error-message">Error al cargar datos del sorteo: ${error.message}</p>`;
            form.style.display = 'none';
        }
    }

    /**
     * Actualiza el resumen del pedido en la parte superior de la página.
     */
    function actualizarResumen() {
        const paqueteNombre = params.get('paqueteNombre') || "Boleto Individual";
        const paquetePrecio = params.get('paquetePrecio') || "Variable";

        resumenDiv.innerHTML = `
            <p><strong>Sorteo:</strong> ${sorteoData.nombre_premio_display}</p>
            <p><strong>Estás comprando:</strong> ${paqueteNombre}</p>
            <p><strong>Total a Pagar:</strong> $${paquetePrecio}</p>
        `;
    }

    /**
     * Crea y muestra los selectores de bolas basados en la configuración del sorteo.
     */
    function renderizarSelectoresDeBolas() {
        selectorContainer.innerHTML = '<h4><i class="fas fa-arrow-down"></i> Elige tu combinación de la suerte:</h4>';
        selectorContainer.classList.remove('oculto');
        misNumerosContainer.style.display = 'block';

        const configBolas = sorteoData.configuracion_tombola;
        if (!configBolas || configBolas.length === 0) return;

        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'selector-wrapper';

        configBolas.forEach((bola, index) => {
            const pickerHTML = `
                <div class="number-picker">
                    <div class="picker-wheel" id="wheel-${index}">
                        ${Array.from({ length: bola.max + 1 }, (_, i) => 
                            `<div class="picker-item">${String(i).padStart(bola.digitos, '0')}</div>`
                        ).join('')}
                    </div>
                </div>
            `;
            selectorWrapper.innerHTML += pickerHTML;
        });

        selectorContainer.appendChild(selectorWrapper);
        
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.id = 'btn-add-number';
        addButton.className = 'admin-button';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Añadir esta combinación';
        selectorContainer.appendChild(addButton);
        
        const statusCombinacion = document.createElement('div');
        statusCombinacion.id = 'status-combinacion';
        statusCombinacion.className = 'status-container oculto';
        selectorContainer.appendChild(statusCombinacion);

        addButton.addEventListener('click', anadirNumeroSeleccionado);
        
        // Comprobar disponibilidad al hacer scroll en las ruedas
        document.querySelectorAll('.picker-wheel').forEach(wheel => {
            wheel.addEventListener('scroll', () => {
                // Pequeña demora para no sobrecargar de checks
                setTimeout(comprobarDisponibilidad, 200);
            });
        });

        comprobarDisponibilidad();
    }

    /**
     * Obtiene la combinación de números actualmente seleccionada en los pickers.
     * @returns {Array<number>}
     */
    function getSeleccionActual() {
        const seleccion = [];
        // Mensaje para saber que la función se está ejecutando
        console.log("--- Calculando Selección Actual ---");

        document.querySelectorAll('.picker-wheel').forEach((wheel, index) => {
            const scrollTop = wheel.scrollTop;
            // Usamos 'optional chaining' (?.) para evitar errores si no encuentra el item
            const itemHeight = wheel.querySelector('.picker-item')?.offsetHeight;

            // Mensajes de depuración para ver los valores internos
            console.log(`Rueda #${index + 1}:`);
            console.log(`  -> Posición del Scroll (scrollTop): ${scrollTop}`);
            console.log(`  -> Altura del Item (itemHeight): ${itemHeight}`);

            // Solo hacemos el cálculo si tenemos una altura válida
            if (itemHeight && itemHeight > 0) {
                const selectedIndex = Math.round(scrollTop / itemHeight);
                console.log(`  -> Índice Calculado: ${selectedIndex}`);
                seleccion.push(selectedIndex);
            } else {
                console.error(`  -> ERROR: No se pudo determinar la altura del item para la rueda #${index + 1}. Se usará 0.`);
                seleccion.push(0); // Si hay un error, devolvemos 0 para evitar que la app se rompa
            }
        });

        console.log("-> Selección Final que se va a añadir: ", seleccion);
        return seleccion;
    }

    /**
     * Comprueba si la combinación seleccionada está disponible.
     */
    function comprobarDisponibilidad() {
        const seleccion = getSeleccionActual();
        const seleccionString = JSON.stringify(seleccion);
        const addButton = document.getElementById('btn-add-number');
        const statusDiv = document.getElementById('status-combinacion');

        if (numerosOcupados.includes(seleccionString)) {
            addButton.disabled = true;
            statusDiv.textContent = 'Esta combinación ya está ocupada. Prueba otra.';
            statusDiv.className = 'status-container error';
        } else if (misNumerosSeleccionados.map(n => JSON.stringify(n)).includes(seleccionString)) {
            addButton.disabled = true;
            statusDiv.textContent = 'Ya has añadido esta combinación a tu lista.';
            statusDiv.className = 'status-container error';
        } else {
            addButton.disabled = false;
            statusDiv.className = 'status-container oculto';
        }
    }

    /**
     * Añade la combinación actual a la lista de "mis números".
     */
    function anadirNumeroSeleccionado() {
        const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
        if (misNumerosSeleccionados.length >= paqueteBoletos) {
            alert(`Ya has elegido los ${paqueteBoletos} números de tu paquete.`);
            return;
        }

        const seleccion = getSeleccionActual();
        misNumerosSeleccionados.push(seleccion);
        actualizarListaMisNumeros();
        comprobarDisponibilidad(); // Re-comprueba para mostrar que ahora está en tu lista
    }
    
    /**
     * Renderiza la lista de números que el usuario ha elegido.
     */
    function actualizarListaMisNumeros() {
        listaNumerosElegidos.innerHTML = '';
        if (misNumerosSeleccionados.length === 0) {
            listaNumerosElegidos.innerHTML = '<li class="empty-list">Aún no has elegido números.</li>';
        }

        misNumerosSeleccionados.forEach((numeros, index) => {
            const li = document.createElement('li');
            li.className = 'numero-elegido-item';
            
            let contenido = '';
            if (numeros === null) {
                contenido = `<span>Boleto #${index + 1} (Ruleta Digital)</span>`;
            } else {
                const bolasHTML = numeros.map(n => `<div class="bola-small">${n}</div>`).join('');
                contenido = `
                    <div class="bolas-container">${bolasHTML}</div>
                    <button type="button" class="btn-eliminar-numero" data-index="${index}">&times;</button>
                `;
            }
            li.innerHTML = contenido;
            listaNumerosElegidos.appendChild(li);
        });
    }

    /**
     * Maneja el envío final del formulario de pedido.
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
        if (sorteoData.tipo_sorteo === 'tombola_interactiva' && misNumerosSeleccionados.length !== paqueteBoletos) {
            alert(`Debes elegir exactamente ${paqueteBoletos} combinación(es) de números para este paquete.`);
            return;
        }

        const payload = {
            sorteoId: sorteoId,
            sorteoNombre: sorteoData.nombre_premio_display,
            paquete: `${params.get('paqueteNombre')} (${params.get('paqueteBoletos')} x $${params.get('paquetePrecio')})`,
            nombre: document.getElementById('nombre').value,
            cedula: document.getElementById('cedula').value,
            ciudad: document.getElementById('ciudad').value,
            celular: document.getElementById('celular').value,
            email: document.getElementById('email').value,
            affiliateId: sessionStorage.getItem('affiliateRef') || null,
            numeros_elegidos: sorteoData.tipo_sorteo === 'tombola_interactiva' ? misNumerosSeleccionados : null
        };

        try {
            statusDiv.textContent = 'Procesando tu pedido...';
            statusDiv.className = 'status-container';
            const response = await fetch(`${API_BASE_URL}/api/crear-pedido`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error en el servidor.');
            
            if (typeof fbq === 'function') {
                fbq('track', 'Lead');
            }
            
            window.location.href = `gracias.html?pedidoId=${result.pedidoId}`;

        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'status-container error';
        }
    }


    // --- 3. EVENT LISTENERS ---
    form?.addEventListener('submit', handleFormSubmit);

    listaNumerosElegidos.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-eliminar-numero')) {
            const indexToRemove = parseInt(e.target.dataset.index, 10);
            misNumerosSeleccionados.splice(indexToRemove, 1);
            actualizarListaMisNumeros();
            comprobarDisponibilidad();
        }
    });

    // --- 4. EJECUCIÓN INICIAL ---
    cargarDatosIniciales();
});