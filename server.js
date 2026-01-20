const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Necesario para borrar fotos del disco

const app = express();
// Busca si la nube nos dio un puerto, si no, usa el 3000
const PORT = process.env.PORT || 3000;

// Configuración CORS más segura (Permite solo tu propio origen en producción)
app.use(cors()); 
app.use(express.json());

// --- CONFIGURACIÓN DE ALMACENAMIENTO ---
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        // Sanitizar nombre de archivo (quitar espacios raros)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por foto
});

app.use('/uploads', express.static('uploads'));

// --- BASE DE DATOS ROBUSTA ---
const db = new sqlite3.Database('./tienda.db', (err) => {
    if (err) return console.error("Error crítico BD:", err.message);
    console.log('Sistema conectado a SQLite exitosamente.');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio INTEGER NOT NULL CHECK(precio >= 0), -- Validación SQL: Precio positivo
            imagen_url TEXT
        )
    `);
});

// --- RUTAS PROFESIONALES ---

// 1. GET: Listar
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error interno del servidor" });
        res.json(rows);
    });
});

// 2. POST: Crear con Validación
app.post('/api/admin/nuevo', upload.single('imagen'), (req, res) => {
    const { nombre, precio } = req.body;
    const imagenUrl = req.file ? req.file.filename : null;

    // VALIDACIÓN DE BACKEND (Nunca confíes en el Front-End)
    if (!nombre || !precio) {
        return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }
    if (isNaN(precio) || precio < 0) {
        return res.status(400).json({ error: "El precio debe ser un número positivo" });
    }

    const sql = "INSERT INTO productos (nombre, precio, imagen_url) VALUES (?, ?, ?)";
    db.run(sql, [nombre, precio, imagenUrl], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "Producto creado correctamente" });
    });
});

// 3. DELETE: Eliminar Producto y su Foto (Nuevo)
app.delete('/api/admin/eliminar/:id', (req, res) => {
    const id = req.params.id;

    // Primero buscamos el producto para obtener el nombre de la imagen
    db.get("SELECT imagen_url FROM productos WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Producto no encontrado" });

        // Si tiene foto, la borramos del disco duro para no acumular basura
        if (row.imagen_url) {
            fs.unlink(`uploads/${row.imagen_url}`, (err) => {
                if (err) console.error("Error borrando imagen física:", err);
            });
        }

        // Borramos de la BD
        db.run("DELETE FROM productos WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Producto eliminado definitivamente" });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Core del sistema corriendo en http://localhost:${PORT}`);
}); 