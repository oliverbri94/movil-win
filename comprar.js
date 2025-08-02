// =================================================================
// == ARCHIVO COMPRAR.JS - VERSIÓN FINAL Y CORREGIDA (MULTI-STEP) ==
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. DECLARACIÓN DE VARIABLES Y ELEMENTOS ---
    const params = new URLSearchParams(window.location.search);
    const sorteoId = params.get('sorteoId');
    const couponCode = params.get('coupon');

    // Variables de estado
    let currentStep = 0;
    let sorteoData = null;
    let numerosOcupados = [];
    let misNumerosSeleccionados = [];
    if (couponCode && couponCode.startsWith('MIGRACION-')) {
        try {
            const parts = couponCode.split('-');
            const quantity = parseInt(parts[1], 10);
            const userId = parts[2];

            if (quantity > 0 && userId) {
                // ¡Magia! Sobreescribimos los parámetros del paquete.
                params.set('paqueteBoletos', quantity);
                params.set('paqueteNombre', `Migración Manual (${quantity} combinaciones)`);
                params.set('paquetePrecio', '0.00'); // El precio es CERO

                // Mostramos un mensaje de bienvenida al usuario migrado
                const resumenDiv = document.getElementById('resumen-pedido');
                const welcomeMessage = document.createElement('div');
                welcomeMessage.innerHTML = `
                    <h3 style="color: var(--clr-primary); text-align: center;">¡Bienvenido de vuelta!</h3>
                    <p style="text-align: center;">Hemos migrado tu compra anterior. Tienes <strong>${quantity} combinaciones de la suerte</strong> para elegir en este nuevo sorteo. ¡Totalmente gratis!</p>
                `;
                welcomeMessage.style.marginBottom = '20px';
                resumenDiv.parentNode.insertBefore(welcomeMessage, resumenDiv);
                
                // Añadimos el cupón a un campo oculto para enviarlo con el formulario
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'coupon_code';
                hiddenInput.name = 'coupon_code';
                hiddenInput.value = couponCode;
                document.getElementById('form-pedido').appendChild(hiddenInput);
            }
        } catch (e) {
            console.error("Error al procesar el cupón de migración:", e);
        }
    }


    // --- LÓGICA PARA PRE-LLENAR EL FORMULARIO ---
    try {
        const nombreParam = params.get('nombre');
        const cedulaParam = params.get('cedula');
        const ciudadParam = params.get('ciudad');
        const celularParam = params.get('celular');
        // --- ¡NUEVO! Leemos el parámetro del email ---
        const emailParam = params.get('email');

        if (nombreParam) {
            document.getElementById('nombre').value = nombreParam;
        }
        if (cedulaParam) {
            document.getElementById('cedula').value = cedulaParam;
        }
        if (ciudadParam) {
            document.getElementById('ciudad').value = ciudadParam;
        }
        if (celularParam) {
            document.getElementById('celular').value = celularParam;
        }
        // --- ¡NUEVO! Rellenamos el campo del email ---
        if (emailParam) {
            document.getElementById('email').value = emailParam;
        }
    } catch (e) {
        console.error("Error al pre-llenar el formulario:", e);
    }
    // --- FIN DE LA LÓGICA PARA PRE-LLENAR ---
    // Elementos del formulario
    const form = document.getElementById('form-pedido');
    const steps = document.querySelectorAll('.form-step');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    
    // Elementos de la barra de progreso
    const progressSteps = document.querySelectorAll('.progress-steps .step');
    const progressBarLine = document.querySelector('.progress-bar-line');

    // Elementos de contenido dinámico
    const resumenDiv = document.getElementById('resumen-pedido');
    const selectorContainer = document.getElementById('selector-numeros-container');
    const misNumerosContainer = document.getElementById('mis-numeros-container');
    const listaNumerosElegidos = document.getElementById('lista-numeros-elegidos');
    const contadorNumerosSpan = document.getElementById('contador-numeros');
    const resumenFinalDiv = document.getElementById('resumen-final');
    const statusDiv = document.getElementById('pedido-status');
    

    // --- 2. FUNCIONES DEL FORMULARIO MULTI-STEP ---

    const showStep = (stepIndex) => {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === stepIndex);
        });
        updateProgressBar(stepIndex);
    };

    const updateProgressBar = (stepIndex) => {
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= stepIndex);
        });
        const progressPercentage = (stepIndex / (steps.length - 1)) * 100;
        progressBarLine.style.width = `${progressPercentage}%`;
    };

    const validateStep = (stepIndex) => {
        // Validación del Paso 1: Selección de números
        if (stepIndex === 0) {
            const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
            if (sorteoData.tipo_sorteo === 'tombola_interactiva' && misNumerosSeleccionados.length !== paqueteBoletos) {
                alert(`Debes elegir exactamente ${paqueteBoletos} combinación(es) para tu paquete.`);
                return false;
            }
            if (misNumerosSeleccionados.length === 0) {
                alert('Debes añadir al menos una combinación de números o un boleto.');
                return false;
            }
        }
        // Validación del Paso 2: Datos del usuario
        if (stepIndex === 1) {
            const inputs = steps[stepIndex].querySelectorAll('input[required]');
            let allValid = true;
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    input.parentElement.classList.add('invalid');
                    allValid = false;
                } else {
                    input.parentElement.classList.remove('invalid');
                    input.parentElement.classList.add('valid');
                }
            });
            if (!allValid) {
                alert('Por favor, completa todos los campos requeridos.');
                return false;
            }
        }
        return true;
    };
    
    const populateConfirmationStep = () => {
        const nombre = document.getElementById('nombre').value;
        const cedula = document.getElementById('cedula').value;
        const paqueteNombre = params.get('paqueteNombre') || "Boleto Individual";

        let numerosHTML = misNumerosSeleccionados.map(combo => {
            const bolas = combo.map(n => `<div class="bola-small">${n}</div>`).join('');
            return `<div class="numero-elegido-item">${bolas}</div>`;
        }).join('');

        if (sorteoData.tipo_sorteo !== 'tombola_interactiva') {
            const cantidad = params.get('paqueteBoletos') || 1;
            numerosHTML = `<p>${cantidad} boleto(s) para sorteo con ruleta digital.</p>`;
        }

        resumenFinalDiv.innerHTML = `
            <div class="resumen-seccion">
                <h4><i class="fas fa-gift"></i> Tu Sorteo</h4>
                <p>${sorteoData.nombre_premio_display}</p>
                <p><strong>Paquete:</strong> ${paqueteNombre}</p>
            </div>
            <div class="resumen-seccion">
                <h4><i class="fas fa-ticket-alt"></i> Tus Números</h4>
                ${numerosHTML}
            </div>
            <div class="resumen-seccion">
                <h4><i class="fas fa-user"></i> Tus Datos</h4>
                <p><strong>Nombre:</strong> ${nombre}</p>
                <p><strong>Cédula:</strong> ${cedula}</p>
            </div>
        `;
    };

    // --- 3. FUNCIONES DEL SELECTOR DE NÚMEROS Y LÓGICA DE COMPRA ---

    const cargarDatosIniciales = async () => {
        if (!sorteoId) {
            resumenDiv.innerHTML = '<p class="error-message">Error: No se especificó un sorteo.</p>';
            form.style.display = 'none';
            return;
        }

        try {
            const sorteoRes = await fetch(`${API_BASE_URL}/api/sorteo-details/${sorteoId}`);
            const sorteoResult = await sorteoRes.json();
            if (!sorteoResult.success) throw new Error(sorteoResult.error);
            sorteoData = sorteoResult.sorteo;

            const numerosRes = await fetch(`${API_BASE_URL}/api/numeros-ocupados/${sorteoId}`);
            const numerosResult = await numerosRes.json();
            if (!numerosResult.success) throw new Error(numerosResult.error);
            numerosOcupados = numerosResult.numerosOcupados.map(n => JSON.stringify(n));

            actualizarResumen();
            
            if (sorteoData.tipo_sorteo === 'tombola_interactiva') {
                renderizarSelectoresDeBolas();
            } else {
                const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
                for(let i = 0; i < paqueteBoletos; i++) {
                    misNumerosSeleccionados.push(null);
                }
                actualizarListaMisNumeros();
            }

        } catch (error) {
            resumenDiv.innerHTML = `<p class="error-message">Error al cargar datos del sorteo: ${error.message}</p>`;
            form.style.display = 'none';
        }
    };

    const actualizarResumen = () => {
        const paqueteNombre = params.get('paqueteNombre') || "Boleto Individual";
        const paquetePrecio = params.get('paquetePrecio') || "Variable";
        resumenDiv.innerHTML = `
            <p><strong>Sorteo:</strong> ${sorteoData.nombre_premio_display}</p>
            <p><strong>Estás comprando:</strong> ${paqueteNombre}</p>
            <p><strong>Total a Pagar:</strong> $${paquetePrecio}</p>
        `;
    };

// EN COMPRAR.JS - REEMPLAZA LA FUNCIÓN COMPLETA

    const renderizarSelectoresDeBolas = () => {
        const headerHTML = `
            <div class="form-section-header">
                <i class="fas fa-hand-pointer"></i>
                <h4>Elige tu combinación de la suerte</h4>
            </div>`;
        selectorContainer.innerHTML = headerHTML;
        selectorContainer.classList.remove('oculto');
        misNumerosContainer.style.display = 'block';

        const configBolas = sorteoData.configuracion_tombola;
        if (!configBolas || configBolas.length === 0) return;

        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'selector-wrapper';

        configBolas.forEach((bola, index) => {
            const pickerContainer = document.createElement('div');
            pickerContainer.className = 'picker-column';

            const pickerHTML = `
                <div class="number-picker" id="picker-${index}">
                    <div class="picker-wheel" id="wheel-${index}">
                        ${Array.from({ length: bola.max + 1 }, (_, i) => 
                            `<div class="picker-item">${String(i).padStart(bola.digitos, '0')}</div>`
                        ).join('')}
                    </div>
                </div>`;
            pickerContainer.innerHTML = pickerHTML;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'manual-input';
            input.id = `input-${index}`;
            input.placeholder = String(0).padStart(bola.digitos, '0');
            input.dataset.max = bola.max;
            input.dataset.digitos = bola.digitos;

            pickerContainer.appendChild(input);
            selectorWrapper.appendChild(pickerContainer);

            // --- SINCRONIZACIÓN EN DOS VÍAS ---

            const picker = document.getElementById(`picker-${index}`);
            const itemHeight = picker.querySelector('.picker-item').offsetHeight;
            let scrollTimeout;

            // 1. Cuando se hace SCROLL en la RUEDA -> Actualiza el INPUT
            picker.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const selectedIndex = Math.round(picker.scrollTop / itemHeight);
                    const numeroFormateado = String(selectedIndex).padStart(bola.digitos, '0');
                    input.value = numeroFormateado;
                }, 150); // Un pequeño retardo para no sobrecargar
            });

            // 2. Cuando se ESCRIBE en el INPUT -> Actualiza la RUEDA
            input.addEventListener('input', (e) => {
                const valorActual = parseInt(e.target.value, 10);
                const maxPermitido = parseInt(e.target.dataset.max, 10);

                // Validamos que el número no sea mayor al permitido
                if (valorActual > maxPermitido) {
                    alert(`El número no puede ser mayor que ${maxPermitido}.`);
                    e.target.value = '';
                    return;
                }
                
                // Si el campo tiene el número correcto de dígitos, movemos la rueda
                if (e.target.value.length >= bola.digitos && !isNaN(valorActual)) {
                    picker.scrollTo({
                        top: valorActual * itemHeight,
                        behavior: 'smooth'
                    });
                }
            });
        });

        selectorContainer.appendChild(selectorWrapper);
        
        // (El resto de la función para crear los botones no cambia)
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.id = 'btn-add-number';
        addButton.className = 'admin-button';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Añadir Combinación';
        selectorContainer.appendChild(addButton);
        
        const randomButton = document.createElement('button');
        randomButton.type = 'button';
        randomButton.id = 'btn-random';
        randomButton.className = 'admin-button-secondary'; 
        randomButton.innerHTML = '<i class="fas fa-random"></i> Llenar con Números Aleatorios';
        randomButton.style.marginTop = '10px';
        selectorContainer.insertBefore(randomButton, addButton);

        randomButton.addEventListener('click', anadirNumerosAleatorios);
        const statusCombinacion = document.createElement('div');
        statusCombinacion.id = 'status-combinacion';
        statusCombinacion.className = 'status-container oculto';
        selectorContainer.appendChild(statusCombinacion);

        addButton.addEventListener('click', anadirNumeroSeleccionado);
    };
    const getSeleccionActual = () => {
        const seleccion = [];
        document.querySelectorAll('.number-picker').forEach((picker) => {
            const scrollTop = picker.scrollTop;
            const itemHeight = picker.querySelector('.picker-item')?.offsetHeight;
            if (itemHeight && itemHeight > 0) {
                const selectedIndex = Math.floor(scrollTop / itemHeight);
                seleccion.push(selectedIndex);
            } else {
                seleccion.push(0);
            }
        });
        return seleccion;
    };

    const anadirNumeroSeleccionado = () => {
        const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
        if (misNumerosSeleccionados.length >= paqueteBoletos) {
            alert(`Ya has elegido los ${paqueteBoletos} números de tu paquete.`);
            return;
        }

        const manualInputs = document.querySelectorAll('.manual-input');
        const hayInputManual = Array.from(manualInputs).some(input => input.value !== '');
        let seleccionFinal = [];

        if (hayInputManual) {
            let esValido = true;
            manualInputs.forEach(input => {
                const valor = parseInt(input.value, 10);
                if (isNaN(valor) || input.value.length !== input.maxLength) {
                    esValido = false;
                }
                seleccionFinal.push(valor);
            });
            if (!esValido) {
                alert('Por favor, introduce un número válido en cada casilla con el número correcto de dígitos.');
                return;
            }
        } else {
            seleccionFinal = getSeleccionActual();
        }

        const seleccionString = JSON.stringify(seleccionFinal);
        const statusDiv = document.getElementById('status-combinacion');

        if (numerosOcupados.includes(seleccionString)) {
            statusDiv.textContent = 'Esta combinación ya está ocupada. Prueba otra.';
            statusDiv.className = 'status-container error';
            return;
        }
        if (misNumerosSeleccionados.map(n => JSON.stringify(n)).includes(seleccionString)) {
            statusDiv.textContent = 'Ya has añadido esta combinación a tu lista.';
            statusDiv.className = 'status-container error';
            return;
        }

        statusDiv.className = 'status-container oculto';
        misNumerosSeleccionados.push(seleccionFinal);
        actualizarListaMisNumeros();
        manualInputs.forEach(input => input.value = '');
    };
    const anadirNumerosAleatorios = () => {
        const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
        const numerosRestantes = paqueteBoletos - misNumerosSeleccionados.length;

        if (numerosRestantes <= 0) {
            alert('¡Ya has completado tu paquete de boletos!');
            return;
        }

        const configBolas = sorteoData.configuracion_tombola;
        const statusDiv = document.getElementById('status-combinacion');
        let numerosAnadidos = 0;

        for (let i = 0; i < numerosRestantes; i++) {
            let comboAleatorio;
            let comboString;
            let intentos = 0;
            const MAX_INTENTOS = 500; // Límite para evitar bucles infinitos

            do {
                comboAleatorio = configBolas.map(bola => Math.floor(Math.random() * (bola.max + 1)));
                comboString = JSON.stringify(comboAleatorio);
                intentos++;
                if (intentos > MAX_INTENTOS) {
                    alert('No se pudieron encontrar combinaciones aleatorias disponibles. ¡El sorteo está casi lleno! Elige los números restantes manualmente.');
                    return; // Sale de la función si no encuentra números
                }
            } while (numerosOcupados.includes(comboString) || misNumerosSeleccionados.map(n => JSON.stringify(n)).includes(comboString));

            misNumerosSeleccionados.push(comboAleatorio);
            numerosAnadidos++;
        }

        actualizarListaMisNumeros();
        statusDiv.textContent = `¡Se añadieron ${numerosAnadidos} combinaciones aleatorias!`;
        statusDiv.className = 'status-container success';
        setTimeout(() => statusDiv.classList.add('oculto'), 3000);
    };
    function actualizarListaMisNumeros() {
        const listaNumerosElegidos = document.getElementById('lista-numeros-elegidos');
        const paqueteBoletos = parseInt(params.get('paqueteBoletos') || '1', 10);
        listaNumerosElegidos.innerHTML = '';
        contadorNumerosSpan.textContent = `${misNumerosSeleccionados.length}/${paqueteBoletos}`;

        // Dibuja los números ya seleccionados
        misNumerosSeleccionados.forEach((numeros, index) => {
            const li = document.createElement('li');
            li.className = 'numero-elegido-item';

            let contenido = '';
            if (numeros === null) {
                // Para sorteos de ruleta
                contenido = `<div class="bola-small-slot filled">Boleto #${index + 1}</div>`;
            } else {
                // Para sorteos de tómbola
                const bolasHTML = numeros.map(n => `<div class="bola-small">${n}</div>`).join('');
                contenido = `
                    <div class="bolas-container">${bolasHTML}</div>
                    <button type="button" class="btn-eliminar-numero" data-index="${index}">&times;</button>
                `;
            }
            li.innerHTML = contenido;
            listaNumerosElegidos.appendChild(li);
        });

        // Dibuja los slots vacíos restantes
        const slotsRestantes = paqueteBoletos - misNumerosSeleccionados.length;
        for (let i = 0; i < slotsRestantes; i++) {
            const li = document.createElement('li');
            li.className = 'numero-elegido-item';
            li.innerHTML = '<div class="bola-small-slot"><i class="fas fa-plus"></i></div>';
            listaNumerosElegidos.appendChild(li);
        }
    }
    // Validación en tiempo real para el paso de datos
    const step2Inputs = document.querySelectorAll('#step-2 input[required], #step-3 input[required]');
    step2Inputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.value.trim() !== "") {
                input.parentElement.classList.add('valid');
                input.parentElement.classList.remove('invalid');
            } else {
                input.parentElement.classList.add('invalid');
                input.parentElement.classList.remove('valid');
            }
        });
    });
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
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
            
            window.location.href = `gracias.html?pedidoId=${result.pedidoId}&numeros=${numerosQuery}`;

        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'status-container error';
        }
    };

    // --- 4. EVENT LISTENERS ---
    
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                currentStep++;
                if (currentStep === 3) {
                    populateConfirmationStep();
                }
                showStep(currentStep);
            }
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStep--;
            showStep(currentStep);
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Se construye el paquete de datos para enviar al servidor
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
            
            // ¡CORRECCIÓN! Se define la variable ANTES de usarla
            const numerosQuery = encodeURIComponent(JSON.stringify(misNumerosSeleccionados));
            window.location.href = `gracias.html?pedidoId=${result.pedidoId}&numeros=${numerosQuery}`;

        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'status-container error';
        }
    });
    listaNumerosElegidos.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-eliminar-numero')) {
            const indexToRemove = parseInt(e.target.dataset.index, 10);
            misNumerosSeleccionados.splice(indexToRemove, 1);
            actualizarListaMisNumeros();
        }
    });

    // --- 5. EJECUCIÓN INICIAL ---
    showStep(currentStep);
    cargarDatosIniciales();
});