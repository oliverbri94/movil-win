// ===============================================
//      SERVIDOR DE PRUEBA MÍNIMO PARA CORS
// ===============================================
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de CORS explícita y hardcodeada ---
// Esto le dice al servidor que confíe explícitamente en tu dominio.
const corsOptions = {
    origin: 'https://movilwin.com',
    credentials: true
};

// Aplicamos la configuración de CORS a TODAS las peticiones
app.use(cors(corsOptions));

// --- Ruta de prueba ---
// Una única ruta para ver si responde correctamente
app.get('/test-cors', (req, res) => {
    console.log("-> Petición de prueba recibida en /test-cors");
    res.status(200).json({ 
        message: "¡Éxito! El servidor de prueba respondió correctamente.",
        timestamp: new Date()
    });
});

// --- Ruta raíz para verificar que el servidor está vivo ---
app.get('/', (req, res) => {
    res.send('Servidor de prueba para MovilWin está activo y corriendo.');
});

app.listen(PORT, () => {
    console.log(`Servidor de prueba iniciado en el puerto ${PORT}`);
});