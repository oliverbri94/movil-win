// =================================================================
//      SERVER.JS - VERSIÓN MAESTRA Y DEFINITIVA
// =================================================================

// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

// --- 2. CONFIGURACIÓN INICIAL DE LA APP ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. CONEXIÓN A LA BASE DE DATOS (NATIVA DE POSTGRESQL) ---
// La conexión se establece una sola vez y se exporta para su uso en toda la app.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
console.log("Pool de conexión a PostgreSQL creado.");

// --- 4. CONFIGURACIÓN DE MIDDLEWARES (ORDEN CRÍTICO) ---
app.set('trust proxy', 1);
app.use(helmet());

const corsOptions = {
    origin: 'https://movilwin.com', // URL hardcodeada para máxima seguridad
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionStore = new pgSession({
    pool: pool,
    tableName: 'user_sessions'
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: true, 
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2,
        sameSite: 'none'
    }
}));

// --- 5. LÓGICA DE LA APLICACIÓN (RUTAS DE API) ---

// Middleware de autenticación (sin cambios)
function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ error: 'Acceso no autorizado.' });
}

// Ruta de prueba para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('Servidor MovilWin está activo.');
});

// Ruta de Login (Ejemplo de refactorización a `async/await` con `pool.query`)
app.post('/api/login', async (req, res) => {
    try {
        const { password } = req.body;
        // NOTA: ADMIN_PASSWORD_HASH debe estar configurada como variable de entorno en Render
        const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

        const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (match) {
            req.session.isAdmin = true;
            return res.json({ success: true, message: 'Login exitoso.' });
        } else {
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
    } catch (error) {
        console.error("Error en /api/login:", error);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// Ruta para verificar la sesión del admin (la que está fallando)
app.get('/api/admin/sorteos', requireAdminLogin, async (req, res) => {
    try {
        const sql = `
            SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales
            FROM sorteos_config s 
            ORDER BY s.id_sorteo DESC
        `;
        const { rows } = await pool.query(sql); // Así se hacen las consultas ahora
        res.json(rows);
    } catch (error) {
        console.error("Error en GET /api/admin/sorteos:", error);
        res.status(500).json({ error: 'Error al obtener sorteos.' });
    }
});


// --- 6. ARRANQUE DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor iniciado y escuchando en el puerto ${PORT}`);
});