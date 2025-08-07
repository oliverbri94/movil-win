// =================================================================
// == ARCHIVO COMPRAR.JS - VERSIÓN FINAL (DISEÑO RESTAURADO) ==
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
                params.set('paqueteBoletos', quantity);
                params.set('paqueteNombre', `Migración Manual (${quantity} combinaciones)`);
                params.set('paquetePrecio', '0.00');

                const resumenDiv = document.getElementById('resumen-pedido');
                const welcomeMessage = document.createElement('div');
                welcomeMessage.innerHTML = `
                    <h3 style="color: var(--clr-primary); text-align: center;">¡Bienvenido de vuelta!</h3>
                    <p style="text-align: center;">Hemos migrado tu compra anterior. Tienes <strong>${quantity} combinaciones de la suerte</strong> para elegir en este nuevo sorteo. ¡Totalmente gratis!</p>
                `;
                welcomeMessage.style.marginBottom = '20px';
                resumenDiv.parentNode.insertBefore(welcomeMessage, resumenDiv);
                
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.id = 'coupon_code';
                hiddenInput.name = 'coupon_code';
                hiddenInput.value = couponCode;
                document.getElementById('form-pedido').appendChild(hiddenInput);
                for(let i = 0; i < quantity; i++) {
                    // Usamos un valor único para saber que es un slot de migración
                    misNumerosSeleccionados.push([`MIGRADO-${i+1}`]); 
                }
                

            }
        } catch (e) {
            console.error("Error al procesar el cupón de migración:", e);
        }
    }

    try {
        const nombreParam = params.get('nombre');
        const cedulaParam = params.get('cedula');
        const ciudadParam = params.get('ciudad');
        const celularParam = params.get('celular');
        const emailParam = params.get('email');

        if (nombreParam) document.getElementById('nombre').value = nombreParam;
        if (cedulaParam) document.getElementById('cedula').value = cedulaParam;
        if (ciudadParam) document.getElementById('ciudad').value = ciudadParam;
        if (celularParam) document.getElementById('celular').value = celularParam;
        if (emailParam) document.getElementById('email').value = emailParam;
    } catch (e) {
        console.error("Error al pre-llenar el formulario:", e);
    }

    const form = document.getElementById('form-pedido');
    const steps = document.querySelectorAll('.form-step');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    
    const progressSteps = document.querySelectorAll('.progress-steps .step');
    const progressBarLine = document.querySelector('.progress-bar-line');

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

    // CORREGIDO: Esta función ahora usa 'misNumerosSeleccionados' y lee de los inputs
    const anadirNumeroSeleccionado = () => {
        const selectorWrapper = document.querySelector('.selector-wrapper');
        if (!selectorWrapper) return;

        const inputs = selectorWrapper.querySelectorAll('.manual-input');
        const combinacion = [];
        let esValido = true;

        inputs.forEach(input => {
            const valor = input.value;
            const valorNumerico = parseInt(valor, 10);
            const maxPermitido = parseInt(input.dataset.max, 10);
            if (valor === '' || isNaN(valorNumerico) || valorNumerico > maxPermitido || valorNumerico < 1) {
                esValido = false;
            } else {
                combinacion.push(String(valorNumerico).padStart(input.dataset.digitos, '0'));
            }
        });

        if (!esValido) {
            showStatusMessage('status-combinacion', 'Por favor, asegúrate de que todas las casillas tengan un número válido (mayor a 0).', true);
            return;
        }

        const combinacionString = JSON.stringify(combinacion);
        if (numerosOcupados.includes(combinacionString)) {
            showStatusMessage('status-combinacion', '¡Esa combinación ya fue elegida! Por favor, elige otra.', true);
            return;
        }

        if (misNumerosSeleccionados.some(c => JSON.stringify(c) === combinacionString)) {
            showStatusMessage('status-combinacion', 'Ya has elegido esta combinación en tu lista actual.', true);
            return;
        }

        // --- LÓGICA CORREGIDA ---
        // Buscamos el primer slot de migración disponible para reemplazarlo
        const indexMigrado = misNumerosSeleccionados.findIndex(n => Array.isArray(n) && n[0].startsWith('MIGRADO-'));

        if (indexMigrado !== -1) {
            // Si encuentra un slot migrado, lo reemplaza
            misNumerosSeleccionados[indexMigrado] = combinacion;
        } else {
            // Si no hay slots migrados (o es un usuario normal), simplemente añade el número si hay espacio
            const cantidadRequerida = parseInt(new URLSearchParams(window.location.search).get('paqueteBoletos') || '1', 10);
            if (misNumerosSeleccionados.length >= cantidadRequerida) {
                showStatusMessage('status-combinacion', `Ya has elegido el máximo de ${cantidadRequerida} combinaciones.`, true);
                return;
            }
            misNumerosSeleccionados.push(combinacion);
        }

        actualizarListaMisNumeros();
        showStatusMessage('status-combinacion', `¡Combinación [${combinacion.join('-')}] añadida!`, false);
    };
    const updateProgressBar = (stepIndex) => {
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= stepIndex);
        });
        const progressPercentage = (stepIndex / (steps.length - 1)) * 100;
        progressBarLine.style.width = `${progressPercentage}%`;
    };

    const validateStep = (stepIndex) => {
        if (stepIndex === 0) {
            const paqueteBoletos = parseInt(new URLSearchParams(window.location.search).get('paqueteBoletos') || '1', 10);

            // Verificamos que se haya llenado la cantidad correcta de boletos
            if (misNumerosSeleccionados.length < paqueteBoletos) {
                alert(`Debes elegir las ${paqueteBoletos} combinación(es) para continuar.`);
                return false;
            }

            // Verificamos que no queden slots de migración sin reemplazar
            const quedanSlotsMigrados = misNumerosSeleccionados.some(n => Array.isArray(n) && n[0].startsWith('MIGRADO-'));
            if (quedanSlotsMigrados) {
                alert(`Aún te quedan combinaciones de tu paquete migrado por elegir.`);
                return false;
            }
        }

        if (stepIndex === 1 || stepIndex === 2) {
            const inputs = steps[stepIndex].querySelectorAll('input[required]');
            let allValid = true;
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    input.parentElement.classList.add('invalid');
                    allValid = false;
                } else {
                    input.parentElement.classList.remove('invalid');
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
            const bolas = combo ? combo.map(n => `<div class="bola-small">${n}</div>`).join('') : '';
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
                <h4><i class="fas fa-ticket-alt"></i> Tus Números/Boletos</h4>
                <div class="numeros-finales-container">${numerosHTML}</div>
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
            if (!sorteoRes.ok) throw new Error('No se pudo conectar al servidor.');
            const sorteoResult = await sorteoRes.json();
            if (!sorteoResult.success) throw new Error(sorteoResult.error);
            sorteoData = sorteoResult.sorteo;

            const numerosRes = await fetch(`${API_BASE_URL}/api/numeros-ocupados/${sorteoId}`);
            if (!numerosRes.ok) throw new Error('No se pudo cargar la lista de números.');
            const numerosResult = await numerosRes.json();
            if (!numerosResult.success) throw new Error(numerosResult.error);
            numerosOcupados = numerosResult.numerosOcupados.map(n => JSON.stringify(n));

            actualizarResumen();
            
            if (sorteoData.tipo_sorteo === 'tombola_interactiva') {
                renderizarSelectoresDeBolas();
                actualizarListaMisNumeros();
            } else {
                selectorContainer.style.display = 'none';
                misNumerosContainer.style.display = 'block';
                const paqueteBoletos = parseInt(new URLSearchParams(window.location.search).get('paqueteBoletos') || '1', 10);
                for(let i = 0; i < paqueteBoletos; i++) {
                    misNumerosSeleccionados.push(null);
                }
                actualizarListaMisNumeros();
            }

        } catch (error) {
            console.error(error);
            resumenDiv.innerHTML = `<p class="error-message">Error al cargar datos del sorteo: ${error.message}</p>`;
            form.style.display = 'none';
        }
    };

    const actualizarResumen = () => {
        const currentParams = new URLSearchParams(window.location.search);

        const paqueteNombre = currentParams.get('paqueteNombre') || "Boleto Individual";
        const paquetePrecio = parseFloat(currentParams.get('paquetePrecio') || '0').toFixed(2);
        // Nueva línea para obtener la cantidad de boletos
        const paqueteBoletos = currentParams.get('paqueteBoletos') || '0';

        if (sorteoData) document.getElementById('resumen-sorteo-nombre').textContent = sorteoData.nombre_premio_display;
        document.getElementById('resumen-paquete-nombre').textContent = paqueteNombre;
        document.getElementById('resumen-total-pagar').textContent = `$${paquetePrecio}`;
        // Nueva línea para actualizar el contador en el resumen
        document.getElementById('resumen-cantidad-numeros').textContent = paqueteBoletos;
    };

    // RESTAURADO: Hemos vuelto a la función original que crea las bolas y los inputs
    const renderizarSelectoresDeBolas = () => {
        const headerHTML = `
            <div class="form-section-header">
                <i class="fas fa-hand-pointer"></i>
                <div class="header-text-container">
                    <h4>Elige tu combinación de la suerte</h4>
                    <p class="header-subtitle">Desliza o introduce manualmente el número. El día del sorteo sacaremos los números ganadores de nuestra tómbola en vivo.</p>
                </div>
            </div>`;
        selectorContainer.innerHTML = headerHTML;
        selectorContainer.classList.remove('oculto');
        misNumerosContainer.style.display = 'block';

        const configBolas = sorteoData.configuracion_tombola;
        if (!configBolas || configBolas.length === 0) return;

        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'selector-wrapper';
        selectorContainer.appendChild(selectorWrapper);

        configBolas.forEach((bola, index) => {
            const pickerContainer = document.createElement('div');
            pickerContainer.className = 'picker-column';
            const maxNum = parseInt(bola.max, 10);

            const pickerHTML = `
                <div class="number-picker" id="picker-${index}">
                    <div class="picker-wheel" id="wheel-${index}">
                        ${Array.from({ length: maxNum }, (_, i) => {
                            const numero = i + 1; // El número a mostrar empieza en 1
                            return `<div class="picker-item">${String(numero).padStart(bola.digitos, '0')}</div>`
                        }).join('')}
                    </div>
                </div>`;
            pickerContainer.innerHTML = pickerHTML;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'manual-input';
            input.id = `input-${index}`;
            input.placeholder = String(1).padStart(bola.digitos, '0');
            input.dataset.max = bola.max;
            input.dataset.digitos = bola.digitos;

            pickerContainer.appendChild(input);
            selectorWrapper.appendChild(pickerContainer);
        });

        // RESTAURADO: Lógica de sincronización entre la bola y el input
        configBolas.forEach((bola, index) => {
            const picker = document.getElementById(`picker-${index}`);
            const input = document.getElementById(`input-${index}`);
            
            if (!picker || !input) return; 
            const maxNum = parseInt(bola.max, 10); 


            const itemHeight = picker.querySelector('.picker-item')?.offsetHeight || 100;
            const pickerCenter = picker.offsetHeight / 2;
            let scrollTimeout;

            picker.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const scrollCenter = picker.scrollTop + pickerCenter;
                    const selectedIndex = Math.round(scrollCenter / itemHeight) -1;
                    
                    const numeroSeleccionado = selectedIndex + 1;
                    if (numeroSeleccionado >= 1 && numeroSeleccionado <= maxNum) {
                        input.value = String(numeroSeleccionado).padStart(bola.digitos, '0');
                    }
                }, 100);
            });

            input.addEventListener('input', (e) => {
                const valorActual = parseInt(e.target.value, 10);
                const maxPermitido = parseInt(e.target.dataset.max, 10);

                if (valorActual > maxPermitido) {
                    alert(`El número no puede ser mayor que ${maxPermitido}.`);
                    e.target.value = '';
                    return;
                }
                
                if (e.target.value.length >= bola.digitos && !isNaN(valorActual)) {
                    const targetScrollTop = (valorActual * itemHeight) - pickerCenter;

                    picker.scrollTo({
                        top: targetScrollTop,
                        behavior: 'smooth'
                    });
                }
            });
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'admin-button';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Añadir Combinación';
        addButton.addEventListener('click', anadirNumeroSeleccionado);
        
        const randomButton = document.createElement('button');
        randomButton.type = 'button';
        randomButton.className = 'admin-button-secondary'; 
        randomButton.innerHTML = '<i class="fas fa-random"></i> Elige Aleatoriamente';
        randomButton.style.marginTop = '10px';
        randomButton.addEventListener('click', anadirNumerosAleatorios);
        
        const statusCombinacion = document.createElement('div');
        statusCombinacion.id = 'status-combinacion';
        statusCombinacion.className = 'status-container oculto';

        selectorContainer.appendChild(randomButton);
        selectorContainer.appendChild(addButton);
        selectorContainer.appendChild(statusCombinacion);
    };

    const anadirNumerosAleatorios = () => {
        // Buscamos cuántos slots de migración quedan por llenar
        const slotsMigradosIndices = misNumerosSeleccionados.map((n, index) => (Array.isArray(n) && n[0].startsWith('MIGRADO-')) ? index : -1).filter(index => index !== -1);
        const numerosRestantes = slotsMigradosIndices.length > 0 ? slotsMigradosIndices.length : (parseInt(new URLSearchParams(window.location.search).get('paqueteBoletos') || '1', 10) - misNumerosSeleccionados.length);

        if (numerosRestantes <= 0) {
            showStatusMessage('status-combinacion', '¡Ya has completado tu paquete!', true);
            return;
        }

        const configBolas = sorteoData.configuracion_tombola;
        let numerosAnadidos = 0;

        for (let i = 0; i < numerosRestantes; i++) {
            let comboAleatorio, comboString, intentos = 0;
            do {
                comboAleatorio = configBolas.map(bola => {
                    const maxNum = parseInt(bola.max, 10);
                    const num = Math.floor(Math.random() * maxNum) + 1;
                    return String(num).padStart(bola.digitos, '0');
                });
                comboString = JSON.stringify(comboAleatorio);
                intentos++;
                if (intentos > 500) {
                    alert('No se pudieron encontrar suficientes combinaciones aleatorias disponibles.');
                    return;
                }
            } while (numerosOcupados.includes(comboString) || misNumerosSeleccionados.some(c => JSON.stringify(c) === comboString));

            if(slotsMigradosIndices.length > 0) {
                // Si estamos llenando slots de migración, los reemplazamos
                misNumerosSeleccionados[slotsMigradosIndices[i]] = comboAleatorio;
            } else {
                // Si es un usuario normal, los añadimos
                misNumerosSeleccionados.push(comboAleatorio);
            }
            numerosAnadidos++;
        }
        actualizarListaMisNumeros();
        showStatusMessage('status-combinacion', `¡Se añadieron ${numerosAnadidos} combinaciones aleatorias!`, false);
    };
    function actualizarListaMisNumeros() {
        const paqueteBoletos = parseInt(new URLSearchParams(window.location.search).get('paqueteBoletos') || '1', 10);
        listaNumerosElegidos.innerHTML = '';
        contadorNumerosSpan.textContent = `${misNumerosSeleccionados.length}/${paqueteBoletos}`;

        if(misNumerosSeleccionados.length === 0 && sorteoData.tipo_sorteo === 'tombola_interactiva') {
            listaNumerosElegidos.innerHTML = `<li class="empty-list">Aún no has elegido números.</li>`;
        }

        misNumerosSeleccionados.forEach((numeros, index) => {
            const li = document.createElement('li');
            li.className = 'numero-elegido-item';

            let contenido = '';
            if (numeros === null) {
                contenido = `<div class="bola-small-slot filled">Boleto #${index + 1}</div>`;
            } else {
            const esNumeroMigrado = (Array.isArray(numeros) && typeof numeros[0] === 'string' && numeros[0].startsWith('MIGRADO-'));

            const bolasHTML = esNumeroMigrado
                ? `<div class="bola-small-slot filled">Nº Migrado</div>` // Si es de migración, muestra un slot
                : numeros.map(n => `<div class="bola-small">${n}</div>`).join(''); // Si no, muestra las bolas normales
                contenido = `
                    <div class="bolas-container">${bolasHTML}</div>
                    <button type="button" class="btn-eliminar-numero" data-index="${index}">&times;</button>
                `;
            }
            li.innerHTML = contenido;
            listaNumerosElegidos.appendChild(li);
        });

        const slotsRestantes = paqueteBoletos - misNumerosSeleccionados.length;
        if (sorteoData && sorteoData.tipo_sorteo === 'tombola_interactiva') {
            for (let i = 0; i < slotsRestantes; i++) {
                const li = document.createElement('li');
                li.className = 'numero-elegido-item';
                li.innerHTML = '<div class="bola-small-slot"><i class="fas fa-plus"></i></div>';
                listaNumerosElegidos.appendChild(li);
            }
        }
    }

    const showStatusMessage = (elementId, message, isError = false) => {
        const statusEl = document.getElementById(elementId);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-container ${isError ? 'error' : 'success'}`;
            setTimeout(() => statusEl.classList.add('oculto'), 4000);
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
        
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        statusDiv.textContent = 'Procesando tu pedido...';
        statusDiv.className = 'status-container';

        const payload = {
            sorteoId: sorteoId,
            sorteoNombre: sorteoData.nombre_premio_display,
            paquete: params.get('paqueteNombre'),
            precio_paquete: parseFloat(params.get('paquetePrecio')),
            cantidad_boletos: parseInt(params.get('paqueteBoletos')),
            nombre: document.getElementById('nombre').value,
            cedula: document.getElementById('cedula').value,
            ciudad: document.getElementById('ciudad').value,
            celular: document.getElementById('celular').value,
            email: document.getElementById('email').value,
            coupon: couponCode || null,
            affiliateId: sessionStorage.getItem('affiliateRef') || null,
            numeros_elegidos: sorteoData.tipo_sorteo === 'tombola_interactiva' ? misNumerosSeleccionados : null
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/crear-pedido`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error en el servidor.');
            
            if (typeof fbq === 'function') {
                fbq('track', 'Lead', {
                    content_name: sorteoData.nombre_premio_display,
                    value: parseFloat(params.get('paquetePrecio')),
                    currency: 'USD'
                });
            }
            
            const numerosQuery = encodeURIComponent(JSON.stringify(misNumerosSeleccionados));
            window.location.href = `gracias.html?pedidoId=${result.pedidoId}&numeros=${numerosQuery}`;

        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'status-container error';
            submitButton.disabled = false;
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
    // Si es un caso de migración, actualiza la lista ahora que todo está cargado
    if (couponCode && couponCode.startsWith('MIGRACION-')) {
        actualizarListaMisNumeros();
    }

    cargarDatosIniciales();

    // --- Lógica para Añadir un Número Extra con UPGRADE ---
    const btnAnadirOtro = document.getElementById('btn-anadir-otro');
    if (btnAnadirOtro) {
        btnAnadirOtro.addEventListener('click', () => {
            if (!sorteoData || !sorteoData.paquetes_json || sorteoData.paquetes_json.length === 0) {
                alert('No se encontró información de paquetes para este sorteo.');
                return;
            }
            const todosLosPaquetes = sorteoData.paquetes_json;
            const currentParams = new URLSearchParams(window.location.search);
            let boletosActuales = parseInt(currentParams.get('paqueteBoletos') || '0', 10);
            let precioActual = parseFloat(currentParams.get('paquetePrecio') || '0.00');

            // 1. Encontrar el precio por número del paquete más básico para usarlo como base
            const paqueteIndividual = todosLosPaquetes.reduce((prev, curr) => {
                return (prev.boletos < curr.boletos) ? prev : curr;
            });
            const precioPorBoletoBase = parseFloat(paqueteIndividual.precio) / paqueteIndividual.boletos;

            // 2. Calcular el nuevo precio tentativo al añadir un número más
            const nuevoPrecioCalculado = precioActual + precioPorBoletoBase;

            // 3. BUSCAR EL MEJOR UPGRADE POSIBLE BASADO EN EL NUEVO PRECIO
            const paquetesOrdenados = [...todosLosPaquetes].sort((a, b) => parseFloat(b.precio) - parseFloat(a.precio));
            const paquetePotencial = paquetesOrdenados.find(p => nuevoPrecioCalculado >= parseFloat(p.precio));

            let nuevosBoletos, nuevoPrecio, nuevoNombrePaquete;

            // ¡ESTA ES LA LÍNEA CLAVE DE LA CORRECCIÓN!
            // Verificamos si el paquete encontrado es realmente un "upgrade" (mejor precio o más boletos)
            const esRealmenteUnUpgrade = paquetePotencial && (parseFloat(paquetePotencial.precio) > precioActual || (parseFloat(paquetePotencial.precio) === precioActual && paquetePotencial.cantidad_boletos > boletosActuales));

            if (esRealmenteUnUpgrade) {
                // ¡UPGRADE! Asignamos los valores del paquete superior que se alcanzó
                nuevosBoletos = paquetePotencial.boletos;
                nuevoPrecio = parseFloat(paquetePotencial.precio);
                nuevoNombrePaquete = paquetePotencial.nombre;
                showStatusMessage('status-combinacion', `¡Felicidades! Se actualizó a ${nuevoNombrePaquete}`, false);
            } else {
                // No hay upgrade, solo se suma un boleto más con el precio calculado
                nuevosBoletos = boletosActuales + 1;
                nuevoPrecio = nuevoPrecioCalculado;
                nuevoNombrePaquete = `Paquete Personalizado (${nuevosBoletos} números)`;
            }

            // 4. Actualizar la URL y la interfaz (esta parte no cambia)
            currentParams.set('paqueteBoletos', nuevosBoletos);
            currentParams.set('paquetePrecio', nuevoPrecio.toFixed(2));
            currentParams.set('paqueteNombre', nuevoNombrePaquete);
            const nuevaUrl = `${window.location.pathname}?${currentParams.toString()}`;
            history.pushState({ path: nuevaUrl }, '', nuevaUrl);

            actualizarResumen();
            actualizarListaMisNumeros();
        });
    }
    // --- Lógica para Autocompletar Datos del Cliente ---
    const cedulaInput = document.getElementById('cedula');
    if (cedulaInput) {
        let typingTimer; // Temporizador para no hacer la petición en cada tecla
        const doneTypingInterval = 800; // 0.8 segundos de espera

        const buscarDatosCliente = async () => {
            const cedula = cedulaInput.value;
            if (cedula.length !== 10) return; // Solo buscar si la cédula tiene 10 dígitos

            try {
                const response = await fetch(`${API_BASE_URL}/api/participante-datos/${cedula}`);
                const result = await response.json();

                if (result.success && result.data) {
                    // ¡Encontramos al cliente! Rellenamos los campos.
                    document.getElementById('nombre').value = result.data.nombre || '';
                    document.getElementById('ciudad').value = result.data.ciudad || '';
                    document.getElementById('celular').value = result.data.celular || '';
                    document.getElementById('email').value = result.data.email || '';

                    // Opcional: Notificar al usuario
                    showStatusMessage('pedido-status', '¡Qué bueno verte de nuevo! Hemos rellenado tus datos.', false);
                }
            } catch (error) {
                console.error('Error al autocompletar datos:', error);
            }
        };

        cedulaInput.addEventListener('keyup', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(buscarDatosCliente, doneTypingInterval);
        });

        cedulaInput.addEventListener('keydown', () => {
            clearTimeout(typingTimer);
        });
    }
}); 