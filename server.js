// =================================================================
// ARCHIVO SERVER.JS - ESTRUCTURA FINAL Y CORREGIDA
// =================================================================

// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

// --- 2. CONFIGURACIÓN INICIAL DE LA APP ---
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;

// --- 3. CONFIGURACIÓN DE MIDDLEWARES (EL ORDEN ES CRÍTICO) ---

// Confianza en el proxy de Render y seguridad básica
app.set('trust proxy', 1);
app.use(helmet());

// Parsers para leer el body de las peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 4. LÓGICA CONDICIONAL DE DB Y SESIÓN ---
// Declaramos las variables aquí para que sean accesibles en todo el archivo
let db;
let dbClient; 
let sessionStore = new session.MemoryStore(); // Usamos un store de memoria por defecto

// Verificamos si estamos en producción (en Render)
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    console.log("Detectado entorno de producción. Conectando a PostgreSQL...");

    // 1. CREAMOS LA CONEXIÓN A LA BASE DE DATOS PRIMERO
    dbClient = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // 2. CREAMOS EL ALMACÉN DE SESIONES USANDO ESA CONEXIÓN
    sessionStore = new pgSession({
        pool : dbClient,
        tableName : 'user_sessions'
    });

    // 3. Creamos la capa de compatibilidad para las consultas
    db = {
        run: (sql, params = [], callback = () => {}) => dbClient.query(sql, params).then(res => callback.call({ changes: res.rowCount, lastID: res.rows[0]?.id_sorteo || res.rows[0]?.id_afiliado || null }, null)).catch(err => callback(err)),
        get: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows[0])).catch(err => callback(err, null)),
        all: (sql, params = [], callback) => dbClient.query(sql, params).then(res => callback(null, res.rows)).catch(err => callback(err, null)),
        prepare: (sql) => ({
            run: (params = [], callback = () => {}) => dbClient.query(sql, params, (err, res) => callback(err, res?.rowCount)),
            finalize: (callback = () => {}) => callback()
        }),
        serialize: (callback) => callback()
    };
} else {
    // --- Lógica para Desarrollo (Tu PC con SQLite) ---
    console.log("Detectado entorno local. Conectando a SQLite...");
    const DB_FILE = path.join(__dirname, 'sorteo.db');
    db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) return console.error("Error al conectar con SQLite:", err.message);
        console.log(`Conectado a SQLite: ${DB_FILE}`);
    });
}

// --- 5. CONFIGURACIÓN DE SESIÓN Y CORS (USANDO EL STORE YA CREADO) ---

// Ahora configuramos la sesión, que usará 'sessionStore' (ya sea el de memoria o el de PostgreSQL)
app.use(session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2, // 2 horas
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Y finalmente, la configuración de CORS, que necesita que la sesión ya esté configurada.
const whitelist = [process.env.FRONTEND_URL, 'https://movilwin.com', 'http://127.0.0.1:5500'];
const corsOptions = {
    origin: function (origin, callback) {
        // La variable 'origin' es la URL que está haciendo la petición (tu frontend)
        console.log(`CORS Check: Petición recibida desde el origen: ${origin}`);
        
        // `!origin` es para permitir peticiones sin origen (como las de herramientas tipo Postman/Curl)
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            console.log(`   -> Origen PERMITIDO por la whitelist de CORS.`);
            callback(null, true);
        } else {
            console.error(`   -> Origen RECHAZADO por la whitelist de CORS: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    optionsSuccessStatus: 204 // Para peticiones pre-flight de OPTIONS
};
app.use(cors(corsOptions));

// Parsers para poder leer el body de las peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Configuración de la Sesión (usando el session store que ya definimos)
app.use(session({
    store: sessionStore, // Asegúrate de que la variable sessionStore esté definida arriba
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Servidor de archivos estáticos (no interfiere)
app.use(express.static('.'));



// --- 5. LÓGICA DE LA APLICACIÓN (MIDDLEWARES DE RUTA Y RUTAS DE API) ---

// Middleware de autenticación
function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Acceso no autorizado.' });
    }
}

// Limitador de peticiones para el login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de inicio de sesión.' }
});

let SORTEO_ACTUAL_INFO = {
    id_sorteo: null,
    nombre_premio_display: "Smartphone de Última Generación (Por Defecto)",
    nombre_base_archivo_guia: "Smartphone_Generico",
    descripcion_premio: "Un increíble smartphone con la última tecnología.",
    meta_participaciones: 200,
    status_sorteo: 'completado'

};

// 3. Configuración de Nodemailer (Email)
let transporter;
const mailConfig = {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, // Tu dirección de email Gmail
        pass: process.env.EMAIL_PASS // <<<--- ¡REEMPLAZA ESTO CON TU CONTRASEÑA DE APLICACIÓN DE GMAIL!
    },
    tls: {
        rejectUnauthorized: false
    }
};

try {
    transporter = nodemailer.createTransport(mailConfig);
    transporter.verify(function(error, success) {
       if (error) {
         console.error("Error configurando Nodemailer o verificando conexión SMTP:", error);
         transporter = null;
       } else {
         console.log("Nodemailer configurado y servidor SMTP listo para enviar correos desde ceo@movilwin.com");
       }
    });
} catch(err) {
    console.error("Excepción al crear transporter de Nodemailer:", err);
    transporter = null;
}




function requireAdminLogin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Acceso no autorizado.' });
    }
}
// =============================
// --- RUTAS PÚBLICAS DE LA API ---
// =============================

// --- AÑADE ESTA RUTA TEMPORAL PARA DEPURAR ---
app.get('/debug-cors', (req, res) => {
    console.log("Accediendo a la ruta de depuración de CORS.");
    res.json({
        mensaje: "Variables de entorno leídas por el servidor",
        origin_configurado: process.env.FRONTEND_URL || "No se encontró FRONTEND_URL",
        node_env: process.env.NODE_ENV,
        session_secret_existe: !!process.env.SESSION_SECRET
    });
});


// En server.js, reemplaza esta ruta
app.post('/api/crear-pedido', async (req, res) => {
    const { sorteoId, paquete, nombre, cedula, celular, email, ciudad, affiliateId, numeros_elegidos, coupon_code } = req.body;

    if (!sorteoId || !paquete || !nombre || !cedula) {
        return res.status(400).json({ error: 'Faltan datos para procesar el pedido.' });
    }
    
    // Convertimos el array de números a un string JSON para guardarlo
    const numerosElegidosString = numeros_elegidos ? JSON.stringify(numeros_elegidos) : null;

    const sql = `
        INSERT INTO pedidos (id_sorteo_fk, nombre_cliente, cedula_cliente, celular_cliente, email_cliente, paquete_elegido, ciudad_cliente, id_afiliado_fk, numeros_elegidos, codigo_cupon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id_pedido;
    `;    
    // Añadimos 'coupon_code' a los parámetros
    const params = [sorteoId, nombre, cedula, celular, email, paquete, ciudad, affiliateId, numerosElegidosString, coupon_code];

    try {
        const result = await new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });

        if (transporter && process.env.EMAIL_USER) {
            // ... (el código de envío de email no cambia, se puede dejar como está)
        }
        res.status(201).json({ success: true, message: 'Pedido recibido. Pendiente de pago.', pedidoId: result.id_pedido });
    } catch (error) {
        console.error("Error al crear pedido:", error);
        res.status(500).json({ success: false, error: 'No se pudo registrar el pedido.' });
    }
});

app.get('/api/sorteos-visibles', async (req, res) => {
    try {
        const sql = `
            SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales
            FROM sorteos_config s WHERE s.status_sorteo != 'completado'
            ORDER BY CASE s.status_sorteo WHEN 'activo' THEN 1 WHEN 'programado' THEN 2 ELSE 3 END, s.id_sorteo DESC;
        `;
        const rows = await new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) return reject(new Error("Error al consultar sorteos visibles en la BD."));
                resolve(rows);
            });
        });

        const sorteosProcesados = rows.map(sorteo => {
            try {
                if (sorteo.paquetes_json) {
                    sorteo.paquetes_json = JSON.parse(sorteo.paquetes_json);
                } else {
                    sorteo.paquetes_json = [];
                }
                // ¡NUEVO! Parseamos la configuración de la tómbola
                if (sorteo.configuracion_tombola) {
                    sorteo.configuracion_tombola = JSON.parse(sorteo.configuracion_tombola);
                } else {
                    sorteo.configuracion_tombola = null;
                }
            } catch (e) {
                console.error(`Error parseando JSON para sorteo ID ${sorteo.id_sorteo}:`, e);
                sorteo.paquetes_json = [];
                sorteo.configuracion_tombola = null;
            }
            return sorteo;
        });

        res.json({ success: true, sorteos: sorteosProcesados });
    } catch (error) {
        console.error("Error en GET /api/sorteos-visibles:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor." });
    }
});


// PEGA ESTAS TRES NUEVAS RUTAS

// NUEVA RUTA: OBTENER DETALLES DE UN SORTEO ESPECÍFICO
app.get('/api/sorteo-details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `SELECT id_sorteo, nombre_premio_display, tipo_sorteo, configuracion_tombola, paquetes_json FROM sorteos_config WHERE id_sorteo = $1`;

        const sorteo = await new Promise((resolve, reject) => {
            db.get(sql, [id], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!sorteo) {
            return res.status(404).json({ error: 'Sorteo no encontrado.' });
        }

        if (sorteo.configuracion_tombola) {
            sorteo.configuracion_tombola = JSON.parse(sorteo.configuracion_tombola);
        }
        if (sorteo.paquetes_json) {
            sorteo.paquetes_json = JSON.parse(sorteo.paquetes_json);
        } else {
            sorteo.paquetes_json = [];
        }
        res.json({ success: true, sorteo });
    } catch (error) {
        console.error("Error al obtener detalles del sorteo:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// BUSCAR DATOS DE UN PARTICIPANTE POR CÉDULA
app.get('/api/participante-datos/:cedula', async (req, res) => {
    try {
        const { cedula } = req.params;
        // Validamos que sea una cédula con el formato correcto (10 dígitos)
        if (!cedula || !/^\d{10}$/.test(cedula)) {
            return res.status(400).json({ success: false, error: 'Formato de cédula inválido.' });
        }

        const sql = `SELECT nombre, ciudad, celular, email FROM datos_unicos_participantes WHERE id_documento = $1`;
        const participante = await new Promise((resolve, reject) => {
            db.get(sql, [cedula], (err, row) => err ? reject(err) : resolve(row));
        });

        if (participante) {
            res.json({ success: true, data: participante });
        } else {
            res.json({ success: false, message: 'Cliente no encontrado.' });
        }
    } catch (error) {
        console.error("Error al buscar datos de participante:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// NUEVA RUTA: OBTENER NÚMEROS OCUPADOS PARA UN SORTEO DE TÓMBOLA
app.get('/api/numeros-ocupados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Obtenemos tanto los números ya confirmados (en `participaciones`) como los pendientes (en `pedidos`)
        const sql = `
            (SELECT numeros_elegidos FROM participaciones WHERE id_sorteo_config_fk = $1 AND numeros_elegidos IS NOT NULL)
            UNION
            (SELECT numeros_elegidos FROM pedidos WHERE id_sorteo_fk = $1 AND numeros_elegidos IS NOT NULL AND estado_pedido = 'pendiente');
        `;
        const result = await new Promise((resolve, reject) => {
            db.all(sql, [id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const numerosOcupados = result
            .filter(r => r.numeros_elegidos)
            .flatMap(r => JSON.parse(r.numeros_elegidos));
            
        res.json({ success: true, numerosOcupados });
    } catch (error) {
        console.error("Error al obtener números ocupados:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// NUEVA RUTA: OBTENER LISTA PÚBLICA PARA TÓMBOLA
app.get('/api/public-list/tombola/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `
            SELECT p.nombre, p.id_documento, p.numeros_elegidos, s.nombre_premio_display
            FROM participaciones p
            JOIN sorteos_config s ON p.id_sorteo_config_fk = s.id_sorteo
            WHERE p.id_sorteo_config_fk = $1 AND p.numeros_elegidos IS NOT NULL
            ORDER BY p.orden_id ASC;
        `;
        const result = await new Promise((resolve, reject) => {
            db.all(sql, [id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const listado = result.map(row => ({
            nombre: row.nombre,
            id_documento: row.id_documento, // <-- AÑADE ESTA LÍNEA
            numeros: JSON.parse(row.numeros_elegidos)
        }));

        const nombreSorteo = result.length > 0 ? result[0].nombre_premio_display : "Sorteo de Tómbola";
        
        res.json({ success: true, listado, nombreSorteo });
    } catch (error) {
        console.error("Error al obtener lista pública de tómbola:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});
app.get('/api/public-list/:sorteo_id', async (req, res) => {
    const { sorteo_id } = req.params;

    try {
        if (!dbClient) {
            throw new Error("La conexión a la base de datos no está disponible.");
        }
        const client = await dbClient.connect();
        try {
            const sql = `
                SELECT numero_boleto_sorteo, nombre, id_documento 
                FROM participaciones 
                WHERE id_sorteo_config_fk = $1 
                ORDER BY numero_boleto_sorteo ASC;
            `;
            const result = await client.query(sql, [sorteo_id]);

            // Esta es la parte clave: se crean las propiedades correctas que el frontend espera
            const publicList = result.rows.map(p => ({
                boleto: p.numero_boleto_sorteo,
                // Datos para MOSTRAR (formateados y anónimos)
                nombre_display: p.nombre ? `${p.nombre.trim().split(' ')[0]} ${p.nombre.trim().split(' ').pop().charAt(0)}.` : 'Participante',
                cedula_display: (p.id_documento && p.id_documento.length === 10) ? `${p.id_documento.substring(0, 2)}...${p.id_documento.substring(8)}` : 'ID Oculto',
                // Datos COMPLETOS para la búsqueda interna
                nombre_raw: p.nombre,
                cedula_raw: p.id_documento
            }));
            
            const sorteoInfoSql = "SELECT nombre_premio_display FROM sorteos_config WHERE id_sorteo = $1";
            const sorteoInfoResult = await client.query(sorteoInfoSql, [sorteo_id]);
            const sorteoNombre = sorteoInfoResult.rows.length > 0 ? sorteoInfoResult.rows[0].nombre_premio_display : "Sorteo";

            res.json({ success: true, listado: publicList, nombreSorteo: sorteoNombre });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error al obtener el listado público:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

app.get('/api/participantes', (req, res) => {
    const sorteoIdQuery = req.query.sorteoId;
    if (!sorteoIdQuery) {
        return res.json([]);
    }

    // 1. AÑADIMOS 'numero_boleto_sorteo' a la consulta SQL
    const sql = `
        SELECT orden_id, id_documento, nombre, numero_boleto_sorteo 
        FROM participaciones 
        WHERE id_sorteo_config_fk = $1 
        ORDER BY orden_id DESC
    `;
    
    db.all(sql, [sorteoIdQuery], (err, rows) => {
        if (err) {
            console.error("Error fetching public participants:", err.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }

        // 2. AÑADIMOS 'numero_boleto_sorteo' a la respuesta JSON que se envía al frontend
        const responseData = rows.map(row => ({
            orden_id: row.orden_id,
            name: row.nombre,
            id: row.id_documento,
            numero_boleto_sorteo: row.numero_boleto_sorteo 
        }));
        
        res.json(responseData);
    });
});

// CÓDIGO CORREGIDO
app.get('/api/participante-datos/:id_documento', (req, res) => {
    const { id_documento } = req.params;
    if (!id_documento || !/^\d{10}$/.test(id_documento)) {
        return res.status(400).json({ success: false, error: 'Cédula inválida.' });
    }
    // Corregimos la sintaxis de la consulta para PostgreSQL
    const sql = "SELECT nombre, ciudad, celular, email FROM datos_unicos_participantes WHERE id_documento = $1";
    
    db.get(sql, [id_documento], (err, row) => {
        if (err) {
            console.error("Error buscando datos de participante:", err.message);
            return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
        }
        if (row) {
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, error: 'Participante no encontrado.' });
        }
    });
});
app.get('/api/top-participantes', async (req, res) => {
    try {
        const sorteoIdQuery = req.query.sorteoId;
        if (!sorteoIdQuery) {
            return res.status(400).json({ error: 'Se requiere un ID de sorteo.' });
        }
        
        const limit = 5;
        const sql = `
            SELECT nombre, id_documento, COUNT(*) as total_participaciones 
            FROM participaciones 
            WHERE id_sorteo_config_fk = $1 
            GROUP BY id_documento, nombre 
            ORDER BY total_participaciones DESC, MIN(orden_id) ASC 
            LIMIT $2`;
        const params = [sorteoIdQuery, limit];

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(new Error("Error al consultar top participantes en la BD."));
                resolve(rows);
            });
        });

        res.json(rows.map(row => ({ 
            name: row.nombre, 
            id: row.id_documento, 
            total_participaciones: row.total_participaciones 
        })));

    } catch (error) {
        console.error("Error en GET /api/top-participantes:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.get('/api/ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error interno.' });
        else res.json(rows);
    });
});

app.get('/api/listable-raffles', async (req, res) => {
    try {
        const client = await dbClient.connect();
        try {
            // Obtenemos todos los sorteos que no estén en estado 'programado'
            const sql = `
                SELECT id_sorteo, nombre_premio_display, status_sorteo, tipo_sorteo 
                FROM sorteos_config 
                WHERE status_sorteo != 'programado'
                ORDER BY id_sorteo DESC;
            `;
            const result = await client.query(sql);
            res.json({ success: true, sorteos: result.rows });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error al obtener sorteos listables:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});
app.get('/api/ultimos-ganadores', (req, res) => {
    const sql = "SELECT nombre, ciudad, imagenUrl, premio, fecha FROM ganadores ORDER BY id DESC LIMIT 3";
    db.all(sql, [], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error interno.' });
        else res.json(rows);
    });
});

app.post('/api/login', loginLimiter, (req, res) => {
    // Tu código de login existente va aquí, no cambia nada.
    const { password } = req.body;
    bcrypt.compare(password, ADMIN_PASSWORD_HASH, (err, result) => {
        if (result) {
            req.session.isAdmin = true;
            res.json({ success: true, message: 'Login exitoso.' });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Sesión cerrada.' });
    });
});


// ===============================
// --- RUTAS DE ADMINISTRACIÓN ---
// ===============================

// CRUD de Sorteos
app.get('/api/admin/sorteos', requireAdminLogin, (req, res) => {
    const sql = `SELECT s.*, (SELECT COUNT(*) FROM participaciones p WHERE p.id_sorteo_config_fk = s.id_sorteo) as participantes_actuales FROM sorteos_config s ORDER BY s.id_sorteo DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching admin-sorteos:", err.message);
            return res.status(500).json({ error: "Error al obtener sorteos." });
        }
        // Convertimos el string JSON de vuelta a un objeto antes de enviarlo
        const sorteosProcesados = rows.map(sorteo => {
            try {
                sorteo.paquetes_json = JSON.parse(sorteo.paquetes_json);
            } catch (e) {
                sorteo.paquetes_json = []; // Si hay un error o está vacío, envía un array vacío
            }
            return sorteo;
        });
        res.json(sorteosProcesados);
    });
});
// En server.js, AÑADE esta nueva ruta

// RUTA PARA ELIMINAR UN PEDIDO PENDIENTE
app.delete('/api/admin/pedidos/:pedido_id', requireAdminLogin, async (req, res) => {
    try {
        const { pedido_id } = req.params;
        const sql = "DELETE FROM pedidos WHERE id_pedido = $1 AND estado_pedido = 'pendiente'";
        
        const result = await new Promise((resolve, reject) => {
            db.run(sql, [pedido_id], function(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: "Pedido no encontrado o ya estaba completado." });
        }
        res.json({ success: true, message: `Pedido #${pedido_id} eliminado exitosamente.` });

    } catch (error) {
        console.error("Error al eliminar pedido:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});
// 1. RUTA PARA OBTENER TODOS LOS PEDIDOS PENDIENTES
app.get('/api/admin/pedidos', requireAdminLogin, async (req, res) => {
    try {
        const client = await dbClient.connect();
        try {
            const sql = "SELECT * FROM pedidos WHERE estado_pedido = 'pendiente' ORDER BY fecha_pedido ASC";
            const result = await client.query(sql);
            res.json(result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error al obtener pedidos pendientes:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});




// REEMPLAZA LA FUNCIÓN COMPLETA EN server.js

app.post('/api/admin/confirmar-pedido', requireAdminLogin, async (req, res) => {
    const { pedido_id } = req.body;
    if (!pedido_id) {
        return res.status(400).json({ error: "Falta el ID del pedido." });
    }

    const client = await dbClient.connect();
    try {
        await client.query('BEGIN');

        // --- 1. OBTENER DATOS (Sin cambios) ---
        const pedidoSql = "SELECT * FROM pedidos WHERE id_pedido = $1 AND estado_pedido = 'pendiente'";
        const pedidoResult = await client.query(pedidoSql, [pedido_id]);
        if (pedidoResult.rows.length === 0) throw new Error("Pedido no encontrado o ya procesado.");
        const pedido = pedidoResult.rows[0];

        const sorteoSql = "SELECT * FROM sorteos_config WHERE id_sorteo = $1";
        const sorteoResult = await client.query(sorteoSql, [pedido.id_sorteo_fk]);
        const sorteoInfo = sorteoResult.rows[0];
        if (!sorteoInfo) throw new Error("El sorteo asociado no existe.");

        let nombreAfiliado = null;
        if (pedido.id_afiliado_fk) {
            const afiliadoSql = "SELECT nombre_completo FROM afiliados WHERE id_afiliado = $1";
            const afiliadoResult = await client.query(afiliadoSql, [pedido.id_afiliado_fk]);
            if (afiliadoResult.rows.length > 0) {
                nombreAfiliado = afiliadoResult.rows[0].nombre_completo;
            }
        }
        
        // --- 2. LÓGICA PARA ASIGNAR BOLETOS (Sin cambios) ---
        const numerosElegidos = pedido.numeros_elegidos ? JSON.parse(pedido.numeros_elegidos) : null;
        let cantidad_a_anadir = 1;
        if (numerosElegidos && Array.isArray(numerosElegidos)) {
            cantidad_a_anadir = numerosElegidos.length;
        } else {
             const matches = pedido.paquete_elegido.match(/\((\d+)\s*x/);
             cantidad_a_anadir = matches ? parseInt(matches[1], 10) : 1;
        }

        const maxTicketSql = 'SELECT MAX(numero_boleto_sorteo) as max_num FROM participaciones WHERE id_sorteo_config_fk = $1';
        const maxTicketRes = await client.query(maxTicketSql, [pedido.id_sorteo_fk]);
        let nextTicketNumber = (maxTicketRes.rows[0].max_num || 0) + 1;
        
        const sqlInsert = `INSERT INTO participaciones (id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, id_sorteo_config_fk, numero_boleto_sorteo, numeros_elegidos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING numero_boleto_sorteo;`;
        const nuevosBoletosNumeros = [];
        for (let i = 0; i < cantidad_a_anadir; i++) {
            const numerosParaEsteBoleto = numerosElegidos ? JSON.stringify([numerosElegidos[i]]) : null;
            const params = [pedido.cedula_cliente, pedido.nombre_cliente, pedido.ciudad_cliente, pedido.celular_cliente, pedido.email_cliente, pedido.paquete_elegido, nombreAfiliado, pedido.id_sorteo_fk, nextTicketNumber, numerosParaEsteBoleto];
            const result = await client.query(sqlInsert, params);
            nuevosBoletosNumeros.push(result.rows[0].numero_boleto_sorteo);
            nextTicketNumber++;
        }

        // --- 3. ACTUALIZAR ESTADO DEL PEDIDO (Sin cambios) ---
        await client.query("UPDATE pedidos SET estado_pedido = 'completado' WHERE id_pedido = $1", [pedido_id]);

        // =================================================================
        // --- 4. PREPARAR Y ENVIAR NOTIFICACIONES (SECCIÓN MEJORADA) ---
        // =================================================================

        let mensajeWhatsApp = '';
        let contenidoEmailHTML = '';

        if (sorteoInfo.tipo_sorteo === 'tombola_interactiva' && numerosElegidos) {
            // --- Mensajes para Sorteo de Tómbola ---
            const combinacionesTexto = numerosElegidos.map(combo => `[${combo.join('-')}]`).join(', ');
            mensajeWhatsApp = `¡Hola, ${pedido.nombre_cliente}! Tu pago ha sido confirmado para el sorteo del *${sorteoInfo.nombre_premio_display}*. Tus combinaciones de la suerte son: *${combinacionesTexto}*. ¡Mucha suerte de parte del equipo de Movil Win!`;

            const bolasHTML = numerosElegidos.map(combo => {
                const bolasIndividuales = combo.map(n => `<div style="display: inline-block; width: 45px; height: 45px; line-height: 45px; border-radius: 50%; background-color: #f0e6d2; border: 2px solid #b3a07d; text-align: center; font-size: 1.5em; font-weight: bold; color: #4a3f35; margin: 5px;">${n}</div>`).join('');
                return `<div style="margin-bottom: 10px;">${bolasIndividuales}</div>`;
            }).join('');
            contenidoEmailHTML = `<p>Estas son tus combinaciones de la suerte registradas:</p><div style="padding: 15px; background-color: #f7f7f7; border-radius: 8px; text-align: center;">${bolasHTML}</div>`;

        } else {
            // --- Mensajes para Sorteo de Ruleta (Clásico) ---
            const boletosTexto = nuevosBoletosNumeros.join(', ');
            mensajeWhatsApp = `¡Hola, ${pedido.nombre_cliente}! Tu pago ha sido confirmado para el sorteo del *${sorteoInfo.nombre_premio_display}*. Tus números de boleto son: *${boletosTexto}*. ¡Mucha suerte de parte del equipo de Movil Win!`;
            
            contenidoEmailHTML = `<p>Para tu referencia, tus números de boleto asignados son:</p><ul style="padding-left: 20px; font-size: 1.1em;">${nuevosBoletosNumeros.map(id => `<li style="margin-bottom: 5px;">Boleto <strong>#${id}</strong></li>`).join('')}</ul>`;
        }

        // Construir el link de WhatsApp
        let linkWhatsApp = null;
        if (pedido.celular_cliente) {
            let numeroFormateado = String(pedido.celular_cliente).trim().replace(/\D/g, '').replace(/^0+/, '');
            if(numeroFormateado.length === 9) numeroFormateado = `593${numeroFormateado}`;
            linkWhatsApp = `https://wa.me/${numeroFormateado}?text=${encodeURIComponent(mensajeWhatsApp)}`;
        }

        // Enviar el correo electrónico
        if (pedido.email_cliente && transporter) {
            const mailOptions = {
                from: `"Movil Win" <${process.env.EMAIL_USER}>`,
                to: pedido.email_cliente,
                subject: `✅ ¡Confirmación de tu participación en el sorteo ${sorteoInfo.nombre_premio_display}!`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo_movilwin" alt="MOVIL WIN Logo" style="max-width: 150px; height: auto;">
                        </div>
                        <h2 style="color: #7f5af0; text-align: center;">¡Hola, ${pedido.nombre_cliente}!</h2>
                        <p>Tu pago ha sido confirmado y tu participación para el sorteo del <strong>${sorteoInfo.nombre_premio_display}</strong> ya está registrada.</p>
                        ${contenidoEmailHTML}
                        <p>Te deseamos muchísima suerte. Recuerda seguirnos en nuestras redes para estar al tanto de todo.</p>
                        <p style="text-align: center; font-size: 0.9em; color: #777; margin-top: 30px;">Atentamente,<br>El equipo de MOVIL WIN</p>
                        <div class="social-links-footer">
                            <a href="https://wa.me/593964135891" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i></a>
                            <a href="https://www.facebook.com/profile.php?id=61576682273505" target="_blank" rel="noopener noreferrer"><i class="fab fa-facebook-f"></i></a>
                            <a href="https://www.instagram.com/movilwin" target="_blank" rel="noopener noreferrer"><i class="fab fa-instagram"></i></a>
                        </div>
                        </div>`,
                attachments: [{ filename: 'logo.png', path: path.join(__dirname, 'images', 'logo.png'), cid: 'logo_movilwin' }]
            };
            transporter.sendMail(mailOptions).catch(emailError => console.error("⚠️ ERROR EN TAREA DE EMAIL:", emailError));
        }
        
        // --- 5. FINALIZAR TRANSACCIÓN Y RESPONDER ---
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Pedido #${pedido_id} confirmado. Boletos asignados: ${nuevosBoletosNumeros.join(', ')}`,
            whatsappLink: linkWhatsApp
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al confirmar el pedido:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});
app.post('/api/admin/start-countdown', requireAdminLogin, async (req, res) => {
    try {
        const { sorteo_id } = req.body;
        if (!sorteo_id) {
            return res.status(400).json({ error: "Falta el ID del sorteo." });
        }

        // Definimos la duración en milisegundos (1 hora)
        //const UNA_HORA_EN_MS = 60 * 60 * 1000;
        const VEINTE_SEGUNDOS_EN_MS = 20 * 1000;

        //const endTime = new Date().getTime() + UNA_HORA_EN_MS;
        const endTime = new Date().getTime() + VEINTE_SEGUNDOS_EN_MS;


        const sql = `UPDATE sorteos_config SET status_sorteo = 'countdown', countdown_end_time = $1 WHERE id_sorteo = $2`;
        const params = [endTime, sorteo_id];

        // Usamos el patrón de Promesa que es más seguro para operaciones asíncronas
        const result = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(err);
                // 'this' contiene información sobre la operación, como el número de filas cambiadas
                resolve(this);
            });
        });

        // Verificamos si realmente se actualizó un sorteo
        if (result.changes === 0) {
            return res.status(404).json({ error: "Sorteo no encontrado para iniciar el conteo." });
        }

        res.json({ success: true, message: "Cuenta regresiva iniciada." });

    } catch (error) {
        // Capturamos cualquier error que ocurra durante el proceso
        console.error("Error al iniciar la cuenta regresiva:", error);
        res.status(500).json({ error: "Error en la base de datos al iniciar la cuenta regresiva." });
    }
});

// En server.js, reemplaza esta ruta completa

app.get('/api/countdown-status', async (req, res) => {
    const client = await dbClient.connect();
    try {
        const countdownSql = `SELECT id_sorteo, countdown_end_time FROM sorteos_config WHERE status_sorteo = 'countdown' LIMIT 1`;
        const countdownRes = await client.query(countdownSql);

        if (countdownRes.rows.length > 0) {
            const sorteo = countdownRes.rows[0];
            if (sorteo.countdown_end_time > new Date().getTime()) {
                return res.json({ isActive: true, mode: 'countdown', endTime: sorteo.countdown_end_time, sorteoId: sorteo.id_sorteo });
            }
        }
        
        // --- INICIO DE LA CORRECCIÓN ---
        // Se cambió "ORDER BY g.id_ganador" por "ORDER BY g.id"
        const winnerSql = `SELECT g.nombre, s.nombre_premio_display, g.numero_boleto_ganador FROM ganadores g JOIN sorteos_config s ON g.id_sorteo_config_fk = s.id_sorteo WHERE s.status_sorteo = 'finalizado' ORDER BY g.id DESC LIMIT 1`;

        // --- FIN DE LA CORRECCIÓN ---
        
        const winnerRes = await client.query(winnerSql);
        
        if (winnerRes.rows.length > 0) {
            return res.json({ isActive: true, mode: 'winner', ganador: winnerRes.rows[0] });
        }

        res.json({ isActive: false });

    } catch(error) {
        console.error("Error en /api/countdown-status:", error);
        res.status(500).json({ error: "Error en la base de datos." });
    } finally {
        client.release();
    }
});
app.post('/api/admin/sorteos', requireAdminLogin, async (req, res) => {
    try {
        const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, tipo_sorteo, configuracion_tombola } = req.body;

        if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
            return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
        }

        const paquetesString = JSON.stringify([]); // Los paquetes se añaden al editar
        const configTombolaString = tipo_sorteo === 'tombola_interactiva' ? JSON.stringify(configuracion_tombola) : null;

        const sql = `INSERT INTO sorteos_config (nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, tipo_sorteo, configuracion_tombola, paquetes_json) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_sorteo`;
        const params = [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, tipo_sorteo, configTombolaString, paquetesString];

        const result = await new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });

        res.status(201).json({ message: "Sorteo añadido con éxito. Ahora puedes editarlo para añadir paquetes.", id_sorteo: result.id_sorteo });
    } catch (error) {
        console.error("Error al añadir sorteo:", error);
        res.status(500).json({ error: "Error en la base de datos al añadir el sorteo." });
    }
});


app.put('/api/admin/sorteos/:id_sorteo', requireAdminLogin, async (req, res) => {
    try {
        const { id_sorteo } = req.params;
        const { nombre_premio_display, imagen_url, nombre_base_archivo_guia, meta_participaciones, paquetes_json, tipo_sorteo, configuracion_tombola } = req.body;

        if (!nombre_premio_display || !nombre_base_archivo_guia || !meta_participaciones) {
            return res.status(400).json({ error: "Nombre, guía y meta son requeridos." });
        }
        
        const paquetesString = JSON.stringify(paquetes_json || []);
        const configTombolaString = tipo_sorteo === 'tombola_interactiva' ? JSON.stringify(configuracion_tombola) : null;

        const sql = `
            UPDATE sorteos_config 
            SET 
                nombre_premio_display = $1, 
                imagen_url = $2, 
                nombre_base_archivo_guia = $3, 
                meta_participaciones = $4, 
                paquetes_json = $5,
                tipo_sorteo = $6,
                configuracion_tombola = $7
            WHERE id_sorteo = $8
        `;
        const params = [nombre_premio_display, imagen_url, nombre_base_archivo_guia, parseInt(meta_participaciones) || 200, paquetesString, tipo_sorteo, configTombolaString, id_sorteo];

        const result = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: "Sorteo no encontrado para actualizar." });
        }
        
        res.json({ message: "Sorteo actualizado exitosamente." });

    } catch (error) {
        console.error(`Error en PUT /api/admin/sorteos/${req.params.id_sorteo}:`, error);
        res.status(500).json({ error: "Error interno al editar el sorteo." });
    }
});


app.put('/api/admin/sorteos/activar/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const { activar } = req.body; // Esto será 'true' si se presiona "Activar" o 'false' si es "Desactivar"

    // Determinamos cuál será el nuevo estado basado en la acción
    const nuevoStatus = activar ? 'activo' : 'programado';

    const sql = "UPDATE sorteos_config SET status_sorteo = $1 WHERE id_sorteo = $2";

    // Ejecutamos una única y simple actualización a la base de datos
    db.run(sql, [nuevoStatus, id_sorteo], function(err) {
        if (err) {
            console.error("Error actualizando el estado del sorteo:", err.message);
            return res.status(500).json({ error: "Error interno del servidor." });
        }
        // Verificamos si se actualizó alguna fila
        if (this.changes === 0) {
             return res.status(404).json({ error: "Sorteo no encontrado." });
        }
        
        // Enviamos una respuesta de éxito
        res.json({ message: `El estado del Sorteo ID ${id_sorteo} se ha cambiado a '${nuevoStatus}'.` });
    });
});

// En server.js, reemplaza la ruta completa por esta:

app.post('/api/admin/sorteos/finalizar', requireAdminLogin, (req, res) => {
    const { sorteo_id } = req.body;
    if (!sorteo_id) {
        return res.status(400).json({ error: "No se proporcionó un ID de sorteo." });
    }

    // Se corrige el placeholder de '?' a '$1' para que sea compatible con PostgreSQL
    const sql = "UPDATE sorteos_config SET status_sorteo = 'completado' WHERE id_sorteo = $1";
    
    db.run(sql, [sorteo_id], function(err) {
        if (err) {
            console.error("Error al finalizar el sorteo:", err);
            return res.status(500).json({ error: 'Error en la base de datos al finalizar el sorteo.' });
        }
        
        // Añadimos una verificación para saber si realmente se actualizó una fila
        if (this.changes === 0) {
            return res.status(404).json({ error: "Sorteo no encontrado para finalizar." });
        }
        
        res.json({ success: true, message: `Sorteo ID ${sorteo_id} finalizado.` });
    });
});
// En server.js, AÑADE esta nueva ruta

// RUTA PARA ELIMINAR UN SORTEO (Y SUS PARTICIPACIONES ASOCIADAS)
app.delete('/api/admin/sorteos/:id_sorteo', requireAdminLogin, async (req, res) => {
    const { id_sorteo } = req.params;
    if (!id_sorteo) {
        return res.status(400).json({ error: "No se proporcionó un ID de sorteo." });
    }

    const client = await dbClient.connect();

    try {
        // --- INICIO DE LA TRANSACCIÓN SEGURA ---
        await client.query('BEGIN');

        // Paso 1: Eliminar todas las participaciones asociadas a este sorteo.
        // Esto es crucial para mantener la integridad de la base de datos.
        const deleteParticipationsSql = `DELETE FROM participaciones WHERE id_sorteo_config_fk = $1`;
        await client.query(deleteParticipationsSql, [id_sorteo]);

        // Paso 2: Eliminar el sorteo principal de la tabla de configuración.
        const deleteSorteoSql = `DELETE FROM sorteos_config WHERE id_sorteo = $1`;
        const result = await client.query(deleteSorteoSql, [id_sorteo]);

        // Si no se eliminó ninguna fila, significa que el sorteo no existía.
        if (result.rowCount === 0) {
            throw new Error("Sorteo no encontrado para eliminar.");
        }

        // Paso 3: Si todo fue bien, confirma la transacción.
        await client.query('COMMIT');
        // --- FIN DE LA TRANSACCIÓN ---

        res.json({ success: true, message: `Sorteo ID ${id_sorteo} y todas sus participaciones han sido eliminados.` });

    } catch (error) {
        // Si algo falla, revierte todos los cambios.
        await client.query('ROLLBACK');
        console.error("Error al eliminar el sorteo:", error);
        res.status(500).json({ error: 'Error en la base de datos al eliminar el sorteo.', message: error.message });
    } finally {
        // Libera la conexión a la base de datos.
        client.release();
    }
});


// ===============================
// --- RUTAS DE GESTIÓN DE AFILIADOS ---
// ===============================

// OBTENER TODOS LOS AFILIADOS
// En server.js, reemplaza tu ruta GET /api/admin/afiliados completa por esta:

// En server.js, reemplaza tu ruta GET /api/admin/afiliados completa por esta:

app.get('/api/admin/afiliados', requireAdminLogin, async (req, res) => {
    try {
        if (!dbClient) {
            throw new Error("La conexión a la base de datos no está disponible.");
        }
        const client = await dbClient.connect();
        try {
            // --- INICIO DE LA CORRECCIÓN ---
            // Se han corregido los nombres de las columnas:
            // a.nombre_afiliado -> a.nombre_completo
            // a.celular_afiliado -> a.telefono
            // El JOIN ahora usa a.nombre_completo = p.nombre_afiliado
            const sql = `
                SELECT 
                    a.id_afiliado,
                    a.nombre_completo,
                    a.telefono,
                    a.estado,
                    a.fecha_registro,
                    COUNT(p.orden_id) AS boletos_totales,
                    SUM(CASE WHEN s.status_sorteo = 'activo' THEN 1 ELSE 0 END) AS boletos_sorteo_activo
                FROM 
                    afiliados a
                LEFT JOIN 
                    participaciones p ON a.nombre_completo = p.nombre_afiliado
                LEFT JOIN
                    sorteos_config s ON p.id_sorteo_config_fk = s.id_sorteo
                GROUP BY
                    a.id_afiliado
                ORDER BY
                    a.nombre_completo;
            `;
            // --- FIN DE LA CORRECCIÓN ---

            const result = await client.query(sql);
            
            // Adaptamos la respuesta para que el frontend siga funcionando sin cambios
            const afiliadosProcesados = result.rows.map(af => ({
                ...af,
                nombre_afiliado: af.nombre_completo, // Mantenemos el nombre de la propiedad para el frontend
                celular_afiliado: af.telefono
            }));
            
            res.json(afiliadosProcesados);

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error al obtener la lista de afiliados con estadísticas:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});
// En server.js, AÑADE esta nueva ruta

// RUTA PARA ACTUALIZAR EL ESTADO DE UN AFILIADO (activo/inactivo)
app.put('/api/admin/afiliados/:id_afiliado/estado', requireAdminLogin, async (req, res) => {
    try {
        const { id_afiliado } = req.params;
        const { estado } = req.body; // Recibirá 'activo' o 'inactivo'

        if (!estado || !['activo', 'inactivo'].includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido.' });
        }

        const sql = `UPDATE afiliados SET estado = $1 WHERE id_afiliado = $2`;
        const result = await new Promise((resolve, reject) => {
            db.run(sql, [estado, id_afiliado], function(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: "Afiliado no encontrado." });
        }
        res.json({ success: true, message: `El estado del afiliado ha sido actualizado a '${estado}'.` });

    } catch (error) {
        console.error("Error al cambiar estado de afiliado:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});
// En server.js, AÑADE esta nueva ruta

// RUTA PARA EDITAR LOS DATOS DE UN AFILIADO
app.put('/api/admin/afiliados/:id_afiliado', requireAdminLogin, async (req, res) => {
    try {
        const { id_afiliado } = req.params;
        const { nombre_completo, telefono } = req.body;

        if (!nombre_completo) {
            return res.status(400).json({ error: 'El nombre completo es requerido.' });
        }

        const sql = `UPDATE afiliados SET nombre_completo = $1, telefono = $2 WHERE id_afiliado = $3`;
        const result = await new Promise((resolve, reject) => {
            db.run(sql, [nombre_completo, telefono, id_afiliado], function(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: "Afiliado no encontrado." });
        }
        res.json({ success: true, message: 'Afiliado actualizado con éxito.' });
    } catch (error) {
        console.error("Error al editar afiliado:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});
// En server.js, AÑADE esta nueva ruta

app.get('/api/admin/reporte-comisiones', requireAdminLogin, async (req, res) => {
    const { sorteo_id } = req.query;
    if (!sorteo_id) {
        return res.status(400).json({ error: "Se requiere un ID de sorteo." });
    }

    try {
        const client = await dbClient.connect();
        try {
            const sql = `
                SELECT 
                    p.nombre_afiliado, 
                    COUNT(p.orden_id) as total_boletos
                FROM 
                    participaciones p
                WHERE 
                    p.id_sorteo_config_fk = $1 AND p.nombre_afiliado IS NOT NULL AND p.nombre_afiliado != ''
                GROUP BY 
                    p.nombre_afiliado
                ORDER BY 
                    total_boletos DESC;
            `;
            const result = await client.query(sql, [sorteo_id]);
            res.json({ success: true, reporte: result.rows });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error generando reporte de comisiones:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor." });
    }
});
app.get('/api/global-stats', async (req, res) => {
    try {
        const client = await dbClient.connect();
        try {
            // Ejecutamos todas las consultas en paralelo para máxima eficiencia
            const [
                sorteosData,
                boletosData,
                participantesData,
                afiliadosData
            ] = await Promise.all([
                client.query("SELECT COUNT(*) FROM sorteos_config WHERE status_sorteo = 'completado'"),
                client.query("SELECT COUNT(*) FROM participaciones"),
                client.query("SELECT COUNT(DISTINCT id_documento) FROM participaciones"),
                client.query("SELECT COUNT(*) FROM afiliados")
            ]);

            // Construimos el objeto de respuesta
            const stats = {
                sorteosRealizados: parseInt(sorteosData.rows[0].count, 10),
                totalBoletos: parseInt(boletosData.rows[0].count, 10),
                totalParticipantes: parseInt(participantesData.rows[0].count, 10),
                totalAfiliados: parseInt(afiliadosData.rows[0].count, 10)
            };

            res.json({ success: true, stats: stats });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error obteniendo estadísticas globales:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// AÑADIR UN NUEVO AFILIADO
app.post('/api/admin/afiliados', requireAdminLogin, async (req, res) => {
    try {
        const { nombre_completo, telefono } = req.body;
        if (!nombre_completo) {
            return res.status(400).json({ error: "El nombre completo es requerido." });
        }

        // En PostgreSQL, se usa RETURNING para obtener el ID del nuevo registro.
        const sql = "INSERT INTO afiliados (nombre_completo, telefono) VALUES ($1, $2) RETURNING id_afiliado";
        const params = [nombre_completo.trim(), telefono];

        const result = await new Promise((resolve, reject) => {
            // Usamos db.get para poder recibir la fila devuelta por RETURNING
            db.get(sql, params, function(err, row) {
                if (err) return reject(err);
                resolve(row);
            });
        });

        res.status(201).json({ message: "Afiliado añadido con éxito.", id: result.id_afiliado });

    } catch (error) {
        // El código de error para una violación de restricción 'UNIQUE' en PostgreSQL es '23505'
        if (error.code === '23505') {
            return res.status(409).json({ error: `El afiliado '${req.body.nombre_completo}' ya existe.` });
        }
        console.error("Error en POST /api/admin/afiliados:", error);
        res.status(500).json({ error: "Error al guardar el afiliado." });
    }
});
// CRUD de Participantes
app.get('/api/admin/participantes-activos', requireAdminLogin, (req, res) => {
    const sql = `
        SELECT p.orden_id, p.id_documento, p.nombre, p.ciudad, p.paquete_elegido, p.id_sorteo_config_fk as sorteo_id 
        FROM participaciones p
        JOIN sorteos_config s ON p.id_sorteo_config_fk = s.id_sorteo 
        WHERE s.status_sorteo = 'activo' 
        ORDER BY p.orden_id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching active participants:", err.message);
            return res.status(500).json({ error: 'Error interno.' });
        }
        res.json(rows);
    });
});

// **RUTA POST PARTICIPANTES CON LÓGICA DE EMAIL/WHATSAPP**
app.post('/api/admin/participantes', requireAdminLogin, async (req, res) => {
    const { id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, quantity, sorteo_id } = req.body;
    if (!id_documento || !nombre || !sorteo_id || !quantity) return res.status(400).json({ error: 'Datos incompletos' });
    
    const cantidad_a_anadir = parseInt(quantity, 10);
    const client = await dbClient.connect();

    try {
        // 1. OBTENEMOS LA INFORMACIÓN DEL SORTEO Y VALIDAMOS
        const sorteoInfoSql = `SELECT *, (SELECT COUNT(*) FROM participaciones WHERE id_sorteo_config_fk = $1) as participantes_actuales FROM sorteos_config WHERE id_sorteo = $1`;
        const sorteoRes = await client.query(sorteoInfoSql, [sorteo_id]);
        const sorteoInfo = sorteoRes.rows[0];

        if (!sorteoInfo) {
            throw new Error("El sorteo seleccionado no existe.");
        }
        if (!sorteoInfo.nombre_base_archivo_guia) {
            throw new Error(`El sorteo '${sorteoInfo.nombre_premio_display}' no tiene un 'Nombre Base Archivo Guía' configurado.`);
        }

        const meta_participaciones = parseInt(sorteoInfo.meta_participaciones, 10);
        const participantes_actuales = parseInt(sorteoInfo.participantes_actuales, 10);
        if ((participantes_actuales + cantidad_a_anadir) > meta_participaciones) {
            const boletosRestantes = meta_participaciones - participantes_actuales;
            return res.status(409).json({
                error: "Cupo excedido",
                message: `No se pueden añadir ${cantidad_a_anadir} boletos. Solo quedan ${boletosRestantes} cupos disponibles.`
            });
        }

        // 2. INICIAMOS LA TRANSACCIÓN EN LA BASE DE DATOS
        await client.query('BEGIN');
        
        const sqlUpsertUnico = `INSERT INTO datos_unicos_participantes (id_documento, nombre, ciudad, celular, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id_documento) DO UPDATE SET nombre = EXCLUDED.nombre, ciudad = EXCLUDED.ciudad, celular = EXCLUDED.celular, email = EXCLUDED.email;`;
        await client.query(sqlUpsertUnico, [id_documento, nombre, ciudad, celular, email]);
        
        const maxTicketSql = 'SELECT MAX(numero_boleto_sorteo) as max_num FROM participaciones WHERE id_sorteo_config_fk = $1';
        const maxTicketRes = await client.query(maxTicketSql, [sorteo_id]);
        let nextTicketNumber = (maxTicketRes.rows[0].max_num || 0) + 1;

        const sqlInsertParticipacion = `INSERT INTO participaciones (id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, id_sorteo_config_fk, numero_boleto_sorteo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING numero_boleto_sorteo;`;
        
        const nuevosBoletosNumeros = []; // <--- Se define la variable correcta
        for (let i = 0; i < cantidad_a_anadir; i++) {
            const params = [id_documento, nombre, ciudad, celular, email, paquete_elegido, nombre_afiliado, sorteo_id, nextTicketNumber];
            const result = await client.query(sqlInsertParticipacion, params);
            nuevosBoletosNumeros.push(result.rows[0].numero_boleto_sorteo);
            nextTicketNumber++;
        }
        
        // 3. CONFIRMAMOS LA TRANSACCIÓN
        await client.query('COMMIT');
        
        // 4. PREPARAMOS Y ENVIAMOS LAS NOTIFICACIONES
        const boletosTexto = `Tus números de boleto son: ${nuevosBoletosNumeros.join(', ')}.`;
        
        // 4. PREPARAMOS Y ENVIAMOS LAS NOTIFICACIONES
        
        let linkWhatsApp = null;
        if (celular) {
            let numeroFormateado = String(celular).trim().replace(/\D/g, '');
            if (numeroFormateado.length === 10 && numeroFormateado.startsWith('0')) {
                numeroFormateado = `593${numeroFormateado.substring(1)}`;
            }
            const boletosTexto = `Tus números de boleto son: ${nuevosBoletosNumeros.join(', ')}.`;
            const mensajeWhatsApp = `¡Hola, ${nombre}! Gracias por tu compra para el sorteo del ${sorteoInfo.nombre_premio_display}. Ya puedes ver tus boletos en la lista pública de nuestra web: https://movilwin.com ${boletosTexto} ¡No olvides seguirnos en nuestras redes sociales para enterarte de nuestros próximos premios, mucha suerte!`;
            linkWhatsApp = `https://wa.me/${numeroFormateado}?text=${encodeURIComponent(mensajeWhatsApp)}`;
        }
        // 1. Envío de Correo Electrónico (si aplica)
        if (email && transporter) {
            const nombreArchivoGuia = `MiniGuia_${sorteoInfo.nombre_base_archivo_guia.replace(/\s+/g, '_')}.pdf`;
            const rutaGuia = path.join(__dirname, 'guias', nombreArchivoGuia);
            const boletosTextoEmail = `<p>Para tu referencia, tus números de boleto asignados son:</p><ul style="padding-left: 20px;">${nuevosBoletosNumeros.map(id => `<li style="margin-bottom: 5px;">Boleto #${id}</li>`).join('')}</ul>`;
            const mailOptions = {
                from: `"MOVIL WIN" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: `✅ Confirmación de tu participación en el sorteo ${sorteoInfo.nombre_premio_display}`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo_movilwin" alt="MOVIL WIN Logo" style="max-width: 150px; height: auto;">
                        </div>
                        <h2 style="color: #7f5af0; text-align: center;">¡Hola, ${nombre}!</h2>
                        <p>¡Gracias por adquirir tu Mini-Guía y obtener <strong>${quantity} boleto(s) digital(es)</strong>.</p>${boletosTextoEmail} para el sorteo del <strong>${sorteoInfo.nombre_premio_display}</strong> en MOVIL WIN!</p>
                        <p>Estamos emocionados de tenerte a bordo. Tu Mini-Guía "${nombreArchivoGuia}" está adjunta a este correo.</p>
                        <p>Recuerda seguirnos en nuestras redes para estar al tanto de todas las novedades y próximos sorteos:</p>
                        <p style="text-align: center; margin: 20px 0;">
                            <a href="https://www.facebook.com/profile.php?id=61576682273505" style="color: #ffffff; background-color: #1877F2; padding: 10px 15px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Facebook</a>
                            <a href="https://www.instagram.com/movilwin" style="color: #ffffff; background-color: #E4405F; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Instagram</a>
                        </p>
                        <p style="text-align: center; margin-top: 25px;">
                            <a href="https://wa.me/593963135510?text=Hola%20MOVIL%20WIN%21%20Quisiera%20adquirir%20m%C3%A1s%20boletos%20digitales." target="_blank" style="display: inline-block; background-color: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png" alt="WhatsApp" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;">¡Comprar Más Boletos Digitales!
                            </a>
                        </p>
                        <p style="text-align: center; margin-top: 20px;">¡Mucha suerte en el sorteo!</p>
                        <p style="text-align: center; font-size: 0.9em; color: #777;">Atentamente,<br>El equipo de MOVIL WIN</p>
                        <p style="text-align: center; font-size: 0.9em; color: #777;">
                            Recuerda revisar nuestras 
                            <a href="https://movilwin.com/bases.html" style="color: #7f5af0; text-decoration: underline;" target="_blank">
                                Bases y Condiciones
                            </a>
                        </p>
                    </div>
                `,
                attachments: [{ filename: 'logo.png', path: path.join(__dirname, 'images', 'logo.png'), cid: 'logo_movilwin' }]
            };
            if (fs.existsSync(rutaGuia)) mailOptions.attachments.push({ filename: nombreArchivoGuia, path: rutaGuia });
            transporter.sendMail(mailOptions).catch(emailError => console.error("⚠️ ERROR EN TAREA DE EMAIL:", emailError));
        }
        
        // 5. ENVIAMOS LA RESPUESTA DE ÉXITO AL FRONTEND CON TODOS LOS DATOS
        res.status(201).json({ 
            message: `¡${cantidad_a_anadir} boleto(s) añadido(s) con éxito!`, 
            boletos: nuevosBoletosNumeros,
            whatsappLink: linkWhatsApp // Se incluye el enlace para el botón
        });
        // --- FIN DEL CÓDIGO RESTAURADO ---

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en transacción al añadir participante:", error);
        res.status(500).json({ error: "Error en la base de datos", message: error.message });
    } finally {
        client.release();
    }
});


app.delete('/api/admin/participaciones/:orden_id', requireAdminLogin, async (req, res) => {
    try {
        const { orden_id } = req.params;
        const ordenIdNum = parseInt(orden_id, 10);
        if (isNaN(ordenIdNum)) {
            return res.status(400).json({ error: 'ID de orden inválido.' });
        }
        
        const sql = "DELETE FROM participaciones WHERE orden_id = $1";
        const params = [ordenIdNum];

        const result = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(new Error("Error al eliminar participación de la BD."));
                resolve(this); // 'this' contiene .changes
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: `Participación ${ordenIdNum} no encontrada.` });
        }
        res.json({ message: `Participación (Orden ID: ${ordenIdNum}) eliminada.` });

    } catch (error) {
        console.error(`Error en DELETE /api/admin/participaciones/${req.params.orden_id}:`, error);
        res.status(500).json({ error: "Error interno al eliminar la participación." });
    }
});
// Otras rutas de admin

// REEMPLAZA TU RUTA EXISTENTE CON ESTA VERSIÓN FINAL Y COMPLETA
// En server.js, reemplaza tu ruta GET /api/admin/dashboard-avanzado completa por esta:

app.get('/api/admin/dashboard-avanzado', requireAdminLogin, async (req, res) => {
    try {
        const client = await dbClient.connect();
        try {
            const stats = {};

            // --- INICIO DE LA NUEVA LÓGICA DE CÁLCULO DE INGRESOS ---

            // 1. Obtenemos todos los sorteos con sus configuraciones de paquetes
            const sorteosResult = await client.query("SELECT id_sorteo, paquetes_json FROM sorteos_config");
            const priceData = {}; // Aquí construiremos nuestro mapa de precios dinámico
            
            sorteosResult.rows.forEach(s => {
                priceData[s.id_sorteo] = {};
                try {
                    const paquetes = JSON.parse(s.paquetes_json);
                    if (paquetes && paquetes.length > 0) {
                        paquetes.forEach(p => {
                            // La "llave" es el texto descriptivo del paquete, ej: "Pack Básico (5 x $10)"
                            const key = `${p.nombre} (${p.boletos} x $${p.precio})`;
                            priceData[s.id_sorteo][key] = { price: p.precio, boletos: p.boletos };
                        });
                    }
                } catch(e) { /* Ignora JSON inválido o nulo */ }
            });
            
            // 2. Agrupamos las participaciones vendidas por sorteo y tipo de paquete
            const purchaseGroupsSql = `
                SELECT id_sorteo_config_fk, paquete_elegido, COUNT(*) as num_tickets
                FROM participaciones
                WHERE paquete_elegido IS NOT NULL AND paquete_elegido != ''
                GROUP BY id_sorteo_config_fk, paquete_elegido;
            `;
            const purchaseGroupsResult = await client.query(purchaseGroupsSql);
            const purchaseGroups = purchaseGroupsResult.rows;

            // 3. Calculamos los ingresos iterando sobre los grupos de compra
            stats.totalRevenue = purchaseGroups.reduce((total, group) => {
                const sorteoId = group.id_sorteo_config_fk;
                const paqueteElegidoKey = group.paquete_elegido;
                
                // Buscamos el precio en nuestro mapa dinámico
                if (priceData[sorteoId] && priceData[sorteoId][paqueteElegidoKey]) {
                    const paqueteInfo = priceData[sorteoId][paqueteElegidoKey];
                    const numTicketsInPackage = paqueteInfo.boletos;
                    const packagePrice = paqueteInfo.price;
                    
                    if (numTicketsInPackage > 0) {
                        const numberOfPackagesSold = Math.floor(group.num_tickets / numTicketsInPackage);
                        return total + (numberOfPackagesSold * packagePrice);
                    }
                }
                return total;
            }, 0);
            
            // --- FIN DE LA NUEVA LÓGICA ---


            // El resto de las estadísticas se calculan como antes
            const [
                rendimientoSorteosResult,
                topAfiliadosResult,
                paquetesPopularesResult,
                participacionesDiariasResult
            ] = await Promise.all([
                client.query("SELECT s.nombre_premio_display, COUNT(p.orden_id) as participantes_actuales FROM sorteos_config s LEFT JOIN participaciones p ON s.id_sorteo = p.id_sorteo_config_fk WHERE s.status_sorteo = 'activo' GROUP BY s.id_sorteo ORDER BY participantes_actuales DESC"),
                client.query("SELECT nombre_afiliado, COUNT(*) as total_boletos FROM participaciones WHERE nombre_afiliado IS NOT NULL AND nombre_afiliado != '' GROUP BY nombre_afiliado ORDER BY total_boletos DESC LIMIT 5"),
                client.query("SELECT paquete_elegido, COUNT(*) as count FROM participaciones WHERE paquete_elegido IS NOT NULL AND paquete_elegido != '' GROUP BY paquete_elegido ORDER BY count DESC"),
                client.query("SELECT TO_CHAR(fecha_creacion, 'YYYY-MM-DD') as dia, COUNT(*) as count FROM participaciones WHERE fecha_creacion >= NOW() - INTERVAL '7 days' GROUP BY dia ORDER BY dia ASC")
            ]);

            stats.rendimientoSorteos = rendimientoSorteosResult.rows;
            stats.topAfiliados = topAfiliadosResult.rows;
            stats.paquetesPopulares = paquetesPopularesResult.rows;
            stats.participacionesDiarias = participacionesDiariasResult.rows;

            res.json({ success: true, stats: stats });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error obteniendo estadísticas avanzadas del dashboard:", error);
        res.status(500).json({ success: false, error: 'Error interno al obtener estadísticas.' });
    }
});
app.get('/api/admin/sorteo-participantes/:id_sorteo', requireAdminLogin, (req, res) => {
    const { id_sorteo } = req.params;
    const sql = `SELECT * FROM participaciones WHERE id_sorteo_config_fk = $1 ORDER BY orden_id ASC`;
    db.all(sql, [id_sorteo], (err, rows) => {
        if (err) res.status(500).json({ error: 'Error al obtener la lista.' });
        else res.json(rows);
    });
});



app.post('/api/admin/realizar-sorteo', async (req, res) => {
    const { sorteo_id, premio_actual } = req.body;
    if (!sorteo_id) {
        return res.status(400).json({ error: "Falta el ID del sorteo." });
    }

    const client = await dbClient.connect();
    try {
        await client.query('BEGIN');

        // 1. Revisa si ya existe un ganador para este sorteo
        const checkWinnerSql = 'SELECT * FROM ganadores WHERE id_sorteo_config_fk = $1';
        const winnerResult = await client.query(checkWinnerSql, [sorteo_id]);

        if (winnerResult.rows.length > 0) {
            // Si ya existe, lo devuelve y no hace nada más
            const ganadorExistente = winnerResult.rows[0];
            return res.json({ 
                success: true, 
                ganador: { 
                    orden_id: ganadorExistente.orden_id_participacion,
                    id: ganadorExistente.id_participante,
                    name: ganadorExistente.nombre,
                    numero_boleto_sorteo: ganadorExistente.numero_boleto_ganador
                }, 
                message: "Sorteo ya había finalizado." 
            });
        }

        // 2. Si no hay ganador, obtiene todos los participantes para el sorteo
        const sqlSelect = "SELECT orden_id, id_documento AS id, nombre, ciudad, numero_boleto_sorteo FROM participaciones WHERE id_sorteo_config_fk = $1";
        const participacionesRes = await client.query(sqlSelect, [sorteo_id]);
        const participaciones = participacionesRes.rows;
        
        if (!participaciones || participaciones.length === 0) {
            throw new Error('No hay participantes para este sorteo.');
        }

        // 3. Elige un ganador al azar
        const ganador = participaciones[Math.floor(Math.random() * participaciones.length)];
        const fechaSorteo = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

        // 4. Guarda al ganador en la tabla 'ganadores', incluyendo el nuevo numero_boleto_ganador
        const sqlInsert = `INSERT INTO ganadores (nombre, ciudad, id_participante, orden_id_participacion, premio, fecha, id_sorteo_config_fk, numero_boleto_ganador) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(sqlInsert, [ganador.nombre, ganador.ciudad || "N/A", ganador.id, ganador.orden_id, premio_actual, fechaSorteo, sorteo_id, ganador.numero_boleto_sorteo]);
        
        // 5. Actualiza el estado del sorteo a 'finalizado'
        const updateStatusSql = `UPDATE sorteos_config SET status_sorteo = 'finalizado' WHERE id_sorteo = $1`;
        await client.query(updateStatusSql, [sorteo_id]);

        await client.query('COMMIT');
        
        res.json({ success: true, ganador: ganador, message: `¡Sorteo realizado con éxito!` });

    } catch(error) {
        await client.query('ROLLBACK');
        console.error("Error realizando el sorteo:", error);
        res.status(500).json({ error: "Error de servidor al realizar el sorteo." });
    } finally {
        client.release();
    }
});


// =============================
// --- RUTAS DE GESTIÓN DE GANADORES ---
// =============================

// OBTENER TODOS LOS GANADORES
app.get('/api/admin/ganadores', requireAdminLogin, (req, res) => {
    const sql = "SELECT id, nombre, premio, fecha, imagenUrl FROM ganadores ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error al obtener la lista de ganadores." });
        res.json(rows);
    });
});

// ACTUALIZAR LA URL DE LA IMAGEN DE UN GANADOR
app.put('/api/admin/ganadores/:id', requireAdminLogin, (req, res) => {
    const { id } = req.params;
    const { imagenUrl } = req.body;

    const sql = "UPDATE ganadores SET imagenUrl $1 WHERE id = $2";
    db.run(sql, [imagenUrl, id], function(err) {
        if (err) return res.status(500).json({ error: "Error al actualizar el ganador." });
        if (this.changes === 0) return res.status(404).json({ error: "Ganador no encontrado." });
        res.json({ message: "Foto del ganador actualizada con éxito." });
    });
});
// --- Rutas HTML ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/faq.html', (req, res) => { res.sendFile(path.join(__dirname, 'faq.html')); });
app.get('/bases.html', (req, res) => { res.sendFile(path.join(__dirname, 'bases.html')); });
app.get('/ganadores.html', (req, res) => { res.sendFile(path.join(__dirname, 'ganadores.html')); });


// --- 6. ARRANQUE DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor iniciado y escuchando en el puerto ${PORT}`);
});